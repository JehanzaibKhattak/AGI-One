import { createSeed } from "@/lib/mock-data/seed";
import type { Database, Collection, Entity, QuotationItem } from "@/types";
import { totals } from "@/lib/utils";
const KEY = "amss-one:v1";
let database = createSeed();
const serverDatabase = database;
const listeners = new Set<() => void>();
let loaded = false;
export function getSnapshot() {
  return database;
}
export function getServerSnapshot() {
  return serverDatabase;
}
export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function initialize() {
  if (loaded) return;
  loaded = true;
  const raw = localStorage.getItem(KEY);
  if (raw) {
    const parsed = JSON.parse(raw);
    if (
      parsed.version !== 1 ||
      !parsed.data?.organizations ||
      !parsed.data?.products
    )
      throw new Error(
        "The saved demo data is incompatible. Reset the demo to continue.",
      );
    database = parsed.data;
  }
  listeners.forEach((l) => l());
}
export function commit(change: (draft: Database) => void) {
  const draft = structuredClone(database);
  change(draft);
  if (typeof window !== "undefined")
    localStorage.setItem(KEY, JSON.stringify({ version: 1, data: draft }));
  database = draft;
  listeners.forEach((l) => l());
}
export function resetDemo() {
  if (typeof window !== "undefined") localStorage.removeItem(KEY);
  database = createSeed();
  loaded = true;
  listeners.forEach((l) => l());
}
export const uid = (prefix: string) =>
  `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
function audit(
  draft: Database,
  module: string,
  action: string,
  record: string,
  before: string,
  after: string,
) {
  draft.audit.unshift({
    id: uid("audit"),
    name: `${action} ${record}`,
    status: "Recorded",
    createdAt: new Date().toISOString(),
    user: "Admin",
    module,
    action,
    record,
    before,
    after,
    device: "Demo browser",
  });
}
export function repository<K extends Collection>(collection: K) {
  return {
    getAll: () => database[collection] as Entity<K>[],
    getById: (id: string) =>
      (database[collection] as Entity<K>[]).find((r) => r.id === id),
    create: (record: Entity<K>) =>
      commit((d) => {
        (d[collection] as Entity<K>[]).unshift(record);
        audit(d, collection, "Created", record.name, "", record.status);
      }),
    update: (id: string, values: Partial<Entity<K>>) =>
      commit((d) => {
        const record = (d[collection] as Entity<K>[]).find((r) => r.id === id);
        if (!record) throw new Error("This record could not be found.");
        const before = JSON.stringify(record);
        Object.assign(record, values);
        audit(
          d,
          collection,
          "Updated",
          record.name,
          before,
          JSON.stringify(values),
        );
      }),
  };
}
export const customerService = repository("organizations");
export const quotationService = repository("quotations");
export const inventoryService = {
  ...repository("products"),
  getStock: () => database.stock,
};
export const invoiceService = repository("invoices");
export const ticketService = repository("tickets");
export function paidAmount(db: Database, invoiceId: string) {
  return db.payments
    .filter((p) => p.invoiceId === invoiceId)
    .reduce((s, p) => s + p.amount, 0);
}
export function invoiceBalance(db: Database, invoiceId: string) {
  const inv = db.invoices.find((i) => i.id === invoiceId);
  return !inv || inv.status === "Cancelled"
    ? 0
    : Math.max(0, totals(inv.items).total - paidAmount(db, invoiceId));
}
export function customerBalance(db: Database, organizationId: string) {
  return db.invoices
    .filter((i) => i.organizationId === organizationId)
    .reduce((s, i) => s + invoiceBalance(db, i.id), 0);
}
export function receivePayment(payment: Database["payments"][number]) {
  commit((d) => {
    const invoice = d.invoices.find((i) => i.id === payment.invoiceId);
    if (!invoice || invoice.organizationId !== payment.organizationId)
      throw new Error("Choose an invoice belonging to this customer.");
    if (invoice.status === "Cancelled" || invoice.status === "Draft")
      throw new Error("Payments require an issued invoice.");
    if (
      payment.amount <= 0 ||
      payment.amount > invoiceBalance(d, invoice.id) + 0.005
    )
      throw new Error(
        "Payment must be positive and cannot exceed the outstanding balance.",
      );
    d.payments.unshift(payment);
    invoice.status =
      invoiceBalance(d, invoice.id) < 0.01 ? "Paid" : "Partially Paid";
    audit(d, "payments", "Received", payment.name, "", String(payment.amount));
  });
}
export function transferStock(
  from: string,
  to: string,
  productId: string,
  quantity: number,
  reference: string,
  notes: string,
) {
  commit((d) => {
    if (from === to)
      throw new Error("Choose different source and destination warehouses.");
    if (!Number.isInteger(quantity) || quantity <= 0)
      throw new Error("Enter a positive whole quantity.");
    const source = d.stock.find(
      (s) => s.productId === productId && s.warehouseId === from,
    );
    if (!source || source.quantity - source.reserved < quantity)
      throw new Error("Insufficient available stock in the source warehouse.");
    source.quantity -= quantity;
    let destination = d.stock.find(
      (s) => s.productId === productId && s.warehouseId === to,
    );
    if (!destination) {
      destination = {
        id: uid("stock"),
        name: "Transferred stock",
        status: "Available",
        createdAt: new Date().toISOString(),
        productId,
        warehouseId: to,
        quantity: 0,
        reserved: 0,
      };
      d.stock.push(destination);
    }
    destination.quantity += quantity;
    d.transactions.unshift({
      id: uid("txn"),
      name: reference || "Stock transfer",
      status: "Transferred",
      createdAt: new Date().toISOString(),
      productId,
      warehouseId: from,
      toWarehouseId: to,
      quantity,
      reference,
      notes,
      date: new Date().toISOString(),
    });
    audit(d, "stock", "Transferred", productId, from, to);
  });
}
export function convertQuotation(id: string) {
  let orderId = "";
  commit((d) => {
    const q = d.quotations.find((q) => q.id === id);
    if (!q) throw new Error("Quotation not found.");
    if (d.orders.some((o) => o.quotationId === id))
      throw new Error("This quotation already has a sales order.");
    if (["Rejected", "Expired"].includes(q.status))
      throw new Error("Only active quotations can be converted.");
    orderId = uid("ord");
    q.status = "Accepted";
    d.orders.unshift({
      id: orderId,
      name: `SO-2026-${200 + d.orders.length + 1}`,
      status: "Confirmed",
      createdAt: new Date().toISOString(),
      organizationId: q.organizationId,
      quotationId: id,
      date: new Date().toISOString().slice(0, 10),
      expectedDelivery: "2026-10-15",
      total: totals(q.items).total,
      fulfilment: "0%",
      payment: "Unpaid",
      items: structuredClone(q.items),
    });
    audit(d, "orders", "Converted", q.name, "Quotation", "Sales Order");
  });
  return orderId;
}
export function orderAction(
  id: string,
  action: "reserve" | "deliver" | "invoice",
) {
  let result = "";
  commit((d) => {
    const order = d.orders.find((o) => o.id === id);
    if (!order) throw new Error("Order not found.");
    if (action === "reserve") {
      if (order.status !== "Confirmed")
        throw new Error("Only confirmed orders can be reserved.");
      const required = new Map<string, number>();
      order.items.forEach((i) =>
        required.set(
          i.productId,
          (required.get(i.productId) || 0) + i.quantity,
        ),
      );
      for (const [productId, quantity] of required) {
        let remaining = quantity;
        const stocks = d.stock.filter((s) => s.productId === productId);
        if (stocks.reduce((s, x) => s + x.quantity - x.reserved, 0) < quantity)
          throw new Error("Insufficient stock to reserve this order.");
        for (const stock of stocks) {
          const count = Math.min(remaining, stock.quantity - stock.reserved);
          stock.reserved += count;
          remaining -= count;
        }
      }
      order.status = "Reserved";
    } else if (action === "deliver") {
      if (order.status !== "Reserved")
        throw new Error("Reserve stock before creating a delivery.");
      for (const item of order.items) {
        let remaining = item.quantity;
        for (const s of d.stock.filter((s) => s.productId === item.productId)) {
          const count = Math.min(remaining, s.reserved);
          s.reserved -= count;
          s.quantity -= count;
          remaining -= count;
          if (count)
            d.transactions.unshift({
              id: uid("txn"),
              name: order.name,
              status: "Delivered",
              createdAt: new Date().toISOString(),
              productId: s.productId,
              warehouseId: s.warehouseId,
              toWarehouseId: "",
              quantity: -count,
              reference: order.name,
              date: new Date().toISOString(),
            });
        }
      }
      order.status = "Delivered";
      order.fulfilment = "100%";
      d.deliveries.unshift({
        id: uid("del"),
        name: `DN-${d.deliveries.length + 101}`,
        status: "Delivered",
        createdAt: new Date().toISOString(),
        organizationId: order.organizationId,
        orderId: id,
        date: new Date().toISOString(),
        warehouseId: "wh-1",
        reference: order.name,
      });
    } else {
      if (order.status !== "Delivered")
        throw new Error("Deliver the order before invoicing.");
      if (d.invoices.some((i) => i.orderId === id))
        throw new Error("This order has already been invoiced.");
      result = uid("inv");
      d.invoices.unshift({
        id: result,
        name: `INV-${8891 + d.invoices.length}`,
        status: "Draft",
        createdAt: new Date().toISOString(),
        organizationId: order.organizationId,
        orderId: id,
        date: new Date().toISOString().slice(0, 10),
        dueDate: new Date(Date.now() + 30 * 86400000)
          .toISOString()
          .slice(0, 10),
        owner: "Ahmed Khan",
        items: structuredClone(order.items),
      });
    }
    audit(d, "orders", action, order.name, "", order.status);
  });
  return result;
}
export function ticketAction(
  id: string,
  name: string,
  description: string,
  values: Partial<Database["tickets"][number]> = {},
) {
  commit((d) => {
    const ticket = d.tickets.find((t) => t.id === id);
    if (!ticket) throw new Error("Ticket not found.");
    Object.assign(ticket, values);
    d.serviceActivities.unshift({
      id: uid("sa"),
      name,
      status: "Recorded",
      createdAt: new Date().toISOString(),
      ticketId: id,
      date: new Date().toISOString(),
      user: "Admin",
      description,
    });
    audit(d, "tickets", name, ticket.name, "", description);
  });
}
export function purchaseTotal(
  items: QuotationItem[],
  rate: number,
  costs: number[],
) {
  return totals(items).total * rate + costs.reduce((a, b) => a + b, 0);
}
export function approveRequest(id: string, status: string) {
  commit((d) => {
    const approval = d.approvals.find((a) => a.id === id);
    if (!approval) throw new Error("Approval not found.");
    approval.status = status;
    if (approval.recordId) {
      const record = [...d.purchaseOrders, ...d.expenses].find(
        (r) => r.id === approval.recordId,
      );
      if (record) record.status = status;
    }
    audit(d, "approvals", status, approval.name, "Pending", status);
  });
}
