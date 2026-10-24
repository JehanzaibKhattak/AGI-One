import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  getSnapshot,
  resetDemo,
  transferStock,
  receivePayment,
  invoiceBalance,
  convertQuotation,
  orderAction,
  repository,
  ticketAction,
  approveRequest,
  purchaseTotal,
} from "../lib/services/repository";
import { totals } from "../lib/utils";
beforeEach(() => resetDemo());
test("line-item tax applies after discounts and landed costs convert currency once", () => {
  const items = [
    {
      productId: "prd-1",
      description: "Instrument",
      quantity: 2,
      unitPrice: 100,
      discount: 10,
      tax: 18,
    },
  ];
  assert.deepEqual(totals(items), {
    subtotal: 200,
    discount: 20,
    tax: 32.4,
    total: 212.4,
  });
  assert.equal(purchaseTotal(items, 280, [1000, 200]), 60672);
});
test("warehouse transfer preserves total quantity and reserved stock", () => {
  const before = getSnapshot();
  const qty = before.stock
    .filter((s) => s.productId === "prd-3")
    .reduce((s, r) => s + r.quantity, 0);
  transferStock("wh-1", "wh-2", "prd-3", 2, "TEST-TRANSFER", "Replenishment");
  const after = getSnapshot();
  assert.equal(
    after.stock
      .filter((s) => s.productId === "prd-3")
      .reduce((s, r) => s + r.quantity, 0),
    qty,
  );
  assert.equal(
    after.stock.find((s) => s.productId === "prd-3" && s.warehouseId === "wh-1")
      ?.reserved,
    2,
  );
  assert.equal(after.transactions[0].reference, "TEST-TRANSFER");
});
test("invalid transfers are atomic", () => {
  const before = getSnapshot();
  assert.throws(
    () => transferStock("wh-1", "wh-1", "prd-1", 1, "", ""),
    /different/,
  );
  assert.throws(
    () => transferStock("wh-1", "wh-2", "prd-1", 999, "", ""),
    /Insufficient/,
  );
  assert.equal(getSnapshot(), before);
});
test("payment belongs to invoice customer and cannot overpay", () => {
  const invoice = getSnapshot().invoices[0];
  const balance = invoiceBalance(getSnapshot(), invoice.id);
  const payment = {
    id: "test-pay",
    name: "REC-TEST",
    status: "Received",
    createdAt: "2026-09-18",
    organizationId: invoice.organizationId,
    invoiceId: invoice.id,
    amount: balance,
    date: "2026-09-18",
    bankId: "bank-1",
    method: "Bank Transfer",
    reference: "test",
    receivedBy: "Admin",
  };
  assert.throws(
    () => receivePayment({ ...payment, organizationId: "org-12" }),
    /belonging/,
  );
  assert.throws(
    () => receivePayment({ ...payment, amount: balance + 1 }),
    /cannot exceed/,
  );
  receivePayment(payment);
  assert.equal(invoiceBalance(getSnapshot(), invoice.id), 0);
  assert.equal(
    getSnapshot().invoices.find((i) => i.id === invoice.id)?.status,
    "Paid",
  );
});
test("quotation converts once while retaining the same organization and items", () => {
  const q = getSnapshot().quotations[8];
  const id = convertQuotation(q.id);
  const order = getSnapshot().orders.find((o) => o.id === id)!;
  assert.equal(order.organizationId, q.organizationId);
  assert.deepEqual(order.items, q.items);
  assert.throws(() => convertQuotation(q.id), /already/);
});
test("sales workflow reserves then consumes stock and prevents duplicate invoice", () => {
  const q = getSnapshot().quotations[8];
  const orderId = convertQuotation(q.id);
  assert.throws(() => orderAction(orderId, "deliver"), /Reserve/);
  const before = getSnapshot()
    .stock.filter((s) => s.productId === "prd-1")
    .reduce((a, s) => a + s.quantity, 0);
  orderAction(orderId, "reserve");
  assert.equal(
    getSnapshot().orders.find((o) => o.id === orderId)?.status,
    "Reserved",
  );
  assert.throws(() => orderAction(orderId, "reserve"), /Only confirmed/);
  orderAction(orderId, "deliver");
  assert.equal(
    getSnapshot()
      .stock.filter((s) => s.productId === "prd-1")
      .reduce((a, s) => a + s.quantity, 0),
    before - 1,
  );
  const invId = orderAction(orderId, "invoice");
  assert.equal(
    getSnapshot().invoices.find((i) => i.id === invId)?.organizationId,
    q.organizationId,
  );
  assert.throws(() => orderAction(orderId, "invoice"), /already/);
});
test("service updates and approvals leave linked activity", () => {
  ticketAction("ticket-1", "Resolved", "QC passed", { status: "Resolved" });
  assert.equal(getSnapshot().tickets[0].status, "Resolved");
  assert.equal(getSnapshot().serviceActivities[0].description, "QC passed");
  approveRequest("ap-1", "Approved");
  assert.equal(getSnapshot().purchaseOrders[0].status, "Approved");
  assert.equal(getSnapshot().approvals[0].status, "Approved");
  assert.ok(getSnapshot().audit.length >= 3);
});
test("customer edit is shared across dependent modules without copying names", () => {
  repository("organizations").update("org-1", {
    name: "Updated diagnostic centre",
  });
  const db = getSnapshot();
  assert.equal(db.organizations[0].name, "Updated diagnostic centre");
  assert.equal(db.equipment[0].organizationId, "org-1");
  assert.equal(db.invoices[0].organizationId, "org-1");
  assert.equal(db.contacts[0].organizationId, "org-1");
});
