import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./fixtures";
import {
  defaultPipeline,
  configurePipeline,
  opportunityOutcome,
} from "../lib/services/sales";
import { executeCommand } from "../lib/server/commands";
import { authorizeCommand, branchDatabase } from "../lib/server/authorization";
function salesFixture() {
  const db = fixture();
  db.pipelines.push(structuredClone(defaultPipeline));
  db.leads.push({
    id: "lead",
    name: "Alex",
    company: "Example business",
    email: "alex@example.com",
    phone: "",
    source: "Website",
    owner: "Seller",
    value: 1000,
    closeDate: "2026-10-31",
    status: "Qualified",
    createdAt: "2026-01-01T00:00:00Z",
    branchId: "north",
  });
  return db;
}
test("qualified lead conversion is atomic, branch-preserving, linked and cannot repeat", () => {
  const db = salesFixture();
  const { data, result } = executeCommand(
    db,
    { action: "convertLead", id: "lead", pipelineId: "default" },
    "Seller",
    "owner",
  );
  assert.equal(db.leads[0].status, "Qualified");
  assert.equal(db.organizations.length, 1);
  assert.equal(data.organizations.length, 2);
  assert.equal(data.contacts.length, 1);
  assert.equal(data.opportunities.length, 1);
  assert.equal(data.leads[0].opportunityId, result);
  assert.equal(
    data.opportunities[0].organizationId,
    data.leads[0].organizationId,
  );
  assert.equal(data.opportunities[0].branchId, "north");
  assert.equal(data.opportunities[0].probability, 10);
  assert.throws(
    () =>
      executeCommand(
        data,
        { action: "convertLead", id: "lead", pipelineId: "default" },
        "Seller",
        "owner",
      ),
    /Qualify|already/,
  );
  assert.throws(
    () =>
      executeCommand(
        db,
        {
          action: "convertLead",
          id: "lead",
          organizationId: "customer",
          pipelineId: "default",
        },
        "Seller",
        "owner",
      ),
    /same branch/,
  );
});
test("lead conversion respects module and branch access and cannot be forged through create/update", () => {
  const db = salesFixture(),
    command = { action: "convertLead", id: "lead", pipelineId: "default" };
  assert.throws(
    () =>
      authorizeCommand(
        { role: "editor", grants: { customers: ["view"] } },
        command,
        db,
      ),
    /create/,
  );
  assert.throws(
    () =>
      executeCommand(
        branchDatabase(db, { role: "editor", branch_ids: ["south"] }),
        command,
        "Seller",
        "editor",
      ),
    /Qualify/,
  );
  assert.throws(
    () =>
      executeCommand(
        db,
        {
          action: "update",
          collection: "leads",
          id: "lead",
          values: { status: "Converted" },
        },
        "Seller",
        "owner",
      ),
    /conversion|Converted/,
  );
  assert.throws(
    () =>
      executeCommand(
        db,
        {
          action: "create",
          collection: "leads",
          record: { ...db.leads[0], id: "forged", opportunityId: "external" },
        },
        "Seller",
        "owner",
      ),
    /conversion/,
  );
});
test("pipeline edits preserve stage identity, rename deals and reject destructive stage/outcome changes", () => {
  const db = executeCommand(
    salesFixture(),
    { action: "convertLead", id: "lead", pipelineId: "default" },
    "Seller",
    "owner",
  ).data;
  const stages = structuredClone(defaultPipeline.stages);
  stages[0].name = "Discovery";
  stages[0].probability = 35;
  const updated = configurePipeline(
    db,
    "default",
    "Enterprise",
    stages,
    "Owner",
  ).data;
  assert.equal(updated.opportunities[0].status, "Discovery");
  assert.equal(updated.opportunities[0].probability, 35);
  assert.throws(
    () =>
      configurePipeline(
        updated,
        "default",
        "Enterprise",
        stages.slice(1),
        "Owner",
      ),
    /Move opportunities/,
  );
  const changed = structuredClone(stages);
  changed[0].outcome = "lost";
  changed[0].probability = 0;
  assert.throws(
    () => configurePipeline(updated, "default", "Enterprise", changed, "Owner"),
    /cannot change/,
  );
  const won = executeCommand(
    updated,
    {
      action: "update",
      collection: "opportunities",
      id: updated.opportunities[0].id,
      values: { stageId: "won", status: "Won", probability: 100 },
    },
    "Seller",
    "owner",
  ).data;
  assert.equal(opportunityOutcome(won.opportunities[0]), "won");
  assert.throws(
    () =>
      executeCommand(
        updated,
        {
          action: "update",
          collection: "opportunities",
          id: updated.opportunities[0].id,
          values: { probability: 99 },
        },
        "Seller",
        "owner",
      ),
    /configured probability/,
  );
  assert.throws(
    () =>
      authorizeCommand(
        { role: "editor" },
        { action: "configurePipeline", id: "default", name: "Forged", stages },
        db,
      ),
    /Only the owner/,
  );
});
test("task reminders require an absolute time at or before due time", () => {
  const db = salesFixture();
  const task = {
    id: "task",
    name: "Follow up",
    status: "Open",
    createdAt: new Date().toISOString(),
    assigneeId: "member",
    dueAt: "2026-10-25T10:00:00.000Z",
    reminderAt: "2026-10-25T09:00:00.000Z",
    priority: "High",
    leadId: "lead",
  };
  assert.equal(
    executeCommand(
      db,
      { action: "create", collection: "tasks", record: task },
      "Seller",
      "owner",
    ).data.tasks.length,
    1,
  );
  assert.throws(
    () =>
      executeCommand(
        db,
        {
          action: "create",
          collection: "tasks",
          record: { ...task, reminderAt: "2026-10-26T09:00:00.000Z" },
        },
        "Seller",
        "owner",
      ),
    /reminder/,
  );
  assert.throws(
    () =>
      executeCommand(
        db,
        {
          action: "create",
          collection: "tasks",
          record: { ...task, dueAt: "2026-10-25T10:00" },
        },
        "Seller",
        "owner",
      ),
    /invalid/,
  );
});
