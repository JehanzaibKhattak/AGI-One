import { z } from "zod";
import { pool } from "@/lib/server/db";
import { can, collectionArea } from "@/lib/access";
import { collections } from "@/lib/server/records";
import { listRecords } from "@/lib/server/list-records";
import { requireMember, errorResponse, HttpError } from "@/lib/server/http";
import { csvText } from "@/lib/utils";
import type { Collection } from "@/types";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ collection: string }> },
) {
  const client = await pool.connect();
  try {
    const member = await requireMember(request);
    const { collection: raw } = await params;
    const collection = raw as Collection;
    if (!collections.includes(collection))
      throw new HttpError(404, "Unknown record type.");
    if (!can(member, collectionArea[collection], "export"))
      throw new HttpError(
        403,
        "Your access does not allow exports from this module.",
      );
    const query = z
      .object({
        q: z.string().max(200).default(""),
        status: z.string().max(100).optional(),
        branchId: z.string().max(200).optional(),
      })
      .parse(Object.fromEntries(new URL(request.url).searchParams));
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    await client.query("SELECT set_config('agi.workspace_id',$1,true)", [
      member.workspace_id,
    ]);
    let cursor: string | undefined;
    const rows: Record<string, unknown>[] = [];
    do {
      const page = await listRecords(
        client,
        member.workspace_id,
        member,
        collection,
        { ...query, limit: 100, cursor },
      );
      if (page.total > 10000)
        throw new HttpError(
          422,
          "Narrow your filters to 10,000 records or fewer before exporting.",
        );
      rows.push(...page.rows);
      cursor = page.nextCursor || undefined;
    } while (cursor);
    const output =
      collection === "organizations"
        ? rows.map((row) => ({
            Name: row.name,
            Code: row.code,
            Type: row.type,
            City: row.city,
            Contact: row.contact,
            Owner: row.owner,
            Status: row.status,
            ...(can(member, "sales", "export")
              ? { Opportunities: row.opportunities }
              : {}),
            ...(can(member, "finance", "export")
              ? { Balance: row.balance }
              : {}),
          }))
        : rows.map((row) =>
            Object.fromEntries(
              Object.entries(row).filter(
                ([, value]) =>
                  value === null ||
                  ["string", "number", "boolean"].includes(typeof value),
              ),
            ),
          );
    await client.query("COMMIT");
    return new Response("\uFEFF" + csvText(output), {
      headers: {
        "Content-Type": "text/csv;charset=utf-8",
        "Content-Disposition": `attachment; filename="agi-one-${collection}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return errorResponse(
      error instanceof z.ZodError
        ? new HttpError(400, "Invalid export filters.")
        : error,
    );
  } finally {
    client.release();
  }
}
