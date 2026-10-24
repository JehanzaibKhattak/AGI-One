import { test, expect, type APIRequestContext } from "@playwright/test";
import { fixture } from "../fixtures";
const origin = process.env.BASE_URL || "http://localhost:3000";
const password = "AGI-One-test-password-42!";
test("owners manage scoped access, finance privacy, invitations, revocation and ownership", async ({
  page,
  browser,
}) => {
  test.setTimeout(180000);
  const stamp = Date.now();
  const ownerEmail = `admin-${stamp}@example.com`,
    agentEmail = `agent-${stamp}@example.com`;
  const signup = await page.request.post("/api/auth/sign-up/email", {
    headers: { Origin: origin },
    data: { name: "Access Owner", email: ownerEmail, password },
  });
  expect(signup.ok(), await signup.text()).toBeTruthy();
  expect(
    (
      await page.request.post("/api/workspace", {
        headers: { Origin: origin },
        data: { name: "Access verification" },
      })
    ).status(),
  ).toBe(201);
  await page.goto("/settings/users");
  await page.getByLabel("New branch name").fill("North");
  await page.getByRole("button", { name: "Add branch", exact: true }).click();
  await expect(
    page.locator(".branch-choices .badge").filter({ hasText: "North" }),
  ).toBeVisible();
  expect(
    (
      await page.request.post("/api/branches", {
        headers: { Origin: origin },
        data: { name: "South" },
      })
    ).status(),
  ).toBe(201);
  const branches = await (await page.request.get("/api/branches")).json();
  const north = branches.find((b: { name: string }) => b.name === "North").id,
    south = branches.find((b: { name: string }) => b.name === "South").id;
  const mutate = async (context: APIRequestContext, command: unknown) => {
    const state = await (await context.get("/api/workspace")).json();
    return context.patch("/api/workspace", {
      headers: { Origin: origin },
      data: { revision: state.revision, command },
    });
  };
  const data = fixture();
  for (const [id, name, branchId] of [
    ["north-customer", "North customer", north],
    ["south-customer", "South customer", south],
    ["unassigned-customer", "Unassigned customer", undefined],
  ]) {
    const response = await mutate(page.request, {
      action: "create",
      collection: "organizations",
      record: { ...data.organizations[0], id, name, code: id, branchId },
    });
    expect(response.status(), await response.text()).toBe(200);
  }
  expect(
    (
      await mutate(page.request, {
        action: "create",
        collection: "products",
        record: data.products[0],
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await mutate(page.request, {
        action: "create",
        collection: "invoices",
        record: {
          ...data.invoices[0],
          id: "private-invoice",
          name: "PRIVATE-INVOICE",
          organizationId: "north-customer",
        },
      })
    ).status(),
  ).toBe(200);
  await page.goto("/crm");
  await expect(
    page.getByRole("button", { name: "North customer", exact: false }).first(),
  ).toBeVisible();
  const boot = await (
    await page.request.get("/api/workspace?mode=directory")
  ).json();
  expect(boot.data.organizations).toEqual([]);
  expect(boot.data.invoices).toEqual([]);
  await page.getByLabel("Search organizations").fill("South");
  await expect(
    page.getByRole("button", { name: /South customer/ }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /North customer/ }),
  ).toHaveCount(0);
  const exportResponse = await page.request.get(
    "/api/records/organizations/export?q=South",
  );
  expect(exportResponse.status()).toBe(200);
  const csv = await exportResponse.text();
  expect(csv).toContain("South customer");
  expect(csv).not.toContain("North customer");
  await page.locator(".quick-create").click();
  await page
    .getByRole("menuitem", { name: "New contact", exact: true })
    .click();
  const contact = page.getByRole("dialog");
  await contact.getByLabel("Name").fill("North contact");
  const relation = contact.getByRole("combobox", {
    name: "Organization",
    exact: true,
  });
  await relation.fill("North");
  await expect(
    contact.getByRole("option", { name: "North customer", exact: true }),
  ).toBeVisible();
  await relation.press("Enter");
  await contact
    .getByRole("button", { name: "Create contact", exact: true })
    .click();
  await expect(contact).toHaveCount(0);
  expect(
    (await (await page.request.get("/api/records/contacts")).json()).rows[0]
      .organizationId,
  ).toBe("north-customer");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/agi-one-directory-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/settings/users");
  await page.getByLabel("Email address", { exact: true }).fill(agentEmail);
  await page.getByText("Module permissions", { exact: true }).click();
  await page.getByLabel("finance view", { exact: true }).uncheck();
  await page.getByLabel("customers export", { exact: true }).uncheck();
  await page.getByLabel("Access branch North", { exact: true }).check();
  await page
    .getByRole("button", { name: "Create invitation link", exact: true })
    .click();
  await expect(
    page.getByLabel("Invitation link", { exact: true }),
  ).toBeVisible();
  const invitation = new URL(
    await page.getByLabel("Invitation link", { exact: true }).inputValue(),
  ).searchParams.get("invitation");
  const agent = await browser.newContext();
  expect(
    (
      await agent.request.post("/api/auth/sign-up/email", {
        headers: { Origin: origin },
        data: { name: "Scoped Agent", email: agentEmail, password },
      })
    ).ok(),
  ).toBeTruthy();
  expect(
    (
      await agent.request.post("/api/workspace", {
        headers: { Origin: origin },
        data: { name: "Join", invitation },
      })
    ).status(),
  ).toBe(201);
  const visible = await (await agent.request.get("/api/workspace")).json();
  expect(visible.data.organizations.map((r: { id: string }) => r.id)).toEqual([
    "north-customer",
  ]);
  expect(visible.data.invoices).toEqual([]);
  expect(visible.member.branch_ids).toEqual([north]);
  expect((await agent.request.get("/api/records/invoices")).status()).toBe(403);
  expect(
    (await agent.request.get("/api/records/organizations/export")).status(),
  ).toBe(403);
  const directory = await (
    await agent.request.get("/api/records/organizations?limit=1")
  ).json();
  expect(directory.total).toBe(1);
  expect(directory.rows[0].balance).toBeUndefined();
  const result = await mutate(agent.request, {
    action: "update",
    collection: "organizations",
    id: "north-customer",
    values: { name: "North updated" },
  });
  expect(result.status(), await result.text()).toBe(200);
  expect(
    (
      await mutate(agent.request, {
        action: "update",
        collection: "organizations",
        id: "south-customer",
        values: { name: "Forbidden update" },
      })
    ).ok(),
  ).toBeFalsy();
  const agentPage = await agent.newPage();
  await agentPage.goto("/crm");
  await expect(
    agentPage.getByRole("button", { name: /North updated/ }).first(),
  ).toBeVisible();
  await expect(
    agentPage.getByRole("button", { name: "Export matching customers" }),
  ).toHaveCount(0);
  await expect(
    agentPage.getByRole("link", { name: "Invoices", exact: true }),
  ).toHaveCount(0);
  await agentPage.goto("/finance/invoices");
  await expect(
    agentPage.getByRole("heading", { name: "Access restricted", exact: true }),
  ).toBeVisible();
  const agentId = (
    await (await page.request.get("/api/members")).json()
  ).members.find((member: { email: string }) => member.email === agentEmail).id;
  for (const branchId of [north, south]) {
    const response = await mutate(page.request, {
      action: "create",
      collection: "opportunities",
      record: {
        id: "deal-" + branchId,
        name: "Branch deal",
        status: "New Lead",
        createdAt: new Date().toISOString(),
        organizationId:
          branchId === north ? "north-customer" : "south-customer",
        contactId: "",
        productId: "",
        value: branchId === north ? 1000 : 9000,
        closeDate: "2026-10-31",
        owner: "Seller",
        probability: 10,
        nextActivity: "",
        pipelineId: "default",
        stageId: "new",
      },
    });
    expect(response.status(), await response.text()).toBe(200);
  }
  const scopedForecast = await (
    await agent.request.get("/api/sales/forecast?from=2026-10-01&to=2026-10-31")
  ).json();
  expect(
    scopedForecast.groups.reduce(
      (sum: number, g: { value: number }) => sum + g.value,
      0,
    ),
  ).toBe(1000);
  const outsideForecast = await (
    await agent.request.get(
      "/api/sales/forecast?from=2026-10-01&to=2026-10-31&branchId=" + south,
    )
  ).json();
  expect(outsideForecast.groups).toEqual([]);
  expect(
    (
      await mutate(agent.request, {
        action: "configurePipeline",
        id: "default",
        name: "Forbidden",
        stages: [],
      })
    ).status(),
  ).toBe(403);
  const forbiddenTask = await mutate(page.request, {
    action: "create",
    collection: "tasks",
    record: {
      id: "outside-task",
      name: "Outside assignment",
      status: "Open",
      createdAt: new Date().toISOString(),
      assigneeId: agentId,
      dueAt: "2026-10-31T10:00:00.000Z",
      reminderAt: "",
      priority: "Normal",
      organizationId: "south-customer",
    },
  });
  expect(forbiddenTask.status()).toBe(400);
  expect(
    (
      await page.request.patch("/api/members", {
        headers: { Origin: origin },
        data: {
          action: "update",
          userId: agentId,
          role: "viewer",
          grants: { finance: [] },
          branch_ids: [north],
        },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await mutate(agent.request, {
        action: "update",
        collection: "organizations",
        id: "north-customer",
        values: { name: "No longer allowed" },
      })
    ).status(),
  ).toBe(403);
  const ownerId = (await (await page.request.get("/api/workspace")).json())
    .member.id;
  expect(
    (
      await page.request.delete("/api/members", {
        headers: { Origin: origin },
        data: { kind: "member", id: ownerId },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await page.request.patch("/api/members", {
        headers: { Origin: origin },
        data: {
          action: "transfer",
          userId: agentId,
          email: "wrong@example.com",
        },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await page.request.patch("/api/members", {
        headers: { Origin: origin },
        data: { action: "transfer", userId: agentId, email: agentEmail },
      })
    ).status(),
  ).toBe(200);
  expect((await page.request.get("/api/members")).status()).toBe(403);
  const newOwner = await (await agent.request.get("/api/workspace")).json();
  expect(newOwner.member.role).toBe("owner");
  expect(newOwner.member.branch_ids).toEqual([]);
  expect(newOwner.data.organizations).toHaveLength(3);
  expect(newOwner.data.invoices).toHaveLength(1);
  expect(
    (
      await agent.request.delete("/api/members", {
        headers: { Origin: origin },
        data: { kind: "member", id: ownerId },
      })
    ).status(),
  ).toBe(200);
  expect((await page.request.get("/api/workspace")).status()).toBe(401);
  const pending = await agent.request.post("/api/members", {
    headers: { Origin: origin },
    data: { email: ownerEmail, role: "viewer" },
  });
  expect(pending.status()).toBe(201);
  const revokedToken = new URL((await pending.json()).url).searchParams.get(
    "invitation",
  );
  const invite = (
    await (await agent.request.get("/api/members")).json()
  ).invitations.find((row: { email: string }) => row.email === ownerEmail);
  expect(
    (
      await agent.request.delete("/api/members", {
        headers: { Origin: origin },
        data: { kind: "invitation", id: invite.id },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await page.request.post("/api/auth/sign-in/email", {
        headers: { Origin: origin },
        data: { email: ownerEmail, password },
      })
    ).ok(),
  ).toBeTruthy();
  expect(
    (
      await page.request.post("/api/workspace", {
        headers: { Origin: origin },
        data: { name: "Join", invitation: revokedToken },
      })
    ).status(),
  ).toBe(400);
  const audit = await (await agent.request.get("/api/audit")).json();
  expect(
    audit.rows.some(
      (event: { action: string }) => event.action === "ownership.transferred",
    ),
  ).toBeTruthy();
  expect(
    audit.rows.some(
      (event: { action: string }) => event.action === "member.revoked",
    ),
  ).toBeTruthy();
  await agentPage.goto("/settings/users");
  await expect(
    agentPage.getByRole("heading", { name: "Team & access" }),
  ).toBeVisible();
  await agentPage.screenshot({
    path: "test-results/agi-one-team-access.png",
    fullPage: true,
  });
  await agent.close();
});
