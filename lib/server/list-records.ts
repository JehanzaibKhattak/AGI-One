import type { PoolClient } from "pg";
import {
  can,
  collectionArea,
  globalCollections,
  type Access,
} from "@/lib/access";
import type { Collection } from "@/types";
import { HttpError } from "./errors";
import { collections } from "./records";
export type ListQuery = {
  q: string;
  limit: number;
  cursor?: string;
  status?: string;
  branchId?: string;
  organizationId?: string;
  id?: string;
  pipelineId?: string;
  assigneeId?: string;
};
export async function listRecords(
  client: PoolClient,
  workspaceId: string,
  access: Access,
  collection: Collection,
  query: ListQuery,
) {
  if (!collections.includes(collection))
    throw new HttpError(404, "Unknown record type.");
  if (!can(access, collectionArea[collection], "view"))
    throw new HttpError(403, "You do not have access to these records.");
  const unrestricted =
    access.role === "owner" ||
    !access.branch_ids?.length ||
    globalCollections.includes(collection);
  const parameters: unknown[] = [
    workspaceId,
    collection,
    unrestricted,
    access.branch_ids || [],
  ];
  const where = [
    "r.workspace_id=$1",
    "r.collection=$2",
    "($3::boolean OR r.branch_id=ANY($4::text[]))",
  ];
  const add = (expression: string, value: unknown) => {
    parameters.push(value);
    where.push(expression.replace("?", "$" + parameters.length));
  };
  if (query.q)
    add(
      "r.search_text LIKE ? ESCAPE '\\'",
      "%" + query.q.toLowerCase().replace(/[\\%_]/g, "\\$&") + "%",
    );
  if (query.status) add("r.status=?", query.status);
  if (query.branchId) add("r.branch_id=?", query.branchId);
  if (query.organizationId)
    add("r.data->>'organizationId'=?", query.organizationId);
  if (query.id) add("r.id=?", query.id);
  if (query.pipelineId)
    add("coalesce(r.data->>'pipelineId','default')=?", query.pipelineId);
  if (query.assigneeId) add("r.data->>'assigneeId'=?", query.assigneeId);
  const total = Number(
    (
      await client.query(
        "SELECT count(*) FROM agi_records r WHERE " + where.join(" AND "),
        parameters,
      )
    ).rows[0].count,
  );
  if (query.cursor) {
    let cursor: { name: string; id: string };
    try {
      cursor = JSON.parse(Buffer.from(query.cursor, "base64url").toString());
      if (
        typeof cursor.name !== "string" ||
        typeof cursor.id !== "string" ||
        cursor.name.length > 500 ||
        cursor.id.length > 200
      )
        throw new Error();
    } catch {
      throw new HttpError(400, "Invalid page cursor.");
    }
    parameters.push(cursor.name, cursor.id);
    where.push(
      `(lower(r.name),r.id)>($${parameters.length - 1},$${parameters.length})`,
    );
  }
  parameters.push(query.limit + 1);
  let computed = "r.data";
  if (collection === "organizations") {
    computed += ` || jsonb_build_object('contact',coalesce((SELECT c.name FROM agi_records c WHERE c.workspace_id=r.workspace_id AND c.collection='contacts' AND c.data->>'organizationId'=r.id AND ($3::boolean OR c.branch_id=ANY($4::text[])) ORDER BY c.name LIMIT 1),''))`;
    if (can(access, "sales", "view"))
      computed += ` || jsonb_build_object('opportunities',(SELECT count(*) FROM agi_records o WHERE o.workspace_id=r.workspace_id AND o.collection='opportunities' AND o.data->>'organizationId'=r.id AND coalesce(o.data->>'salesOutcome',CASE WHEN o.status='Won' THEN 'won' WHEN o.status='Lost' THEN 'lost' ELSE 'open' END)='open' AND ($3::boolean OR o.branch_id=ANY($4::text[]))))`;
    if (can(access, "finance", "view"))
      computed += ` || jsonb_build_object('balance',coalesce((SELECT sum(greatest(0,coalesce((SELECT round(sum(l.quantity*l.unit_price*(1-l.discount/100)*(1+l.tax/100)),2) FROM agi_document_lines l WHERE l.workspace_id=i.workspace_id AND l.collection='invoices' AND l.record_id=i.id),0)-coalesce((SELECT sum((p.data->>'amount')::numeric) FROM agi_records p WHERE p.workspace_id=i.workspace_id AND p.collection='payments' AND p.data->>'invoiceId'=i.id),0))) FROM agi_records i WHERE i.workspace_id=r.workspace_id AND i.collection='invoices' AND i.data->>'organizationId'=r.id AND i.status NOT IN ('Draft','Cancelled') AND ($3::boolean OR i.branch_id=ANY($4::text[]))),0))`;
  }
  const result = await client.query(
    `SELECT ${computed} AS data,r.branch_id,r.name,r.id,lower(r.name) AS sort_name FROM agi_records r WHERE ${where.join(" AND ")} ORDER BY lower(r.name),r.id LIMIT $${parameters.length}`,
    parameters,
  );
  const more = result.rows.length > query.limit;
  const page = result.rows.slice(0, query.limit);
  const last = page.at(-1);
  return {
    rows: page.map((row) => ({
      ...row.data,
      ...(row.branch_id ? { branchId: row.branch_id } : {}),
    })),
    total,
    nextCursor:
      more && last
        ? Buffer.from(
            JSON.stringify({ name: last.sort_name, id: last.id }),
          ).toString("base64url")
        : null,
    canExport: can(access, collectionArea[collection], "export"),
  };
}
