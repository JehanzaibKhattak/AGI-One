import { pool } from "@/lib/server/db";
import { requireMember, errorResponse } from "@/lib/server/http";
import { can } from "@/lib/access";
export async function GET(request: Request) {
  const client = await pool.connect();
  try {
    const member = await requireMember(request);
    if (!can(member, "sales", "view"))
      return Response.json({ tasks: [], total: 0 });
    await client.query("BEGIN");
    await client.query("SELECT set_config('agi.workspace_id',$1,true)", [
      member.workspace_id,
    ]);
    const result = await client.query(
      `SELECT data, count(*) OVER()::int AS total FROM agi_records WHERE workspace_id=$1 AND collection='tasks' AND data->>'assigneeId'=$2 AND status NOT IN ('Completed','Cancelled') AND ($3::boolean OR branch_id=ANY($4::text[])) AND (nullif(data->>'dueAt','')::timestamptz<=now() OR nullif(data->>'reminderAt','')::timestamptz<=now()) ORDER BY (data->>'dueAt')::timestamptz,id LIMIT 10`,
      [
        member.workspace_id,
        member.user.id,
        member.role === "owner" || !member.branch_ids.length,
        member.branch_ids,
      ],
    );
    await client.query("COMMIT");
    return Response.json(
      {
        tasks: result.rows.map((r) => r.data),
        total: result.rows[0]?.total || 0,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    await client.query("ROLLBACK");
    return errorResponse(error);
  } finally {
    client.release();
  }
}
