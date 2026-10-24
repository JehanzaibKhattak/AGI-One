import { z } from "zod";
import { pool } from "@/lib/server/db";
import { requireMember, errorResponse, HttpError } from "@/lib/server/http";
import { requirePermission } from "@/lib/server/authorization";
export async function GET(request: Request) {
  const client = await pool.connect();
  try {
    const member = await requireMember(request);
    requirePermission(member, "sales", "view");
    const q = z
      .object({
        from: z.iso.date(),
        to: z.iso.date(),
        pipelineId: z.string().max(200).default(""),
        owner: z.string().max(500).default(""),
        branchId: z.string().max(200).default(""),
      })
      .parse(Object.fromEntries(new URL(request.url).searchParams));
    if (q.from > q.to)
      throw new HttpError(400, "The end date must follow the start date.");
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    await client.query("SELECT set_config('agi.workspace_id',$1,true)", [
      member.workspace_id,
    ]);
    const result = await client.query(
      `WITH deals AS (
      SELECT o.name,o.data,coalesce(s.stage->>'name',o.status) AS stage, coalesce(s.stage->>'outcome',CASE WHEN o.status='Won' THEN 'won' WHEN o.status='Lost' THEN 'lost' ELSE 'open' END) AS outcome
      FROM agi_records o LEFT JOIN agi_records p ON p.workspace_id=o.workspace_id AND p.collection='pipelines' AND p.id=coalesce(o.data->>'pipelineId','default')
      LEFT JOIN LATERAL (SELECT stage FROM jsonb_array_elements(p.data->'stages') stage WHERE CASE WHEN coalesce(o.data->>'stageId','')<>'' THEN stage->>'id'=o.data->>'stageId' ELSE stage->>'name'=o.status END LIMIT 1) s ON true
      WHERE o.workspace_id=$1 AND o.collection='opportunities' AND ($2::boolean OR o.branch_id=ANY($3::text[])) AND o.data->>'closeDate'>=$4 AND o.data->>'closeDate'<=$5 AND ($6='' OR coalesce(o.data->>'pipelineId','default')=$6) AND ($7='' OR o.data->>'owner'=$7) AND ($8='' OR o.branch_id=$8)
    ) SELECT coalesce(data->>'owner','') AS owner,stage,outcome,count(*)::int AS count,coalesce(sum((data->>'value')::numeric),0)::text AS value,coalesce(sum(CASE WHEN outcome='lost' THEN 0 WHEN outcome='won' THEN (data->>'value')::numeric ELSE (data->>'value')::numeric*(data->>'probability')::numeric/100 END),0)::text AS weighted FROM deals GROUP BY owner,stage,outcome ORDER BY owner,stage`,
      [
        member.workspace_id,
        member.role === "owner" || !member.branch_ids.length,
        member.branch_ids,
        q.from,
        q.to,
        q.pipelineId,
        q.owner,
        q.branchId,
      ],
    );
    await client.query("COMMIT");
    return Response.json(
      {
        groups: result.rows.map((r) => ({
          ...r,
          value: Number(r.value),
          weighted: Number(r.weighted),
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    await client.query("ROLLBACK");
    return errorResponse(
      error instanceof z.ZodError
        ? new HttpError(400, "Choose a valid forecast period.")
        : error,
    );
  } finally {
    client.release();
  }
}
