import { test } from "node:test";
import assert from "node:assert/strict";
import { createEmptyDatabase } from "../lib/database/empty";
import {
  createEngine,
  invoiceBalance,
  customerBalance,
} from "../lib/services/engine";
import { executeCommand } from "../lib/server/commands";
import { totals } from "../lib/utils";
import { fixture } from "./fixtures";

test("new workspaces contain no business records", () => {
  const db = createEmptyDatabase();
  for (const [key, value] of Object.entries(db))
    if (key !== "settings") assert.deepEqual(value, []);
  assert.equal(db.settings.currency, "USD");
});
test("discounts apply before tax and monetary totals round to cents", () => {
  assert.deepEqual(
    totals([
      {
        productId: "x",
        description: "x",
        quantity: 2,
        unitPrice: 100,
        discount: 10,
        tax: 18,
      },
    ]),
    { subtotal: 200, discount: 20, tax: 32.4, total: 212.4 },
  );
  assert.equal(
    totals([
      {
        productId: "x",
        description: "x",
        quantity: 3,
        unitPrice: 0.1,
        discount: 0,
        tax: 0,
      },
    ]).total,
    0.3,
  );
});
test("draft and cancelled invoices do not create receivables", () => {
  const db = fixture();
  db.invoices[0].status = "Draft";
  assert.equal(invoiceBalance(db, "invoice"), 0);
  assert.equal(customerBalance(db, "customer"), 0);
  db.invoices[0].status = "Cancelled";
  assert.equal(invoiceBalance(db, "invoice"), 0);
});
test("payment ownership, finite values, balance and duplicate receipts are enforced", () => {
  const engine = createEngine(fixture(), "Test actor");
  const payment = {
    id: "payment",
    name: "REC-1",
    status: "Received",
    createdAt: new Date().toISOString(),
    organizationId: "customer",
    invoiceId: "invoice",
    amount: 200,
    date: "2026-01-01",
    bankId: "bank",
    method: "Bank Transfer",
    reference: "ref",
    receivedBy: "Test actor",
  };
  assert.throws(
    () => engine.receivePayment({ ...payment, organizationId: "other" }),
    /belonging/,
  );
  assert.throws(
    () => engine.receivePayment({ ...payment, amount: NaN }),
    /positive/,
  );
  assert.throws(
    () => engine.receivePayment({ ...payment, amount: 201 }),
    /exceed/,
  );
  engine.receivePayment({ ...payment, amount: 100 });
  assert.equal(invoiceBalance(engine.getSnapshot(), "invoice"), 100);
  assert.throws(
    () => engine.receivePayment({ ...payment, amount: 50 }),
    /already/,
  );
});
test("orders cannot bypass reservation or delivery with generic updates", () => {
  const engine = createEngine(fixture());
  const id = engine.convertQuotation("quote");
  assert.throws(
    () => engine.repository("orders").update(id, { status: "Delivered" }),
    /workflow/,
  );
  assert.throws(() => engine.orderAction(id, "deliver"), /Reserve/);
  assert.throws(() => engine.convertQuotation("quote"), /already/);
});
test("reservations belong to an order and cancellation releases its stock", () => {
  const engine = createEngine(fixture());
  const id = engine.convertQuotation("quote");
  engine.orderAction(id, "reserve");
  assert.deepEqual(engine.getSnapshot().orders[0].allocations, [
    { productId: "product", warehouseId: "warehouse-a", quantity: 2 },
  ]);
  engine.cancelOrder(id);
  assert.equal(
    engine.getSnapshot().stock.reduce((sum, s) => sum + s.reserved, 0),
    0,
  );
  assert.equal(engine.getSnapshot().orders[0].status, "Cancelled");
});
test("delivery consumes only the stock allocated to this order and invoices once", () => {
  const engine = createEngine(fixture());
  const id = engine.convertQuotation("quote");
  engine.orderAction(id, "reserve");
  engine.orderAction(id, "deliver");
  assert.equal(engine.getSnapshot().stock[0].quantity, 8);
  assert.equal(engine.getSnapshot().stock[1].quantity, 10);
  assert.equal(engine.getSnapshot().deliveries[0].warehouseId, "warehouse-a");
  const invoice = engine.orderAction(id, "invoice");
  assert.equal(invoiceBalance(engine.getSnapshot(), invoice), 0);
  assert.throws(() => engine.orderAction(id, "invoice"), /already/);
});
test("failed stock operations are atomic and reject unknown destinations", () => {
  const engine = createEngine(fixture());
  const before = engine.getSnapshot();
  assert.throws(
    () =>
      engine.transferStock(
        "warehouse-a",
        "warehouse-b",
        "product",
        99,
        "ref",
        "",
      ),
    /Insufficient/,
  );
  assert.equal(engine.getSnapshot(), before);
  assert.throws(
    () =>
      engine.transferStock("warehouse-a", "unknown", "product", 1, "ref", ""),
    /Destination/,
  );
  assert.equal(engine.getSnapshot(), before);
});
test("receiving and service parts update the same warehouse stock", () => {
  const engine = createEngine(fixture(), "Verified user");
  engine.receiveGoods("po", "warehouse-a", "GRN-REF");
  assert.equal(engine.getSnapshot().stock[0].quantity, 12);
  assert.throws(
    () => engine.receiveGoods("po", "warehouse-a", "DUP"),
    /approved|already/,
  );
  engine.issuePart("ticket", "product", 3, "warehouse-a");
  assert.equal(engine.getSnapshot().stock[0].quantity, 9);
  assert.deepEqual(engine.getSnapshot().tickets[0].parts, [
    { productId: "product", quantity: 3 },
  ]);
  assert.ok(
    engine.getSnapshot().audit.every((a) => a.user === "Verified user"),
  );
});
test("server commands enforce read-only access and owner-only settings", () => {
  const db = fixture();
  assert.throws(
    () =>
      executeCommand(
        db,
        {
          action: "update",
          collection: "organizations",
          id: "customer",
          values: { name: "Changed" },
        },
        "Viewer",
        "viewer",
      ),
    /read-only/,
  );
  assert.throws(
    () =>
      executeCommand(
        db,
        { action: "updateSettings", values: { company: "Changed" } },
        "Editor",
        "editor",
      ),
    /owner/,
  );
  assert.equal(db.organizations[0].name, "Example customer");
});
test("server rejects invalid values and links to records outside the workspace", () => {
  const db = fixture();
  assert.throws(
    () =>
      executeCommand(
        db,
        {
          action: "update",
          collection: "organizations",
          id: "customer",
          values: { creditLimit: -1 },
        },
        "Owner",
        "owner",
      ),
    /invalid/,
  );
  assert.throws(
    () =>
      executeCommand(
        db,
        {
          action: "update",
          collection: "quotations",
          id: "quote",
          values: { organizationId: "outside" },
        },
        "Owner",
        "owner",
      ),
    /exist|workspace/,
  );
});
