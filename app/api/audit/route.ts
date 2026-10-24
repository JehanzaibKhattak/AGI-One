import { z } from "zod";
import { pool } from "@/lib/server/db";
import { can } from "@/lib/access";
import { requireMember, errorResponse, HttpError } from "@/lib/server/http";
export async function GET(request: Request) {
  try {
    const member = await requireMember(request);
    if (!can(member, "administration", "view"))
      throw new HttpError(403, "You do not have access to the audit trail.");
    const { cursor, action } = z
      .object({
        cursor: z.string().max(2000).optional(),
        action: z.string().max(100).default(""),
      })
      .parse(Object.fromEntries(new URL(request.url).searchParams));
    let before: { time: string; id: string } | undefined;
    if (cursor) {
      try {
        before = z
          .object({ time: z.iso.datetime(), id: z.string().max(200) })
          .parse(JSON.parse(Buffer.from(cursor, "base64url").toString()));
      } catch {
        throw new HttpError(400, "Invalid audit page.");
      }
    }
    const result = await pool.query(
      `SELECT e.id,e.action,e.created_at,to_char(e.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_time,u.name AS actor,u.email,CASE WHEN $5::boolean THEN e.detail ELSE NULL END AS detail FROM agi_events e JOIN "user" u ON u.id=e.user_id WHERE e.workspace_id=$1 AND ($2::timestamptz IS NULL OR (e.created_at,e.id)<($2,$6)) AND ($3::text='' OR e.action=$3) ORDER BY e.created_at DESC,e.id DESC LIMIT $4`,
      [
        member.workspace_id,
        before?.time || null,
        action,
        51,
        member.role === "owner",
        before?.id || "",
      ],
    );
    const rows = result.rows.slice(0, 50);
    return Response.json(
      {
        rows,
        next:
          result.rows.length > 50
            ? Buffer.from(
                JSON.stringify({
                  time: rows.at(-1).cursor_time,
                  id: rows.at(-1).id,
                }),
              ).toString("base64url")
            : null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(
      error instanceof z.ZodError
        ? new HttpError(400, "Invalid audit filter.")
        : error,
    );
  }
}
