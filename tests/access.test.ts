import { test } from "node:test";
import assert from "node:assert/strict";
import { can, visibleDatabase, branchOf, type Access } from "../lib/access";
import {
  authorizeCommand,
  branchDatabase,
  mergeChanges,
} from "../lib/server/authorization";
import { fixture } from "./fixtures";
const editor: Access = {
  role: "editor",
  grants: { finance: [] },
  branch_ids: ["north"],
};
test("disabled modules override the base role and never grant an action without view", () => {
  assert.equal(can(editor, "finance", "view"), false);
  assert.equal(can(editor, "finance", "edit"), false);
  assert.equal(
    can({ role: "editor", grants: { sales: ["edit"] } }, "sales", "edit"),
    false,
  );
  assert.equal(
    can({ role: "owner", grants: { finance: [] } }, "finance", "approve"),
    true,
  );
});
test("hidden financial records and other branches are excluded from projections", () => {
  const db = fixture();
  db.organizations[0].branchId = "north";
  db.organizations.push({
    ...db.organizations[0],
    id: "south-customer",
    branchId: "south",
  });
  const view = visibleDatabase(db, editor);
  assert.deepEqual(
    view.organizations.map((r) => r.id),
    ["customer"],
  );
  assert.deepEqual(view.invoices, []);
  assert.deepEqual(view.payments, []);
  assert.deepEqual(view.audit, []);
  assert.equal(branchOf(db, "quotations", db.quotations[0]), "north");
  assert.equal(view.products.length, 1);
});
test("warehouse operations require both sales and inventory permissions", () => {
  const db = fixture();
  const access: Access = { role: "editor", grants: { inventory: ["view"] } };
  assert.throws(
    () =>
      authorizeCommand(
        access,
        { action: "orderAction", id: "order", operation: "reserve" },
        db,
      ),
    /inventory/,
  );
  assert.throws(
    () =>
      authorizeCommand(
        editor,
        { action: "orderAction", id: "order", operation: "invoice" },
        db,
      ),
    /finance/,
  );
});
test("an explicit approval grant can approve without acquiring owner administration", () => {
  const db = fixture();
  db.approvals.push({
    id: "approval",
    name: "Approval",
    status: "Pending",
    createdAt: new Date().toISOString(),
    type: "purchaseOrders",
    requestedBy: "Test",
    date: "2026-01-01",
    amount: 200,
    reason: "Test",
    recordId: "po",
  });
  const access: Access = {
    role: "editor",
    grants: { procurement: ["view", "approve"] },
  };
  assert.equal(
    authorizeCommand(
      access,
      { action: "approveRequest", id: "approval", status: "Approved" },
      db,
    ),
    "owner",
  );
  assert.throws(
    () =>
      authorizeCommand(
        access,
        { action: "updateSettings", values: { company: "Changed" } },
        db,
      ),
    /owner/,
  );
});
test("scoped writes preserve hidden records and reject a new outside-branch record", () => {
  const db = fixture();
  db.organizations[0].branchId = "north";
  db.organizations.push({
    ...db.organizations[0],
    id: "south-customer",
    branchId: "south",
  });
  const scoped = branchDatabase(db, editor);
  scoped.organizations[0].name = "North updated";
  const merged = mergeChanges(db, scoped, editor);
  assert.equal(
    merged.organizations.find((r) => r.id === "south-customer")?.name,
    "Example customer",
  );
  scoped.organizations[0].branchId = "south";
  assert.throws(() => mergeChanges(db, scoped, editor), /outside/);
});
test("a viewer can only write a module when the owner explicitly grants that action", () => {
  const db = fixture();
  assert.throws(
    () =>
      authorizeCommand(
        { role: "viewer" },
        {
          action: "update",
          collection: "organizations",
          id: "customer",
          values: { name: "Changed" },
        },
        db,
      ),
    /access/,
  );
  assert.equal(
    authorizeCommand(
      { role: "viewer", grants: { customers: ["view", "edit"] } },
      {
        action: "update",
        collection: "organizations",
        id: "customer",
        values: { name: "Changed" },
      },
      db,
    ),
    "editor",
  );
});
