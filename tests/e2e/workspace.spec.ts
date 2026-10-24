import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    sessionStorage.setItem(
      "amss-session",
      JSON.stringify({ name: "Admin", role: "Super Admin" }),
    ),
  );
});
test("all main routes render without browser errors", async ({ page }) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const routes = [
    "/dashboard",
    "/crm",
    "/crm/contacts",
    "/crm/customers/org-1",
    "/sales/opportunities",
    "/sales/opportunities/opp-1",
    "/sales/quotations",
    "/sales/quotations/new",
    "/sales/quotations/qt-1",
    "/sales/orders",
    "/sales/orders/ord-1",
    "/sales/deliveries",
    "/inventory",
    "/inventory/products/prd-1",
    "/inventory/warehouses",
    "/procurement",
    "/procurement/requests",
    "/procurement/orders",
    "/procurement/orders/new",
    "/procurement/receipts",
    "/service/equipment",
    "/service/equipment/eq-1",
    "/service/tickets",
    "/service/tickets/ticket-1",
    "/service/engineers",
    "/service/engineers/eng-1",
    "/service/maintenance",
    "/service/contracts",
    "/finance/accounts",
    "/finance/invoices",
    "/finance/invoices/new",
    "/finance/receivables",
    "/finance/receipts",
    "/finance/expenses",
    "/finance/banking",
    "/tenders",
    "/tenders/tnd-1",
    "/reports",
    "/settings/users",
    "/settings/audit-log",
    "/settings",
    "/approvals",
  ];
  for (const route of routes) {
    const response = await page.goto(route);
    expect(response?.status(), route).toBe(200);
    await expect(page.locator("main h1").first(), route).toBeVisible();
    await expect(page.getByText("Something interrupted this page")).toHaveCount(
      0,
    );
  }
  expect(errors).toEqual([]);
});
test("create customer, filter table, edit detail and reload persistence", async ({
  page,
}) => {
  await page.goto("/crm");
  await page.getByRole("button", { name: "New customer", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Organization name")
    .fill("Horizon Diagnostic Centre");
  await dialog.getByLabel("Organization type").selectOption("Laboratory");
  await dialog
    .getByRole("combobox", { name: "City *", exact: true })
    .selectOption("Karachi");
  await dialog.getByLabel("Email", { exact: true }).fill("lab@horizon.example");
  await dialog.getByRole("button", { name: "Create customer" }).click();
  await expect(dialog).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Search organizations" })
    .fill("Horizon");
  await page
    .getByRole("button", { name: /Horizon Diagnostic Centre CUS/ })
    .click();
  await page.getByRole("link", { name: "Open customer" }).click();
  await expect(page.locator("h1")).toHaveText("Horizon Diagnostic Centre");
  await page.getByRole("button", { name: "Edit details", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Phone", { exact: true })
    .fill("+92 300 7654321");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("link", { name: "+92 300 7654321", exact: true }),
  ).toBeVisible();
});
test("quotation editor calculates totals and converts to a linked order", async ({
  page,
}) => {
  await page.goto("/sales/quotations/new?customer=org-1");
  await expect(page.getByLabel("Customer *")).toHaveValue("org-1");
  await page.getByLabel("Product 1", { exact: true }).selectOption("prd-3");
  await page.getByLabel("quantity 1", { exact: true }).fill("2");
  await page.getByLabel("discount 1", { exact: true }).fill("10");
  await expect(page.locator(".summary-total")).toContainText("101,952");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page).toHaveURL(/\/sales\/quotations\/quotations-/);
  await page.getByRole("button", { name: "Convert to sales order" }).click();
  await expect(page).toHaveURL(/\/sales\/orders\/ord-/);
  await expect(
    page.getByRole("link", { name: /Capital Diagnostic Centre/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Reserve stock", exact: true })
    .click();
  await expect(
    page.locator(".page-heading").getByText("Reserved", { exact: true }),
  ).toBeVisible();
});
test("global search finds ticket and service actions create timeline entries", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await page.keyboard.press("Control+k");
  await page.getByRole("textbox", { name: "Global search" }).fill("ST-1098");
  await page.getByRole("button", { name: /Service tickets ST-1098/ }).click();
  await expect(page).toHaveURL("/service/tickets/ticket-1");
  await page
    .getByRole("button", { name: "Assign engineer", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("combobox", { name: "Engineer", exact: true })
    .selectOption("eng-3");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add note", exact: true })
    .first()
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Note", { exact: true })
    .fill("Quality control run completed successfully.");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(
    page.getByText("Quality control run completed successfully."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Resolve ticket", exact: true })
    .click();
  await expect(
    page.locator(".page-heading").getByText("Resolved", { exact: true }),
  ).toBeVisible();
});
test("customer tabs, equipment tabs, calendar, roles and reports are interactive", async ({
  page,
}) => {
  await page.goto("/crm/customers/org-1");
  for (const name of [
    "Contacts",
    "Opportunities",
    "Quotations",
    "Orders",
    "Invoices",
    "Payments",
    "Installed Equipment",
    "Service Tickets",
    "Contracts",
    "Documents",
    "Activity",
  ]) {
    await page
      .locator(".detail-tabs")
      .getByRole("button", { name, exact: true })
      .click();
    await expect(page.getByText("Something interrupted this page")).toHaveCount(
      0,
    );
  }
  await page.goto("/inventory/products/prd-3");
  for (const name of [
    "Stock",
    "Batches",
    "Serial Numbers",
    "Transactions",
    "Purchases",
    "Sales",
    "Service Compatibility",
  ])
    await page
      .locator(".detail-tabs")
      .getByRole("button", { name, exact: true })
      .click();
  await page.goto("/service/maintenance");
  await page.getByRole("button", { name: "Calendar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "September 2026" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next month" }).click();
  await expect(
    page.getByRole("heading", { name: "October 2026" }),
  ).toBeVisible();
  await page.goto("/settings/users");
  await page
    .getByRole("combobox", { name: "Role to configure" })
    .selectOption("role-3");
  await expect(
    page.getByRole("checkbox", { name: "Finance Manager CRM view" }),
  ).toBeChecked();
  await page.goto("/reports");
  await page
    .getByRole("button", { name: "Sales by Customer", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV", exact: true }).click();
  const file = await downloadPromise;
  expect(file.suggestedFilename()).toBe("Sales by Customer.csv");
});
test("mobile navigation and tables stay within the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  await expect(page.locator("h1")).toHaveText("Good morning, Admin");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Organizations", exact: true })
    .click();
  await expect(page.locator("h1")).toHaveText("Your customer relationships");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/mobile-crm.png",
    fullPage: true,
  });
});
test("login rejects invalid credentials and opens the demo for valid credentials", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("wrong@example.com");
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await expect(page.locator(".form-error[role=alert]")).toContainText(
    "Use the demo",
  );
  await page.getByLabel("Email address").fill("admin@amss.pk");
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await expect(page).toHaveURL("/dashboard");
});
