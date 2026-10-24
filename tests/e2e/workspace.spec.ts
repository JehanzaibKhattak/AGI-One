import { test, expect, type APIRequestContext } from "@playwright/test";
import { fixture } from "../fixtures";
const origin = process.env.BASE_URL || "http://localhost:3000";
const password = "AGI-One-test-password-42!";
test("real accounts, clean onboarding, business workflows and workspace isolation", async ({
  page,
  browser,
}) => {
  test.setTimeout(240000);
  const suffix = Date.now();
  const email = `owner-${suffix}@example.com`;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  await page.evaluate(() =>
    sessionStorage.setItem("agi-session", JSON.stringify({ role: "owner" })),
  );
  expect((await page.request.get("/api/workspace")).status()).toBe(401);
  await page
    .getByRole("button", { name: "New to AGI One? Create an account" })
    .click();
  await page.getByLabel("Full name").fill("Workspace Owner");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByLabel("Workspace name").fill("Example workspace");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(
    page.getByRole("heading", { name: "Your workspace starts here." }),
  ).toBeVisible();
  let snapshot = await (await page.request.get("/api/workspace")).json();
  expect(snapshot.data.organizations).toEqual([]);
  expect(snapshot.data.products).toEqual([]);
  expect(snapshot.data.invoices).toEqual([]);
  await page.getByRole("button", { name: "Add your first customer" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Organization name").fill("First customer");
  await dialog.getByLabel("Organization type").selectOption("Business");
  await dialog.getByLabel("City").fill("London");
  await dialog
    .getByRole("button", { name: "Create customer", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  snapshot = await (await page.request.get("/api/workspace")).json();
  expect(snapshot.data.organizations[0].name).toBe("First customer");
  const mutate = async (
    command: unknown,
    context: APIRequestContext = page.request,
  ) => {
    const state = await (await context.get("/api/workspace")).json();
    return context.patch("/api/workspace", {
      headers: { Origin: origin },
      data: { revision: state.revision, command },
    });
  };
  // An open form must keep its original revision even after background refresh.
  await page.goto(`/crm/customers/${snapshot.data.organizations[0].id}`);
  await page.getByRole("button", { name: "Edit details", exact: true }).click();
  const editDialog = page.getByRole("dialog");
  await editDialog.getByLabel("Organization name").fill("Stale form value");
  expect(
    (
      await mutate({
        action: "update",
        collection: "organizations",
        id: snapshot.data.organizations[0].id,
        values: { name: "Teammate change" },
      })
    ).status(),
  ).toBe(200);
  const refresh = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/workspace") &&
      response.request().method() === "GET",
  );
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await refresh;
  await editDialog
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(editDialog.getByRole("alert")).toContainText("Another teammate");
  expect(
    (await (await page.request.get("/api/workspace")).json()).data
      .organizations[0].name,
  ).toBe("Teammate change");
  await editDialog.getByRole("button", { name: "Cancel", exact: true }).click();
  const data = fixture();
  const customerId = snapshot.data.organizations[0].id;
  for (const [collection, record] of [
    ["products", data.products[0]],
    ["warehouses", data.warehouses[0]],
    ["warehouses", data.warehouses[1]],
    ["suppliers", data.suppliers[0]],
    ["banks", data.banks[0]],
  ] as const) {
    const response = await mutate({ action: "create", collection, record });
    expect(response.status(), await response.text()).toBe(200);
  }
  const po = { ...data.purchaseOrders[0], status: "Awaiting Approval" };
  const poResponse = await mutate({
    action: "create",
    collection: "purchaseOrders",
    record: po,
  });
  expect(poResponse.status(), await poResponse.text()).toBe(200);
  let state = await (await page.request.get("/api/workspace")).json();
  expect(state.data.approvals).toHaveLength(1);
  expect(
    (
      await mutate({
        action: "approveRequest",
        id: state.data.approvals[0].id,
        status: "Approved",
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await mutate({
        action: "receiveGoods",
        args: ["po", "warehouse-a", "RECEIVE-1"],
      })
    ).status(),
  ).toBe(200);
  const quote = { ...data.quotations[0], organizationId: customerId };
  expect(
    (
      await mutate({
        action: "create",
        collection: "quotations",
        record: quote,
      })
    ).status(),
  ).toBe(200);
  const conversion = await mutate({ action: "convertQuotation", id: "quote" });
  expect(conversion.status(), await conversion.text()).toBe(200);
  const order = (await conversion.json()).result;
  const bypass = await mutate({
    action: "update",
    collection: "orders",
    id: order,
    values: { status: "Delivered" },
  });
  expect(bypass.status()).toBe(400);
  expect(
    (
      await mutate({ action: "orderAction", id: order, operation: "reserve" })
    ).status(),
  ).toBe(200);
  expect(
    (
      await mutate({ action: "orderAction", id: order, operation: "deliver" })
    ).status(),
  ).toBe(200);
  const invoiced = await mutate({
    action: "orderAction",
    id: order,
    operation: "invoice",
  });
  expect(invoiced.status()).toBe(200);
  const invoice = (await invoiced.json()).result;
  expect(
    (
      await mutate({
        action: "update",
        collection: "invoices",
        id: invoice,
        values: { status: "Sent" },
      })
    ).status(),
  ).toBe(200);
  const receipt = {
    id: "receipt",
    name: "REC-1",
    createdAt: new Date().toISOString(),
    status: "Received",
    organizationId: customerId,
    invoiceId: invoice,
    amount: 200,
    date: new Date().toISOString().slice(0, 10),
    bankId: "bank",
    method: "Bank Transfer",
    reference: "TEST",
    receivedBy: "Forged actor",
  };
  expect(
    (await mutate({ action: "receivePayment", payment: receipt })).status(),
  ).toBe(200);
  state = await (await page.request.get("/api/workspace")).json();
  expect(state.data.invoices[0].status).toBe("Paid");
  expect(state.data.payments[0].receivedBy).toContain(email);
  expect(state.data.stock[0].quantity).toBe(0);
  const stale = await page.request.patch("/api/workspace", {
    headers: { Origin: origin },
    data: {
      revision: 0,
      command: {
        action: "updateSettings",
        values: { company: "Stale overwrite" },
      },
    },
  });
  expect(stale.status()).toBe(409);
  const concurrentState = await (
    await page.request.get("/api/workspace")
  ).json();
  const concurrent = await Promise.all(
    ["Concurrent A", "Concurrent B"].map((name) =>
      page.request.patch("/api/workspace", {
        headers: { Origin: origin },
        data: {
          revision: concurrentState.revision,
          command: {
            action: "update",
            collection: "organizations",
            id: customerId,
            values: { name },
          },
        },
      }),
    ),
  );
  expect(concurrent.map((response) => response.status()).sort()).toEqual([
    200, 409,
  ]);
  const badOrigin = await page.request.patch("/api/workspace", {
    headers: { Origin: "https://untrusted.example" },
    data: {
      revision: state.revision,
      command: { action: "markNotifications" },
    },
  });
  expect(badOrigin.status()).toBe(403);
  const outsider = await browser.newContext();
  const other = outsider.request;
  const signup = await other.post("/api/auth/sign-up/email", {
    headers: { Origin: origin },
    data: {
      name: "Other owner",
      email: `other-${suffix}@example.com`,
      password,
    },
  });
  expect(signup.ok(), await signup.text()).toBeTruthy();
  expect(
    (
      await other.post("/api/workspace", {
        headers: { Origin: origin },
        data: { name: "Separate workspace" },
      })
    ).status(),
  ).toBe(201);
  const separate = await (await other.get("/api/workspace")).json();
  expect(separate.data.organizations).toEqual([]);
  const denied = await mutate(
    {
      action: "update",
      collection: "organizations",
      id: customerId,
      values: { name: "Cross-workspace write" },
    },
    other,
  );
  expect(denied.status()).toBe(400);
  const viewerEmail = `viewer-${suffix}@example.com`;
  const invite = await page.request.post("/api/members", {
    headers: { Origin: origin },
    data: { email: viewerEmail, role: "viewer" },
  });
  expect(invite.status()).toBe(201);
  const token = new URL((await invite.json()).url).searchParams.get(
    "invitation",
  );
  const viewer = await browser.newContext();
  expect(
    (
      await viewer.request.post("/api/auth/sign-up/email", {
        headers: { Origin: origin },
        data: { name: "Read Only", email: viewerEmail, password },
      })
    ).ok(),
  ).toBeTruthy();
  expect(
    (
      await viewer.request.post("/api/workspace", {
        headers: { Origin: origin },
        data: { name: "Ignored name", invitation: token },
      })
    ).status(),
  ).toBe(201);
  expect(
    (await (await viewer.request.get("/api/workspace")).json()).data
      .organizations,
  ).toHaveLength(1);
  expect(
    (
      await mutate(
        {
          action: "update",
          collection: "organizations",
          id: customerId,
          values: { name: "Viewer overwrite" },
        },
        viewer.request,
      )
    ).status(),
  ).toBe(403);
  expect(
    (
      await viewer.request.post("/api/members", {
        headers: { Origin: origin },
        data: { email: "invite@example.com", role: "editor" },
      })
    ).status(),
  ).toBe(403);
  const currentCustomerName = (
    await (await page.request.get("/api/workspace")).json()
  ).data.organizations.find((o: { id: string }) => o.id === customerId).name;
  // The sales milestone uses the same real account and transaction path as the CRM.
  await page.goto("/sales/leads");
  await page.getByRole("button", { name: "New lead", exact: true }).click();
  await dialog.getByLabel("Name", { exact: false }).fill("Alex Buyer");
  await dialog.getByLabel("Company", { exact: false }).fill("Example prospect");
  await dialog.getByLabel("Email", { exact: false }).fill("alex@example.com");
  await dialog.getByLabel("Expected value").fill("1000");
  await dialog.getByLabel("Expected close").fill("2026-10-31");
  await dialog.getByLabel("Status").selectOption("Qualified");
  await dialog
    .getByRole("button", { name: "Create lead", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "Convert lead", exact: true }).click();
  await dialog
    .getByRole("combobox", { name: "Existing customer", exact: true })
    .fill(currentCustomerName);
  await dialog
    .getByRole("option", { name: currentCustomerName, exact: true })
    .click();
  await dialog
    .getByRole("button", {
      name: "Convert to customer & opportunity",
      exact: true,
    })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("table").getByText("Converted", { exact: true }),
  ).toBeVisible();
  let salesState = await (await page.request.get("/api/workspace")).json();
  const lead = salesState.data.leads[0],
    deal = salesState.data.opportunities[0];
  expect(lead.opportunityId).toBe(deal.id);
  expect(deal.value).toBe(1000);
  expect(
    (
      await mutate({
        action: "convertLead",
        id: lead.id,
        pipelineId: "default",
      })
    ).status(),
  ).toBe(400);
  const forecast = await (
    await page.request.get("/api/sales/forecast?from=2026-10-01&to=2026-10-31")
  ).json();
  expect(forecast.groups[0].weighted).toBe(100);
  await page.goto("/sales/pipelines");
  await page
    .getByRole("button", { name: "Edit Sales pipeline", exact: true })
    .click();
  await dialog.getByLabel("Stage 1", { exact: true }).fill("Discovery");
  await dialog.getByLabel("Probability %", { exact: true }).first().fill("30");
  await dialog
    .getByRole("button", { name: "Save pipeline", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  salesState = await (await page.request.get("/api/workspace")).json();
  expect(salesState.data.opportunities[0].status).toBe("Discovery");
  expect(
    (
      await (
        await page.request.get(
          "/api/sales/forecast?from=2026-10-01&to=2026-10-31",
        )
      ).json()
    ).groups[0].weighted,
  ).toBe(300);
  await page.goto("/sales/opportunities");
  await page.getByLabel(`Stage for ${deal.name}`).selectOption("won");
  await expect
    .poll(
      async () =>
        (await (await page.request.get("/api/workspace")).json()).data
          .opportunities[0].salesOutcome,
    )
    .toBe("won");
  await page.goto("/sales/tasks");
  await page.getByRole("button", { name: "New task", exact: true }).click();
  await dialog.getByLabel("Name", { exact: false }).fill("Follow up with Alex");
  await expect(dialog.getByLabel("Assigned to")).toHaveValue(
    salesState.member.id,
  );
  await dialog.getByLabel("Due at").fill("2020-01-02T10:00");
  await dialog.getByLabel("Remind at").fill("2020-01-01T10:00");
  await dialog
    .getByRole("button", { name: "Create task", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("status").filter({ hasText: "task reminder" }),
  ).toBeVisible();
  expect(
    (await (await page.request.get("/api/sales/reminders")).json()).total,
  ).toBe(1);
  const task = (await (await page.request.get("/api/workspace")).json()).data
    .tasks[0];
  expect(
    (
      await mutate({
        action: "update",
        collection: "tasks",
        id: task.id,
        values: { assigneeId: "outside-workspace" },
      })
    ).status(),
  ).toBe(400);
  await page.getByRole("button", { name: "Complete", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await (await page.request.get("/api/sales/reminders")).json()).total,
    )
    .toBe(0);
  await page.goto("/sales/forecast");
  await page.getByLabel("Close from").fill("2026-10-01");
  await page.getByLabel("Close through").fill("2026-10-31");
  await expect(
    page.locator(".stat").filter({ hasText: "Closed won" }),
  ).toContainText("1,000");
  await page.screenshot({
    path: "test-results/agi-one-sales-forecast.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/sales/tasks");
  await expect(
    page.getByRole("heading", { name: "Tasks & reminders", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("table").getByText("Follow up with Alex", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/agi-one-tasks-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/sales/connections");
  await expect(
    page.getByRole("button", { name: "Connect Microsoft 365", exact: true }),
  ).toBeDisabled();
  expect(
    (
      await page.request.post("/api/connections/microsoft", {
        headers: { Origin: origin },
      })
    ).status(),
  ).toBe(503);
  const badCallback = await page.request.get(
    "/api/connections/microsoft/callback?state=invalid&code=invalid",
    { maxRedirects: 0 },
  );
  expect(badCallback.status()).toBe(303);
  expect(badCallback.headers().location).toContain("connection=failed");
  const routes = [
    "/sales/leads",
    "/sales/tasks",
    "/sales/pipelines",
    "/sales/forecast",
    "/sales/connections",
    "/dashboard",
    "/crm",
    "/crm/contacts",
    "/sales/opportunities",
    "/sales/quotations",
    "/sales/orders",
    "/sales/deliveries",
    "/inventory",
    "/inventory/warehouses",
    "/procurement",
    "/procurement/requests",
    "/procurement/orders",
    "/procurement/receipts",
    "/service/equipment",
    "/service/tickets",
    "/service/maintenance",
    "/service/contracts",
    "/service/engineers",
    "/finance/accounts",
    "/finance/invoices",
    "/finance/receivables",
    "/finance/receipts",
    "/finance/expenses",
    "/finance/banking",
    "/tenders",
    "/reports",
    "/approvals",
    "/settings/users",
    "/settings/audit-log",
    "/settings",
  ];
  for (const route of routes) {
    await page.goto(route);
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Couldn’t load your workspace" }),
    ).toHaveCount(0);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Welcome, Workspace" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/agi-one-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "test-results/agi-one-desktop.png",
    fullPage: true,
  });
  expect(
    (
      await page.request.post("/api/auth/sign-out", {
        data: {},
        headers: { Origin: origin },
      })
    ).ok(),
  ).toBeTruthy();
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  expect((await page.request.get("/api/workspace")).status()).toBe(401);
  expect(
    (
      await page.request.post("/api/auth/sign-in/email", {
        headers: { Origin: origin },
        data: { email, password: "incorrect-password" },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await page.request.post("/api/auth/sign-in/email", {
        headers: { Origin: origin },
        data: { email, password },
      })
    ).ok(),
  ).toBeTruthy();
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Welcome, Workspace" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  await outsider.close();
  await viewer.close();
});
