import { pool } from "@/lib/server/db";
import { requireMember, errorResponse } from "@/lib/server/http";
import { requirePermission } from "@/lib/server/authorization";
import { can } from "@/lib/access";
export async function GET(request: Request) {
  try {
    const member = await requireMember(request);
    requirePermission(member, "sales", "view");
    const members = (
      await pool.query(
        'SELECT m.user_id AS id,u.name,m.role,m.grants,m.branch_ids FROM agi_members m JOIN "user" u ON u.id=m.user_id WHERE m.workspace_id=$1 ORDER BY u.name',
        [member.workspace_id],
      )
    ).rows
      .filter((m) => can(m, "sales", "view"))
      .map((m) => ({
        id: m.id,
        name: m.name,
        branch_ids: m.role === "owner" ? [] : m.branch_ids,
      }));
    return Response.json(
      { members },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
