import { defaultPipeline } from "@/lib/services/sales";
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
import { visibleDatabase, can, inBranch, branchOf } from "@/lib/access";
import {
  loadDatabase,
  loadCommandDatabase,
  changedRecords,
  persistChanges,
  assignNumbers,
} from "@/lib/server/records";
import {
  authorizeCommand,
  branchDatabase,
  mergeChanges,
} from "@/lib/server/authorization";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const member = await requireMember(request);
    const client = await pool.connect();
    let data, revision, branches;
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
      await client.query("SELECT set_config('agi.workspace_id',$1,true)", [
        member.workspace_id,
      ]);
      const row = (
        await client.query(
          "SELECT settings,revision FROM agi_workspaces WHERE id=$1",
          [member.workspace_id],
        )
      ).rows[0];
      data = visibleDatabase(
        await loadDatabase(
          client,
          member.workspace_id,
          row.settings,
          member,
          new URL(request.url).searchParams.get("mode") === "directory",
        ),
        member,
      );
      revision = row.revision;
      branches = (
        await client.query(
          "SELECT id,name FROM agi_branches WHERE workspace_id=$1 AND ($2::text[]='{}' OR id=ANY($2::text[])) ORDER BY name",
          [
            member.workspace_id,
            member.role === "owner" ? [] : member.branch_ids,
          ],
        )
      ).rows;
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    return Response.json(
      {
        data,
        revision,
        member: {
          id: member.user.id,
          grants: member.grants,
          branch_ids: member.branch_ids,
          branches,
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
        "INSERT INTO agi_members(user_id,workspace_id,role,grants,branch_ids) VALUES($1,$2,$3,$4,$5)",
        [
          session.user.id,
          invitation.workspace_id,
          invitation.role,
          invitation.grants,
          invitation.branch_ids,
        ],
      );
    } else {
      const id = randomUUID();
      const data = createEmptyDatabase(body.name);
      data.settings.currency = body.currency;
      data.settings.timezone = body.timezone;
      await client.query(
        "INSERT INTO agi_workspaces(id,name,data,settings,storage_version) VALUES($1,$2,$3,$4,1)",
        [
          id,
          body.name,
          JSON.stringify(createEmptyDatabase(body.name)),
          JSON.stringify(data.settings),
        ],
      );
      await client.query("SELECT set_config('agi.workspace_id',$1,true)", [id]);
      await client.query(
        "INSERT INTO agi_records(workspace_id,collection,id,data) VALUES($1,'pipelines','default',$2)",
        [id, JSON.stringify(defaultPipeline)],
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
        "SELECT settings,revision FROM agi_workspaces WHERE id=$1 FOR UPDATE",
        [member.workspace_id],
      )
    ).rows[0];
    // Membership is checked again inside the transaction so revoked access cannot write.
    const access = (
      await client.query(
        "SELECT role,grants,branch_ids FROM agi_members WHERE workspace_id=$1 AND user_id=$2 FOR SHARE",
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
    await client.query("SELECT set_config('agi.workspace_id',$1,true)", [
      member.workspace_id,
    ]);
    const before = await loadCommandDatabase(
      client,
      member.workspace_id,
      row.settings,
      body.command,
    );
    const executionRole = authorizeCommand(access, body.command, before);
    const scoped = branchDatabase(before, access);
    const { data: changed, result } = executeCommand(
      scoped,
      body.command,
      `${member.user.name} <${member.user.email}>`,
      executionRole,
    );
    const data = mergeChanges(before, changed, access);
    for (const task of data.tasks) {
      const old = before.tasks.find((t) => t.id === task.id);
      if (JSON.stringify(old) === JSON.stringify(task)) continue;
      const assignee = (
        await client.query(
          "SELECT role,grants,branch_ids FROM agi_members WHERE workspace_id=$1 AND user_id=$2 FOR SHARE",
          [member.workspace_id, task.assigneeId],
        )
      ).rows[0];
      if (
        !assignee ||
        !can(assignee, "sales", "view") ||
        !inBranch(assignee, "tasks", branchOf(data, "tasks", task))
      )
        throw new HttpError(
          400,
          "Assign the task to a current teammate with access to its branch.",
        );
    }
    await assignNumbers(client, member.workspace_id, before, data);
    await persistChanges(client, member.workspace_id, before, data);
    await client.query(
      "UPDATE agi_workspaces SET revision=revision+1 WHERE id=$1",
      [member.workspace_id],
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
    const changes = changedRecords(before, data);
    const filtered = visibleDatabase(
      {
        ...createEmptyDatabase(data.settings.company),
        ...changes,
        settings: data.settings,
      },
      access,
    );
    const responseChanges = { ...changes };
    for (const collection of Object.keys(
      responseChanges,
    ) as (keyof typeof responseChanges)[])
      if (collection !== "settings")
        (responseChanges[collection] as unknown) = filtered[collection];
    return Response.json(
      { changes: responseChanges, revision: row.revision + 1, result },
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
