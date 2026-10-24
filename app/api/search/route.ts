import { pool } from "@/lib/server/db";
import { can, collectionArea, globalCollections } from "@/lib/access";
import { collections } from "@/lib/server/records";
import { requireMember, errorResponse, HttpError } from "@/lib/server/http";
export async function GET(request: Request) {
  const client = await pool.connect();
  try {
    const member = await requireMember(request);
    const q = new URL(request.url).searchParams.get("q")?.trim() || "";
    if (q.length > 200) throw new HttpError(400, "Search is too long.");
    if (!q) return Response.json([]);
    const allowed = collections.filter(
      (c) =>
        can(member, collectionArea[c], "view") &&
        !["audit", "notifications", "users", "roles"].includes(c),
    );
    await client.query("BEGIN");
    await client.query("SELECT set_config('agi.workspace_id',$1,true)", [
      member.workspace_id,
    ]);
    const rows = await client.query(
      "SELECT collection AS key,data AS row FROM agi_records WHERE workspace_id=$1 AND collection=ANY($2::text[]) AND ($3::boolean OR collection=ANY($4::text[]) OR branch_id=ANY($5::text[])) AND search_text LIKE $6 ESCAPE '\\' ORDER BY lower(name),id LIMIT 30",
      [
        member.workspace_id,
        allowed,
        member.role === "owner" || !member.branch_ids.length,
        globalCollections,
        member.branch_ids,
        "%" + q.toLowerCase().replace(/[\\%_]/g, "\\$&") + "%",
      ],
    );
    await client.query("COMMIT");
    return Response.json(rows.rows, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return errorResponse(error);
  } finally {
    client.release();
  }
}
