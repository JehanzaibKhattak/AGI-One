import { defaultPipeline } from "../lib/services/sales";
import { executeCommand } from "../lib/server/commands";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { createEmptyDatabase } from "../lib/database/empty";
import {
  loadDatabase,
  loadCommandDatabase,
  persistChanges,
} from "../lib/server/records";
import { listRecords } from "../lib/server/list-records";
import { fixture } from "./fixtures";
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
async function setup(client: PoolClient, id: string) {
  const empty = createEmptyDatabase("Integration workspace");
  await client.query(
    "INSERT INTO agi_workspaces(id,name,data,settings,storage_version) VALUES($1,$2,$3,$4,1)",
    [
      id,
      "Integration workspace",
      JSON.stringify(empty),
      JSON.stringify(empty.settings),
    ],
  );
  await client.query("SELECT set_config('agi.workspace_id',$1,true)", [id]);
  return empty;
}
test("relational storage, constrained references, branch paging and targeted command loads", async () => {
  const client = await pool.connect();
  await client.query("BEGIN");
  const id = randomUUID();
  try {
    const empty = await setup(client, id);
    const db = fixture();
    db.organizations[0].branchId = "north";
    await client.query(
      "INSERT INTO agi_branches(workspace_id,id,name) VALUES($1,'north','North'),($1,'south','South')",
      [id],
    );
    await persistChanges(client, id, empty, db);
    await client.query("SET CONSTRAINTS ALL IMMEDIATE");
    const loaded = await loadDatabase(client, id, db.settings);
    assert.equal(loaded.quotations[0].items[0].unitPrice, 100);
    assert.equal(loaded.contacts.length, 0);
    assert.equal(
      (
        await client.query(
          "SELECT data ? 'items' AS duplicated FROM agi_records WHERE workspace_id=$1 AND collection='quotations'",
          [id],
        )
      ).rows[0].duplicated,
      false,
    );
    await client.query("SAVEPOINT invalid_link");
    await assert.rejects(
      client.query(
        "INSERT INTO agi_record_links(workspace_id,source_collection,source_id,field,target_collection,target_id) VALUES($1,'organizations','customer','invalid','organizations','outside')",
        [id],
      ),
      (error: unknown) => (error as { code: string }).code === "23503",
    );
    await client.query("ROLLBACK TO SAVEPOINT invalid_link");
    await client.query("SAVEPOINT invalid_stock");
    await assert.rejects(
      client.query(
        "UPDATE agi_records SET data=jsonb_set(data,'{quantity}','-1') WHERE workspace_id=$1 AND collection='stock'",
        [id],
      ),
      (error: unknown) => (error as { code: string }).code === "23514",
    );
    await client.query("ROLLBACK TO SAVEPOINT invalid_stock");
    const bulk = Array.from({ length: 2000 }, (_, index) => ({
      ...db.organizations[0],
      id: "bulk-" + index,
      code: "BULK-" + index,
      name: `Customer ${String(index).padStart(5, "0")}`,
      branchId: index % 2 ? "south" : "north",
    }));
    await client.query(
      "INSERT INTO agi_records(workspace_id,collection,id,branch_id,data) SELECT $1,'organizations',item->>'id',item->>'branchId',item FROM jsonb_array_elements($2::jsonb) item",
      [id, JSON.stringify(bulk)],
    );
    const scoped = {
      role: "viewer" as const,
      grants: { finance: [] },
      branch_ids: ["north"],
    };
    const first = await listRecords(client, id, scoped, "organizations", {
      q: "Customer",
      limit: 25,
    });
    assert.equal(first.total, 1001);
    assert.equal(first.rows.length, 25);
    assert.ok(first.nextCursor);
    assert.ok(first.rows.every((row) => row.branchId === "north"));
    assert.ok(first.rows.every((row) => !("balance" in row)));
    const second = await listRecords(client, id, scoped, "organizations", {
      q: "Customer",
      limit: 25,
      cursor: first.nextCursor!,
    });
    assert.ok(
      second.rows.every(
        (row) => !first.rows.some((previous) => previous.id === row.id),
      ),
    );
    const target = await loadCommandDatabase(client, id, db.settings, {
      action: "update",
      collection: "organizations",
      id: "customer",
      values: { name: "Updated" },
    });
    assert.equal(target.organizations.length, 1);
    assert.equal(target.products.length, 0);
    assert.equal(target.audit.length, 0);
    const payment = await loadCommandDatabase(client, id, db.settings, {
      action: "receivePayment",
      payment: {
        invoiceId: "invoice",
        organizationId: "customer",
        bankId: "bank",
      },
    });
    assert.equal(payment.invoices.length, 1);
    assert.equal(payment.organizations.length, 1);
    // A conversion loads just its lead/pipeline graph and commits linked records together.
    await client.query("SET CONSTRAINTS ALL DEFERRED");
    const sales = structuredClone(db);
    sales.pipelines.push(structuredClone(defaultPipeline));
    sales.leads.push({
      id: "lead",
      name: "Alex Buyer",
      company: "Example prospect",
      email: "alex@example.com",
      phone: "",
      source: "Website",
      owner: "Seller",
      value: 1000,
      closeDate: "2026-10-31",
      status: "Qualified",
      createdAt: new Date().toISOString(),
      branchId: "north",
    });
    await persistChanges(client, id, db, sales);
    const graph = await loadCommandDatabase(client, id, db.settings, {
      action: "convertLead",
      id: "lead",
      pipelineId: "default",
    });
    assert.equal(graph.leads.length, 1);
    assert.equal(graph.pipelines.length, 1);
    assert.equal(graph.products.length, 0);
    const converted = executeCommand(
      graph,
      { action: "convertLead", id: "lead", pipelineId: "default" },
      "Seller",
      "owner",
    ).data;
    await persistChanges(client, id, graph, converted);
    await client.query("SET CONSTRAINTS ALL IMMEDIATE");
    const convertedGraph = await loadCommandDatabase(client, id, db.settings, {
      action: "convertLead",
      id: "lead",
      pipelineId: "default",
    });
    assert.equal(convertedGraph.opportunities.length, 1);
    assert.equal(convertedGraph.contacts.length, 1);
    assert.equal(convertedGraph.leads[0].status, "Converted");
    const pipelineGraph = await loadCommandDatabase(client, id, db.settings, {
      action: "configurePipeline",
      id: "default",
    });
    assert.equal(pipelineGraph.opportunities.length, 1);
    const renamed = structuredClone(defaultPipeline.stages);
    renamed[0].name = "Discovery";
    renamed[0].probability = 30;
    const configured = executeCommand(
      pipelineGraph,
      {
        action: "configurePipeline",
        id: "default",
        name: "Enterprise",
        stages: renamed,
      },
      "Owner",
      "owner",
    ).data;
    await persistChanges(client, id, pipelineGraph, configured);
    assert.equal(
      (
        await client.query(
          "SELECT data->>'status' AS stage FROM agi_records WHERE workspace_id=$1 AND collection='opportunities'",
          [id],
        )
      ).rows[0].stage,
      "Discovery",
    );
    // PostgreSQL policies must still isolate tenants when application WHERE clauses are absent.
    const outside = randomUUID();
    await setup(client, outside);
    await client.query(
      "INSERT INTO agi_records(workspace_id,collection,id,data) VALUES($1,'organizations','outside',$2)",
      [
        outside,
        JSON.stringify({
          ...db.organizations[0],
          id: "outside",
          branchId: undefined,
        }),
      ],
    );
    await client.query("SELECT set_config('agi.workspace_id',$1,true)", [id]);
    const role = "agi_rls_" + randomUUID().replaceAll("-", "");
    await client.query(`CREATE ROLE ${role} NOLOGIN NOSUPERUSER NOBYPASSRLS`);
    await client.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
    const memberId = randomUUID(),
      outsideMember = randomUUID();
    for (const [userId, workspace] of [
      [memberId, id],
      [outsideMember, outside],
    ]) {
      await client.query(
        'INSERT INTO "user"(id,name,email,"emailVerified","createdAt","updatedAt") VALUES($1,$3,$2,false,now(),now())',
        [userId, userId + "@example.com", "Connection tester"],
      );
      await client.query(
        "INSERT INTO agi_members(user_id,workspace_id,role) VALUES($1,$2,'viewer')",
        [userId, workspace],
      );
      await client.query("SELECT set_config('agi.workspace_id',$1,true)", [
        workspace,
      ]);
      await client.query(
        "INSERT INTO agi_connections(workspace_id,user_id,provider,account_label,credentials) VALUES($1,$2,'microsoft','Test mailbox','test-ciphertext')",
        [workspace, userId],
      );
    }
    await client.query("SELECT set_config('agi.workspace_id',$1,true)", [id]);
    await client.query(
      `GRANT SELECT,INSERT,UPDATE ON agi_records,agi_connections TO ${role}`,
    );
    await client.query(`SET LOCAL ROLE ${role}`);
    assert.equal(
      (
        await client.query(
          "SELECT count(*) FROM agi_records WHERE workspace_id=$1",
          [outside],
        )
      ).rows[0].count,
      "0",
    );
    assert.equal(
      (
        await client.query(
          "UPDATE agi_records SET data=data WHERE workspace_id=$1",
          [outside],
        )
      ).rowCount,
      0,
    );
    await client.query("SAVEPOINT denied_tenant_insert");
    await assert.rejects(
      client.query(
        "INSERT INTO agi_records(workspace_id,collection,id,data) VALUES($1,'organizations','forged',$2)",
        [outside, JSON.stringify({ ...db.organizations[0], id: "forged" })],
      ),
      (error: unknown) => (error as { code: string }).code === "42501",
    );
    await client.query("ROLLBACK TO SAVEPOINT denied_tenant_insert");
    assert.equal(
      (await client.query("SELECT count(*) FROM agi_connections")).rows[0]
        .count,
      "1",
    );
    assert.equal(
      (
        await client.query(
          "SELECT count(*) FROM agi_connections WHERE workspace_id=$1",
          [outside],
        )
      ).rows[0].count,
      "0",
    );
    await client.query("RESET ROLE");
    await client.query("DELETE FROM agi_members WHERE user_id=$1", [memberId]);
    assert.equal(
      (
        await client.query(
          "SELECT count(*) FROM agi_connections WHERE workspace_id=$1 AND user_id=$2",
          [id, memberId],
        )
      ).rows[0].count,
      "0",
    );
  } finally {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
});
