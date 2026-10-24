import { z } from "zod";
import { pool } from "@/lib/server/db";
import { requireMember, errorResponse, HttpError } from "@/lib/server/http";
import { listRecords } from "@/lib/server/list-records";
import type { Collection } from "@/types";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ collection: string }> },
) {
  const client = await pool.connect();
  try {
    const member = await requireMember(request);
    const { collection } = await params;
    const query = z
      .object({
        q: z.string().max(200).default(""),
        limit: z.coerce.number().int().min(1).max(100).default(25),
        cursor: z.string().max(2000).optional(),
        status: z.string().max(100).optional(),
        branchId: z.string().max(200).optional(),
        organizationId: z.string().max(200).optional(),
        id: z.string().max(200).optional(),
      })
      .parse(Object.fromEntries(new URL(request.url).searchParams));
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    await client.query("SELECT set_config('agi.workspace_id',$1,true)", [
      member.workspace_id,
    ]);
    const result = await listRecords(
      client,
      member.workspace_id,
      member,
      collection as Collection,
      query,
    );
    await client.query("COMMIT");
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    await client.query("ROLLBACK");
    return errorResponse(
      error instanceof z.ZodError
        ? new HttpError(400, "Invalid search or page parameters.")
        : error,
    );
  } finally {
    client.release();
  }
}
