import type { PoolClient } from "pg";
import { randomUUID, createHash } from "node:crypto";
import { z } from "zod";
import { pool } from "@/lib/server/db";
import {
  requireSession,
  requireMember,
  sameOrigin,
  readBody,
  errorResponse,
  HttpError,
} from "@/lib/server/http";
import { createEmptyDatabase } from "@/lib/database/empty";
import { executeCommand } from "@/lib/server/commands";
import type { Database } from "@/types";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const member = await requireMember(request);
    const result = await pool.query(
      "SELECT data, revision FROM agi_workspaces WHERE id=$1",
      [member.workspace_id],
    );
    return Response.json(
      {
        ...result.rows[0],
        member: {
          name: member.user.name,
          email: member.user.email,
          role: member.role,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  let client: PoolClient | undefined;
  try {
    sameOrigin(request);
    const session = await requireSession(request);
    const body = z
      .object({
        name: z.string().trim().min(2).max(100),
        currency: z
          .string()
          .regex(/^[A-Z]{3}$/)
          .default("USD"),
        timezone: z.string().max(100).default("UTC"),
        invitation: z.string().max(200).optional(),
      })
      .parse(await readBody(request));
    try {
      new Intl.DateTimeFormat("en", { timeZone: body.timezone });
      new Intl.NumberFormat("en", {
        style: "currency",
        currency: body.currency,
      });
    } catch {
      throw new HttpError(400, "Choose a valid timezone and currency.");
    }
    client = await pool.connect();
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      session.user.id,
    ]);
    if (
      (
        await client.query("SELECT 1 FROM agi_members WHERE user_id=$1", [
          session.user.id,
        ])
      ).rowCount
    )
      throw new HttpError(409, "You already belong to a workspace.");
    if (body.invitation) {
      const invitation = (
        await client.query(
          "DELETE FROM agi_invitations WHERE token_hash=$1 AND email=$2 AND expires_at>now() RETURNING *",
          [
            createHash("sha256").update(body.invitation).digest("hex"),
            session.user.email.toLowerCase(),
          ],
        )
      ).rows[0];
      if (!invitation)
        throw new HttpError(
          400,
          "This invitation is invalid or expired, or belongs to another email address.",
        );
      await client.query(
        "INSERT INTO agi_members(user_id,workspace_id,role) VALUES($1,$2,$3)",
        [session.user.id, invitation.workspace_id, invitation.role],
      );
    } else {
      const id = randomUUID();
      const data = createEmptyDatabase(body.name);
      data.settings.currency = body.currency;
      data.settings.timezone = body.timezone;
      await client.query(
        "INSERT INTO agi_workspaces(id,name,data) VALUES($1,$2,$3)",
        [id, body.name, JSON.stringify(data)],
      );
      await client.query(
        "INSERT INTO agi_members(user_id,workspace_id,role) VALUES($1,$2,'owner')",
        [session.user.id, id],
      );
    }
    await client.query("COMMIT");
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (client) await client.query("ROLLBACK");
    return errorResponse(
      error instanceof z.ZodError
        ? new HttpError(400, "Check your workspace details.")
        : error,
    );
  } finally {
    client?.release();
  }
}
export async function PATCH(request: Request) {
  let client: PoolClient | undefined;
  try {
    sameOrigin(request);
    const member = await requireMember(request);
    const body = z
      .object({ revision: z.number().int().min(0), command: z.unknown() })
      .parse(await readBody(request));
    client = await pool.connect();
    await client.query("BEGIN");
    const row = (
      await client.query(
        "SELECT data,revision FROM agi_workspaces WHERE id=$1 FOR UPDATE",
        [member.workspace_id],
      )
    ).rows[0];
    // Membership is checked again inside the transaction so revoked access cannot write.
    const access = (
      await client.query(
        "SELECT role FROM agi_members WHERE workspace_id=$1 AND user_id=$2 FOR SHARE",
        [member.workspace_id, member.user.id],
      )
    ).rows[0];
    if (!access)
      throw new HttpError(403, "Your workspace access has been removed.");
    if (row.revision !== body.revision)
      throw new HttpError(
        409,
        "Another teammate changed these records. Refresh and try again.",
      );
    const { data, result } = executeCommand(
      row.data as Database,
      body.command,
      `${member.user.name} <${member.user.email}>`,
      access.role,
    );
    await client.query(
      "UPDATE agi_workspaces SET data=$1,revision=revision+1,name=$2 WHERE id=$3",
      [JSON.stringify(data), data.settings.company, member.workspace_id],
    );
    await client.query(
      "INSERT INTO agi_events(id,workspace_id,user_id,action,detail) VALUES($1,$2,$3,$4,$5)",
      [
        randomUUID(),
        member.workspace_id,
        member.user.id,
        (body.command as { action: string }).action,
        JSON.stringify(body.command),
      ],
    );
    await client.query("COMMIT");
    return Response.json(
      { data, revision: row.revision + 1, result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (client) await client.query("ROLLBACK");
    return errorResponse(
      error instanceof z.ZodError
        ? new HttpError(400, "Invalid request.")
        : error,
    );
  } finally {
    client?.release();
  }
}
