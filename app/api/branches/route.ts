import { z } from "zod";
import { pool } from "@/lib/server/db";
import {
  requireMember,
  sameOrigin,
  readBody,
  errorResponse,
  HttpError,
} from "@/lib/server/http";
import { auditAdmin } from "@/lib/server/access-schema";
export async function GET(request: Request) {
  try {
    const member = await requireMember(request);
    const result = await pool.query(
      "SELECT id,name FROM agi_branches WHERE workspace_id=$1 AND ($2::text[]='{}' OR id=ANY($2::text[])) ORDER BY name",
      [member.workspace_id, member.role === "owner" ? [] : member.branch_ids],
    );
    return Response.json(result.rows, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  const client = await pool.connect();
  try {
    sameOrigin(request);
    const member = await requireMember(request);
    if (member.role !== "owner")
      throw new HttpError(403, "Only the owner can create branches.");
    const { name } = z
      .object({ name: z.string().trim().min(1).max(100) })
      .parse(await readBody(request));
    await client.query("BEGIN");
    await client.query("SELECT id FROM agi_workspaces WHERE id=$1 FOR UPDATE", [
      member.workspace_id,
    ]);
    const current = (
      await client.query(
        "SELECT role FROM agi_members WHERE workspace_id=$1 AND user_id=$2 FOR SHARE",
        [member.workspace_id, member.user.id],
      )
    ).rows[0];
    if (current?.role !== "owner")
      throw new HttpError(403, "Your access has changed.");
    const id = crypto.randomUUID();
    await client.query(
      "INSERT INTO agi_branches(workspace_id,id,name) VALUES($1,$2,$3)",
      [member.workspace_id, id, name],
    );
    await auditAdmin(
      client,
      member.workspace_id,
      member.user.id,
      "branch.created",
      { id, name },
    );
    await client.query(
      "UPDATE agi_workspaces SET revision=revision+1 WHERE id=$1",
      [member.workspace_id],
    );
    await client.query("COMMIT");
    return Response.json({ id, name }, { status: 201 });
  } catch (error) {
    await client.query("ROLLBACK");
    return errorResponse(
      error instanceof z.ZodError
        ? new HttpError(400, "Enter a branch name.")
        : error,
    );
  } finally {
    client.release();
  }
}
