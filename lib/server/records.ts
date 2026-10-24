import type { PoolClient } from "pg";
import { createEmptyDatabase } from "@/lib/database/empty";
import {
  can,
  collectionArea,
  globalCollections,
  type Access,
  branchOf,
} from "@/lib/access";
import type { BaseRecord, Collection, Database, QuotationItem } from "@/types";
export const collections = Object.keys(createEmptyDatabase()).filter(
  (k) => k !== "settings",
) as Collection[];
const documents: Collection[] = [
  "quotations",
  "orders",
  "purchaseOrders",
  "invoices",
];
const references: Record<string, Collection> = {
  organizationId: "organizations",
  contactId: "contacts",
  productId: "products",
  quotationId: "quotations",
  orderId: "orders",
  invoiceId: "invoices",
  warehouseId: "warehouses",
  toWarehouseId: "warehouses",
  supplierId: "suppliers",
  purchaseOrderId: "purchaseOrders",
  equipmentId: "equipment",
  engineerId: "engineers",
  ticketId: "tickets",
  contractId: "contracts",
  bankId: "banks",
};
export async function loadDatabase(
  client: PoolClient,
  workspaceId: string,
  settings: Record<string, string>,
  access?: Access,
  directory = false,
): Promise<Database> {
  const db = createEmptyDatabase(settings.company);
  db.settings = settings;
  const allowed = collections.filter(
    (c) =>
      (!access ||
        can(access, collectionArea[c], "view") ||
        (c === "approvals" && can(access, "finance", "view"))) &&
      (!directory || ["notifications", "audit"].includes(c)),
  );
  const unrestricted =
    !access || access.role === "owner" || !access.branch_ids?.length;
  const rows = await client.query<{
    collection: Collection;
    data: BaseRecord;
    branch_id: string | null;
  }>(
    "SELECT collection,data,branch_id FROM agi_records WHERE workspace_id=$1 AND collection=ANY($2::text[]) AND ($3 OR collection=ANY($4::text[]) OR branch_id=ANY($5::text[])) ORDER BY updated_at DESC,id",
    [
      workspaceId,
      allowed.filter((collection) => collection !== "audit"),
      unrestricted,
      globalCollections,
      access?.branch_ids || [],
    ],
  );
  if (allowed.includes("audit")) {
    const recent = await client.query(
      "SELECT collection,data,branch_id FROM agi_records WHERE workspace_id=$1 AND collection='audit' AND ($2::boolean OR branch_id=ANY($3::text[])) ORDER BY updated_at DESC,id LIMIT 100",
      [workspaceId, unrestricted, access?.branch_ids || []],
    );
    rows.rows.push(...recent.rows);
  }
  for (const row of rows.rows)
    if (collections.includes(row.collection))
      (db[row.collection] as BaseRecord[]).push({
        ...row.data,
        ...(row.branch_id ? { branchId: row.branch_id } : {}),
      });
  const ids = documents.flatMap((c) =>
    (db[c] as BaseRecord[]).map((r) => r.id),
  );
  const lines = await client.query(
    "SELECT * FROM agi_document_lines WHERE workspace_id=$1 AND record_id=ANY($2::text[]) ORDER BY collection,record_id,position",
    [workspaceId, ids],
  );
  for (const collection of documents)
    for (const record of db[collection] as (BaseRecord & {
      items: QuotationItem[];
    })[])
      record.items = [];
  const indexed = new Map(
    documents.flatMap((c) =>
      (db[c] as (BaseRecord & { items: QuotationItem[] })[]).map(
        (r) => [c + ":" + r.id, r] as const,
      ),
    ),
  );
  for (const row of lines.rows)
    indexed.get(row.collection + ":" + row.record_id)?.items.push({
      productId: row.product_id,
      description: row.description,
      quantity: row.quantity,
      unitPrice: Number(row.unit_price),
      discount: Number(row.discount),
      tax: Number(row.tax),
    });
  return db;
}
export async function persistChanges(
  client: PoolClient,
  workspaceId: string,
  before: Database,
  after: Database,
) {
  for (const collection of collections) {
    const previous = new Map(
      (before[collection] as BaseRecord[]).map((row) => [row.id, row]),
    );
    for (const record of after[collection] as unknown as (BaseRecord &
      Record<string, unknown>)[]) {
      if (JSON.stringify(previous.get(record.id)) === JSON.stringify(record))
        continue;
      const data = { ...record };
      const items = documents.includes(collection)
        ? (record.items as QuotationItem[])
        : undefined;
      if (items) delete data.items;
      const branch = branchOf(after, collection, record);
      await client.query(
        "INSERT INTO agi_records(workspace_id,collection,id,branch_id,data) VALUES($1,$2,$3,$4,$5) ON CONFLICT(workspace_id,collection,id) DO UPDATE SET branch_id=excluded.branch_id,data=excluded.data,updated_at=now()",
        [
          workspaceId,
          collection,
          record.id,
          branch || null,
          JSON.stringify(data),
        ],
      );
      await client.query(
        "DELETE FROM agi_record_links WHERE workspace_id=$1 AND source_collection=$2 AND source_id=$3",
        [workspaceId, collection, record.id],
      );
      const links: [string, Collection, string][] = [];
      for (const [field, target] of Object.entries(references))
        if (typeof record[field] === "string" && record[field])
          links.push([field, target, String(record[field])]);
      if (
        collection === "approvals" &&
        ["purchaseOrders", "expenses"].includes(String(record.type)) &&
        record.recordId
      )
        links.push([
          "recordId",
          record.type as Collection,
          String(record.recordId),
        ]);
      // Free-form activity record IDs are intentionally not treated as customer IDs.
      for (const [field, target, id] of links)
        await client.query(
          "INSERT INTO agi_record_links(workspace_id,source_collection,source_id,field,target_collection,target_id) VALUES($1,$2,$3,$4,$5,$6)",
          [workspaceId, collection, record.id, field, target, id],
        );
      if (
        items &&
        JSON.stringify(
          (previous.get(record.id) as { items?: QuotationItem[] } | undefined)
            ?.items,
        ) !== JSON.stringify(items)
      ) {
        await client.query(
          "DELETE FROM agi_document_lines WHERE workspace_id=$1 AND collection=$2 AND record_id=$3",
          [workspaceId, collection, record.id],
        );
        for (const [position, item] of items.entries())
          await client.query(
            "INSERT INTO agi_document_lines(workspace_id,collection,record_id,position,product_id,description,quantity,unit_price,discount,tax) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
            [
              workspaceId,
              collection,
              record.id,
              position,
              item.productId,
              item.description,
              item.quantity,
              item.unitPrice,
              item.discount,
              item.tax,
            ],
          );
      }
    }
  }
  if (JSON.stringify(before.settings) !== JSON.stringify(after.settings))
    await client.query(
      "UPDATE agi_workspaces SET settings=$1,name=$2 WHERE id=$3",
      [JSON.stringify(after.settings), after.settings.company, workspaceId],
    );
}
export async function migrateSnapshots(client: PoolClient) {
  await client.query("BEGIN");
  try {
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('agi-record-storage-v1'))",
    );
    const workspaces = await client.query<{ id: string; data: Database }>(
      "SELECT id,data FROM agi_workspaces WHERE storage_version=0 FOR UPDATE",
    );
    for (const workspace of workspaces.rows) {
      const db = workspace.data;
      await client.query("SELECT set_config('agi.workspace_id',$1,true)", [
        workspace.id,
      ]);
      const branches = new Set(
        collections.flatMap((c) =>
          (db[c] as BaseRecord[]).flatMap((r) =>
            r.branchId ? [r.branchId] : [],
          ),
        ),
      );
      for (const id of branches)
        await client.query(
          "INSERT INTO agi_branches(workspace_id,id,name) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
          [workspace.id, id, id],
        );
      await persistChanges(client, workspace.id, createEmptyDatabase(), db);
      await client.query(
        "UPDATE agi_workspaces SET settings=$1,storage_version=1 WHERE id=$2",
        [JSON.stringify(db.settings), workspace.id],
      );
      for (const c of [
        "organizations",
        "quotations",
        "orders",
        "invoices",
        "purchaseOrders",
        "payments",
        "deliveries",
        "goodsReceipts",
      ])
        await client.query(
          "INSERT INTO agi_sequences(workspace_id,collection,value) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
          [workspace.id, c, db[c as Collection].length],
        );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}
export async function assignNumbers(
  client: PoolClient,
  workspaceId: string,
  before: Database,
  after: Database,
) {
  const prefixes: Partial<Record<Collection, string>> = {
    quotations: after.settings.quotationPrefix || "QT-",
    orders: "SO-",
    invoices: after.settings.invoicePrefix || "INV-",
    purchaseOrders: "PO-",
    deliveries: "DN-",
    goodsReceipts: "GRN-",
  };
  for (const [collection, prefix] of Object.entries(prefixes) as [
    Collection,
    string,
  ][]) {
    const ids = new Set((before[collection] as BaseRecord[]).map((r) => r.id));
    for (const record of after[collection] as BaseRecord[]) {
      if (ids.has(record.id)) continue;
      const result = await client.query(
        "INSERT INTO agi_sequences(workspace_id,collection,value) VALUES($1,$2,1) ON CONFLICT(workspace_id,collection) DO UPDATE SET value=agi_sequences.value+1 RETURNING value",
        [workspaceId, collection],
      );
      record.name = prefix + result.rows[0].value;
    }
  }
  for (const customer of after.organizations) {
    if (before.organizations.some((c) => c.id === customer.id)) continue;
    if (customer.code) continue;
    const result = await client.query(
      "INSERT INTO agi_sequences(workspace_id,collection,value) VALUES($1,'organizations',1) ON CONFLICT(workspace_id,collection) DO UPDATE SET value=agi_sequences.value+1 RETURNING value",
      [workspaceId],
    );
    customer.code = "CUS-" + String(result.rows[0].value).padStart(6, "0");
  }
}

/** Load the command's records and their dependencies, not the entire workspace. */
export async function loadCommandDatabase(
  client: PoolClient,
  workspaceId: string,
  settings: Record<string, string>,
  raw: unknown,
): Promise<Database> {
  const command = raw as {
    action?: string;
    collection?: Collection;
    id?: string;
    record?: Record<string, unknown>;
    values?: Record<string, unknown>;
    payment?: Record<string, unknown>;
    args?: unknown[];
    operation?: string;
  };
  const roots = new Map<string, { collection: Collection; id: string }>();
  const add = (collection: Collection, id: unknown) => {
    if (typeof id === "string" && id)
      roots.set(collection + ":" + id, { collection, id });
  };
  const values = command.record || command.values || command.payment || {};
  for (const [field, collection] of Object.entries(references))
    add(collection, values[field]);
  const items = values.items;
  if (Array.isArray(items))
    for (const item of items) add("products", item.productId);
  if (command.collection && collections.includes(command.collection))
    add(command.collection, command.id || command.record?.id);
  const primary: Record<string, Collection> = {
    receivePayment: "invoices",
    convertQuotation: "quotations",
    orderAction: "orders",
    ticketAction: "tickets",
    approveRequest: "approvals",
    cancelOrder: "orders",
  };
  if (command.action && primary[command.action])
    add(primary[command.action], command.id || command.payment?.invoiceId);
  if (command.action === "transferStock") {
    add("warehouses", command.args?.[0]);
    add("warehouses", command.args?.[1]);
    add("products", command.args?.[2]);
  }
  if (command.action === "receiveGoods") {
    add("purchaseOrders", command.args?.[0]);
    add("warehouses", command.args?.[1]);
  }
  if (command.action === "issuePart") {
    add("tickets", command.args?.[0]);
    add("products", command.args?.[1]);
    add("warehouses", command.args?.[3]);
  }
  if (command.action === "markNotifications") {
    const rows = await client.query(
      "SELECT id FROM agi_records WHERE workspace_id=$1 AND collection='notifications' AND ($2::text IS NULL OR id=$2) AND coalesce((data->>'read')::boolean,false)=false",
      [workspaceId, command.id || null],
    );
    for (const row of rows.rows) add("notifications", row.id);
  }
  if (command.action === "updateSettings") {
    const rows = await client.query(
      "SELECT DISTINCT ON(collection) collection,id FROM agi_records WHERE workspace_id=$1 AND collection=ANY($2::text[]) ORDER BY collection,id",
      [
        workspaceId,
        [
          "products",
          "quotations",
          "orders",
          "invoices",
          "payments",
          "expenses",
          "banks",
          "purchaseOrders",
          "stock",
        ],
      ],
    );
    for (const row of rows.rows) add(row.collection, row.id);
  }
  const fetchGraph = async () =>
    client.query<{
      collection: Collection;
      id: string;
      data: BaseRecord;
      branch_id: string | null;
    }>(
      `WITH RECURSIVE seed AS (SELECT * FROM jsonb_to_recordset($2::jsonb) AS x(collection text,id text)), dependencies(collection,id) AS (
 SELECT collection,id FROM seed UNION
 SELECT edge.target_collection,edge.target_id FROM dependencies d JOIN LATERAL (
 SELECT target_collection,target_id FROM agi_record_links l WHERE l.workspace_id=$1 AND l.source_collection=d.collection AND l.source_id=d.id
 UNION SELECT 'products',product_id FROM agi_document_lines l WHERE l.workspace_id=$1 AND l.collection=d.collection AND l.record_id=d.id
 ) edge ON true)
 SELECT r.collection,r.id,r.data,r.branch_id FROM agi_records r JOIN dependencies d USING(collection,id) WHERE r.workspace_id=$1 ORDER BY r.updated_at DESC,r.id`,
      [workspaceId, JSON.stringify([...roots.values()])],
    );
  const first = await fetchGraph();
  const invoices = first.rows
      .filter((r) => r.collection === "invoices")
      .map((r) => r.id),
    quotes = first.rows
      .filter((r) => r.collection === "quotations")
      .map((r) => r.id),
    orders = first.rows
      .filter((r) => r.collection === "orders")
      .map((r) => r.id),
    purchases = first.rows
      .filter((r) => r.collection === "purchaseOrders")
      .map((r) => r.id),
    products = first.rows
      .filter((r) => r.collection === "products")
      .map((r) => r.id);
  const stockActions = [
    "transferStock",
    "orderAction",
    "receiveGoods",
    "issuePart",
    "cancelOrder",
  ];
  const reverse = await client.query<{ collection: Collection; id: string }>(
    `SELECT collection,id FROM agi_records WHERE workspace_id=$1 AND (
 (collection='payments' AND data->>'invoiceId'=ANY($2::text[])) OR
 (collection='orders' AND data->>'quotationId'=ANY($3::text[])) OR
 (collection='invoices' AND data->>'orderId'=ANY($4::text[])) OR
 (collection='goodsReceipts' AND data->>'purchaseOrderId'=ANY($5::text[])) OR
 (collection='stock' AND $6::boolean AND data->>'productId'=ANY($7::text[])))`,
    [
      workspaceId,
      invoices,
      quotes,
      orders,
      purchases,
      stockActions.includes(command.action || ""),
      products,
    ],
  );
  for (const row of reverse.rows) add(row.collection, row.id);
  const rows = reverse.rowCount ? await fetchGraph() : first;
  const db = createEmptyDatabase(settings.company);
  db.settings = settings;
  const documentMap = new Map<string, { items: QuotationItem[] }>();
  for (const row of rows.rows) {
    const record = {
      ...row.data,
      ...(row.branch_id ? { branchId: row.branch_id } : {}),
    };
    (db[row.collection] as BaseRecord[]).push(record);
    if (documents.includes(row.collection)) {
      const doc = record as BaseRecord & { items: QuotationItem[] };
      doc.items = [];
      documentMap.set(row.collection + ":" + row.id, doc);
    }
  }
  if (documentMap.size) {
    const lines = await client.query(
      "SELECT * FROM agi_document_lines WHERE workspace_id=$1 AND record_id=ANY($2::text[]) ORDER BY position",
      [
        workspaceId,
        rows.rows
          .filter((r) => documents.includes(r.collection))
          .map((r) => r.id),
      ],
    );
    for (const row of lines.rows)
      documentMap.get(row.collection + ":" + row.record_id)?.items.push({
        productId: row.product_id,
        description: row.description,
        quantity: row.quantity,
        unitPrice: Number(row.unit_price),
        discount: Number(row.discount),
        tax: Number(row.tax),
      });
  }
  return db;
}
export function changedRecords(
  before: Database,
  after: Database,
): Partial<Database> {
  const changes: Partial<Database> = {};
  for (const collection of collections) {
    const previous = new Map(
      (before[collection] as BaseRecord[]).map((r) => [
        r.id,
        JSON.stringify(r),
      ]),
    );
    const changed = (after[collection] as BaseRecord[])
      .filter((r) => previous.get(r.id) !== JSON.stringify(r))
      .map((r) => {
        const branch = branchOf(after, collection, r);
        return { ...r, ...(branch ? { branchId: branch } : {}) };
      });
    if (changed.length) (changes[collection] as BaseRecord[]) = changed;
  }
  if (JSON.stringify(before.settings) !== JSON.stringify(after.settings))
    changes.settings = after.settings;
  return changes;
}
