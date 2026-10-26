import { createHmac } from "node:crypto";
import { expect, type Page, type Browser } from "@playwright/test";
import { accountMail, signInAccount, signInResponse } from "./auth-helpers";
function totp(secret: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of secret.toUpperCase().replace(/=+$/, ""))
    bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
  const key = Buffer.from(
      (bits.match(/.{8}/g) || []).map((b) => parseInt(b, 2)),
    ),
    counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const digest = createHmac("sha1", key).update(counter).digest(),
    offset = digest[digest.length - 1] & 15;
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000)
    .toString()
    .padStart(6, "0");
}
export async function securityFlow(
  page: Page,
  browser: Browser,
  email: string,
  password: string,
) {
  const origin = process.env.BASE_URL || "http://localhost:3000";
  const sibling = await browser.newContext();
  await signInAccount(sibling.request, email, password);
  await page.goto("/account/security");
  await page.getByLabel("Current password for MFA").fill(password);
  await page
    .getByRole("button", { name: "Set up authenticator", exact: true })
    .click();
  const secret = await page.getByTestId("totp-secret").innerText();
  expect(secret.length).toBeGreaterThan(10);
  expect(
    (await (await page.request.get("/api/auth/get-session")).json()).user
      .twoFactorEnabled,
  ).not.toBe(true);
  const invalid = totp(secret) === "000000" ? "111111" : "000000";
  await page.getByLabel("Authenticator code", { exact: true }).fill(invalid);
  await page
    .getByRole("button", { name: "Verify & enable MFA", exact: true })
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page
    .getByLabel("Authenticator code", { exact: true })
    .fill(totp(secret));
  await page
    .getByRole("button", { name: "Verify & enable MFA", exact: true })
    .click();
  await expect(
    page.getByText("Multi-factor authentication is enabled.", { exact: true }),
  ).toBeVisible();
  const codes = await page.locator(".backup-codes code").allTextContents();
  expect(codes.length).toBe(10);
  expect((await sibling.request.get("/api/workspace")).status()).toBe(401);
  await page
    .getByRole("button", { name: "I have saved these codes", exact: true })
    .click();
  await page.screenshot({
    path: "test-results/agi-one-account-security.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/agi-one-account-security-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.request.post("/api/auth/sign-out", {
    headers: { Origin: origin },
    data: {},
  });
  const challenge = await signInAccount(page.request, email, password);
  expect((await challenge.json()).twoFactorRedirect).toBe(true);
  expect((await page.request.get("/api/workspace")).status()).toBe(401);
  await page.goto("/two-factor");
  await page
    .getByLabel("Authenticator code", { exact: true })
    .fill(totp(secret));
  await page
    .getByRole("button", { name: "Verify & continue", exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard/);
  const backupContext = await browser.newContext();
  await signInAccount(backupContext.request, email, password);
  expect(
    (
      await backupContext.request.post(
        "/api/auth/two-factor/verify-backup-code",
        {
          headers: { Origin: origin },
          data: { code: codes[0], trustDevice: false },
        },
      )
    ).status(),
  ).toBe(200);
  expect((await backupContext.request.get("/api/workspace")).status()).toBe(
    200,
  );
  // A consumed backup code cannot create a second session.
  await backupContext.request.post("/api/auth/sign-out", {
    headers: { Origin: origin },
    data: {},
  });
  await signInAccount(backupContext.request, email, password);
  expect(
    (
      await backupContext.request.post(
        "/api/auth/two-factor/verify-backup-code",
        { headers: { Origin: origin }, data: { code: codes[0] } },
      )
    ).status(),
  ).toBe(401);
  const unknown = await page.request.post("/api/auth/request-password-reset", {
    headers: { Origin: origin },
    data: {
      email: "missing-" + Date.now() + "@example.com",
      redirectTo: origin + "/reset-password",
    },
  });
  expect(unknown.status()).toBe(200);
  expect((await unknown.json()).message).toContain("If this email");
  await page.goto("/forgot-password");
  await page.getByLabel("Email address", { exact: true }).fill(email);
  const requestedAt = Date.now();
  await page
    .getByRole("button", { name: "Send recovery link", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("If an account exists");
  const recovery = await accountMail(
    email,
    "Reset your AGI One password",
    requestedAt,
  );
  await page.goto(recovery);
  await expect(page).toHaveURL(/\/reset-password\?token=/);
  const resetToken = new URL(page.url()).searchParams.get("token")!,
    newPassword = "AGI-One-recovered-password-73!";
  await page.getByLabel("New password", { exact: true }).fill(newPassword);
  await page.getByLabel("Confirm password", { exact: true }).fill(newPassword);
  await page
    .getByRole("button", { name: "Reset password", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Your password has been reset",
  );
  expect((await page.request.get("/api/workspace")).status()).toBe(401);
  expect((await backupContext.request.get("/api/workspace")).status()).toBe(
    401,
  );
  expect(
    (
      await backupContext.request.post(
        "/api/auth/two-factor/verify-backup-code",
        { headers: { Origin: origin }, data: { code: codes[2] } },
      )
    ).status(),
  ).toBe(401);
  expect(
    (
      await page.request.post("/api/auth/reset-password", {
        headers: { Origin: origin },
        data: { token: resetToken, newPassword: "Another-password-123!" },
      })
    ).status(),
  ).toBe(400);
  expect((await signInResponse(page.request, email, password)).status()).toBe(
    401,
  );
  const recovered = await signInAccount(page.request, email, newPassword);
  expect((await recovered.json()).twoFactorRedirect).toBe(true);
  expect((await page.request.get("/api/workspace")).status()).toBe(401);
  expect(
    (
      await page.request.post("/api/auth/two-factor/verify-backup-code", {
        headers: { Origin: origin },
        data: { code: codes[1] },
      })
    ).status(),
  ).toBe(200);
  await page.goto("/account/security");
  await expect(
    page.getByText("Multi-factor authentication is enabled.", { exact: true }),
  ).toBeVisible();
  // Restore the fixture password through the real change-password flow.
  await page.getByLabel("Current password", { exact: true }).fill(newPassword);
  await page.getByLabel("New password", { exact: true }).fill(password);
  await page.getByLabel("Confirm new password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Change password", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Password changed");
  await page.getByLabel("Current password for MFA").fill(password);
  await page.getByRole("button", { name: "Disable MFA", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("MFA disabled");
  const audit = await (await page.request.get("/api/audit")).json();
  expect(
    audit.rows.some((e: { action: string }) => e.action === "auth.mfa_enabled"),
  ).toBe(true);
  expect(
    audit.rows.some(
      (e: { action: string }) => e.action === "auth.password_reset",
    ),
  ).toBe(true);
  await sibling.close();
  await backupContext.close();
}
