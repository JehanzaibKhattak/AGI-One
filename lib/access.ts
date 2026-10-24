import type { BaseRecord, Collection, Database } from "@/types";
export const areas = [
  "customers",
  "sales",
  "inventory",
  "procurement",
  "service",
  "finance",
  "tenders",
  "reports",
  "administration",
] as const;
export const actions = ["view", "create", "edit", "approve", "export"] as const;
export type Area = (typeof areas)[number];
export type AccessAction = (typeof actions)[number];
export type Grants = Partial<Record<Area, AccessAction[]>>;
export type Access = {
  role: "owner" | "editor" | "viewer";
  grants?: Grants;
  branch_ids?: string[];
};
export type Branch = { id: string; name: string };
export const collectionArea: Record<Collection, Area> = {
  organizations: "customers",
  contacts: "customers",
  opportunities: "sales",
  activities: "customers",
  quotations: "sales",
  orders: "sales",
  deliveries: "sales",
  products: "inventory",
  categories: "inventory",
  stock: "inventory",
  warehouses: "inventory",
  transactions: "inventory",
  batches: "inventory",
  serials: "inventory",
  suppliers: "procurement",
  purchaseOrders: "procurement",
  goodsReceipts: "procurement",
  purchaseRequests: "procurement",
  equipment: "service",
  tickets: "service",
  serviceActivities: "service",
  engineers: "service",
  maintenance: "service",
  contracts: "service",
  invoices: "finance",
  payments: "finance",
  expenses: "finance",
  banks: "finance",
  journals: "finance",
  tenders: "tenders",
  notifications: "customers",
  approvals: "procurement",
  users: "administration",
  roles: "administration",
  audit: "administration",
};
export function can(access: Access, area: Area, action: AccessAction) {
  if (access.role === "owner") return true;
  const override = access.grants?.[area];
  if (override) return override.includes("view") && override.includes(action);
  if (area === "administration") return false;
  if (action === "view" || action === "export") return true;
  return access.role === "editor" && ["create", "edit"].includes(action);
}
export const globalCollections: Collection[] = [
  "products",
  "categories",
  "suppliers",
  "engineers",
  "serials",
];
export function branchOf(
  db: Database,
  collection: Collection,
  record: BaseRecord,
  seen = new Set<string>(),
): string | undefined {
  const key = collection + ":" + record.id;
  if (seen.has(key)) return;
  seen.add(key);
  if (record.branchId) return record.branchId;
  const row = record as BaseRecord & Record<string, unknown>;
  const parents: [string, Collection][] = [
    ["organizationId", "organizations"],
    ["orderId", "orders"],
    ["invoiceId", "invoices"],
    ["ticketId", "tickets"],
    ["equipmentId", "equipment"],
    ["purchaseOrderId", "purchaseOrders"],
    ["warehouseId", "warehouses"],
  ];
  if (
    collection === "approvals" &&
    ["purchaseOrders", "expenses"].includes(String(row.type))
  )
    parents.push(["recordId", row.type as Collection]);
  for (const [field, parent] of parents) {
    if (!row[field]) continue;
    const linked = (db[parent] as BaseRecord[]).find(
      (r) => r.id === row[field],
    );
    if (linked) {
      const branch = branchOf(db, parent, linked, seen);
      if (branch) return branch;
    }
  }
}
export function inBranch(
  access: Access,
  collection: Collection,
  branch?: string,
) {
  return (
    access.role === "owner" ||
    !access.branch_ids?.length ||
    globalCollections.includes(collection) ||
    Boolean(branch && access.branch_ids.includes(branch))
  );
}
export function visibleDatabase(db: Database, access: Access) {
  const result = structuredClone(db);
  for (const key of Object.keys(result) as (keyof Database)[]) {
    if (key === "settings") continue;
    const rows = (result[key] as BaseRecord[]).filter(
      (row) =>
        can(
          access,
          key === "approvals" &&
            (row as BaseRecord & { type?: string }).type === "expenses"
            ? "finance"
            : collectionArea[key],
          "view",
        ) && inBranch(access, key, branchOf(db, key, row)),
    );
    (result[key] as BaseRecord[]) = rows;
  }
  return result;
}
export function areaForPath(path: string): Area | undefined {
  if (path.startsWith("/settings"))
    return path === "/settings" ? undefined : "administration";
  if (path.startsWith("/crm")) return "customers";
  if (path.startsWith("/sales")) return "sales";
  if (path.startsWith("/inventory")) return "inventory";
  if (path.startsWith("/procurement")) return "procurement";
  if (path.startsWith("/service")) return "service";
  if (path.startsWith("/finance")) return "finance";
  if (path.startsWith("/tenders")) return "tenders";
  if (path.startsWith("/reports")) return "reports";
}
