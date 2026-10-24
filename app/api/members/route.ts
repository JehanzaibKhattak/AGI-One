import { randomBytes, createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { z } from "zod";
import { pool } from "@/lib/server/db";
import { can } from "@/lib/access";
import {
  requireMember,
  sameOrigin,
  readBody,
  errorResponse,
  HttpError,
} from "@/lib/server/http";
import {
  scopeSchema,
  validateBranches,
  auditAdmin,
} from "@/lib/server/access-schema";
export async function GET(request: Request) {
  try {
    const member = await requireMember(request);
    if (!can(member, "administration", "view"))
      throw new HttpError(
        403,
        "You do not have access to team administration.",
      );
    const [members, invitations] = await Promise.all([
      pool.query(
        'SELECT u.id,u.name,u.email,m.role,m.grants,m.branch_ids FROM agi_members m JOIN "user" u ON u.id=m.user_id WHERE m.workspace_id=$1 ORDER BY u.name',
        [member.workspace_id],
      ),
      member.role === "owner"
        ? pool.query(
            "SELECT token_hash AS id,email,role,grants,branch_ids,expires_at FROM agi_invitations WHERE workspace_id=$1 AND expires_at>now() ORDER BY email",
            [member.workspace_id],
          )
        : Promise.resolve({ rows: [] }),
    ]);
    return Response.json(
      { members: members.rows, invitations: invitations.rows },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
async function manage(
  request: Request,
  action: (
    client: PoolClient,
    member: Awaited<ReturnType<typeof requireMember>>,
    body: unknown,
  ) => Promise<Response>,
) {
  let client: PoolClient | undefined;
  try {
    sameOrigin(request);
    const member = await requireMember(request);
    if (member.role !== "owner")
      throw new HttpError(403, "Only the owner can manage team access.");
    const body = await readBody(request);
    client = await pool.connect();
    await client.query("BEGIN");
    await client.query("SELECT id FROM agi_workspaces WHERE id=$1 FOR UPDATE", [
      member.workspace_id,
    ]);
    const current = (
      await client.query(
        "SELECT role FROM agi_members WHERE workspace_id=$1 AND user_id=$2 FOR UPDATE",
        [member.workspace_id, member.user.id],
      )
    ).rows[0];
    if (current?.role !== "owner")
      throw new HttpError(403, "Your owner access has changed.");
    const response = await action(client, member, body);
    await client.query(
      "UPDATE agi_workspaces SET revision=revision+1 WHERE id=$1",
      [member.workspace_id],
    );
    await client.query("COMMIT");
    return response;
  } catch (error) {
    if (client) await client.query("ROLLBACK");
    return errorResponse(
      error instanceof z.ZodError
        ? new HttpError(400, "Check the email, role and access selections.")
        : error,
    );
  } finally {
    client?.release();
  }
}
export async function POST(request: Request) {
  return manage(request, async (client, member, raw) => {
    const body = scopeSchema.extend({ email: z.email() }).parse(raw);
    await validateBranches(client, member.workspace_id, body.branch_ids);
    const exists = await client.query(
      'SELECT 1 FROM agi_members m JOIN "user" u ON u.id=m.user_id WHERE m.workspace_id=$1 AND lower(u.email)=$2',
      [member.workspace_id, body.email.toLowerCase()],
    );
    if (exists.rowCount)
      throw new HttpError(409, "This person is already a workspace member.");
    const token = randomBytes(32).toString("hex");
    await client.query(
      "INSERT INTO agi_invitations(token_hash,workspace_id,email,role,grants,branch_ids) VALUES($1,$2,$3,$4,$5,$6)",
      [
        createHash("sha256").update(token).digest("hex"),
        member.workspace_id,
        body.email.toLowerCase(),
        body.role,
        JSON.stringify(body.grants),
        body.branch_ids,
      ],
    );
    await auditAdmin(
      client,
      member.workspace_id,
      member.user.id,
      "invitation.created",
      {
        email: body.email,
        role: body.role,
        grants: body.grants,
        branch_ids: body.branch_ids,
      },
    );
    const url = new URL("/onboarding", process.env.BETTER_AUTH_URL);
    url.searchParams.set("invitation", token);
    return Response.json({ url: url.toString() }, { status: 201 });
  });
}
export async function PATCH(request: Request) {
  return manage(request, async (client, member, raw) => {
    const body = z
      .discriminatedUnion("action", [
        scopeSchema.extend({
          action: z.literal("update"),
          userId: z.string().min(1),
        }),
        z.object({
          action: z.literal("transfer"),
          userId: z.string().min(1),
          email: z.email(),
        }),
      ])
      .parse(raw);
    if (body.userId === member.user.id)
      throw new HttpError(
        400,
        "Transfer ownership before changing your own access.",
      );
    const target = (
      await client.query(
        'SELECT m.user_id,u.email FROM agi_members m JOIN "user" u ON u.id=m.user_id WHERE m.workspace_id=$1 AND m.user_id=$2 FOR UPDATE OF m',
        [member.workspace_id, body.userId],
      )
    ).rows[0];
    if (!target) throw new HttpError(404, "Member not found.");
    if (body.action === "transfer") {
      if (target.email.toLowerCase() !== body.email.toLowerCase())
        throw new HttpError(
          400,
          "The confirmation email does not match this member.",
        );
      await client.query(
        "UPDATE agi_members SET role='editor',grants='{}',branch_ids='{}' WHERE workspace_id=$1 AND user_id=$2",
        [member.workspace_id, member.user.id],
      );
      await client.query(
        "UPDATE agi_members SET role='owner',grants='{}',branch_ids='{}' WHERE workspace_id=$1 AND user_id=$2",
        [member.workspace_id, body.userId],
      );
      await client.query("DELETE FROM agi_invitations WHERE workspace_id=$1", [
        member.workspace_id,
      ]);
      await auditAdmin(
        client,
        member.workspace_id,
        member.user.id,
        "ownership.transferred",
        { to: body.userId },
      );
    } else {
      await validateBranches(client, member.workspace_id, body.branch_ids);
      await client.query(
        "UPDATE agi_members SET role=$1,grants=$2,branch_ids=$3 WHERE workspace_id=$4 AND user_id=$5",
        [
          body.role,
          JSON.stringify(body.grants),
          body.branch_ids,
          member.workspace_id,
          body.userId,
        ],
      );
      await auditAdmin(
        client,
        member.workspace_id,
        member.user.id,
        "member.access.updated",
        body,
      );
    }
    return Response.json({ ok: true });
  });
}
export async function DELETE(request: Request) {
  return manage(request, async (client, member, raw) => {
    const body = z
      .object({
        kind: z.enum(["member", "invitation"]),
        id: z.string().min(1).max(200),
      })
      .parse(raw);
    if (body.kind === "member") {
      if (body.id === member.user.id)
        throw new HttpError(
          400,
          "Transfer ownership before leaving the workspace.",
        );
      const deleted = await client.query(
        "DELETE FROM agi_members WHERE workspace_id=$1 AND user_id=$2 AND role<>'owner' RETURNING user_id",
        [member.workspace_id, body.id],
      );
      if (!deleted.rowCount) throw new HttpError(404, "Member not found.");
      await client.query('DELETE FROM "session" WHERE "userId"=$1', [body.id]);
    } else {
      const deleted = await client.query(
        "DELETE FROM agi_invitations WHERE workspace_id=$1 AND token_hash=$2 RETURNING token_hash",
        [member.workspace_id, body.id],
      );
      if (!deleted.rowCount) throw new HttpError(404, "Invitation not found.");
    }
    await auditAdmin(
      client,
      member.workspace_id,
      member.user.id,
      body.kind + ".revoked",
      { id: body.id },
    );
    return Response.json({ ok: true });
  });
}
