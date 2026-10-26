import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, stat, unlink } from "node:fs/promises";
import {
  mailConfiguration,
  sendAccountMail,
  mailPreviewDirectory,
} from "../lib/server/mail";
import { authDestination } from "../lib/auth-navigation";
test("mail preview fails closed on deployed origins and SMTP requires encryption", () => {
  assert.throws(
    () =>
      mailConfiguration({
        AUTH_MAIL_MODE: "preview",
        BETTER_AUTH_URL: "https://crm.example.com",
      }),
    /loopback/,
  );
  assert.throws(
    () => mailConfiguration({ BETTER_AUTH_URL: "https://crm.example.com" }),
    /Configure/,
  );
  assert.throws(
    () =>
      mailConfiguration({
        AUTH_MAIL_MODE: "smtp",
        SMTP_HOST: "smtp.example.com",
        SMTP_FROM: "mail@example.com",
        SMTP_USER: "user",
      }),
    /both/,
  );
  const smtp = mailConfiguration({
    AUTH_MAIL_MODE: "smtp",
    SMTP_HOST: "smtp.example.com",
    SMTP_FROM: "mail@example.com",
  });
  assert.equal(smtp.mode, "smtp");
  if (smtp.mode === "smtp") {
    assert.equal(smtp.options.requireTLS, true);
    assert.equal(smtp.options.logger, false);
  }
});
test("local account mail is saved privately and never exposes a web endpoint", async () => {
  const oldMode = process.env.AUTH_MAIL_MODE,
    oldURL = process.env.BETTER_AUTH_URL;
  process.env.AUTH_MAIL_MODE = "preview";
  process.env.BETTER_AUTH_URL = "http://localhost:3000";
  const address = "mail-test-" + crypto.randomUUID() + "@example.com";
  try {
    await sendAccountMail(
      address,
      "Test verification",
      "A private local preview.",
    );
    const files = await readdir(mailPreviewDirectory);
    for (const f of files.filter((f) => f.endsWith(".json"))) {
      const path = mailPreviewDirectory + "/" + f;
      const body = JSON.parse(await readFile(path, "utf8"));
      if (body.to !== address) continue;
      assert.equal((await stat(path)).mode & 0o777, 0o600);
      assert.equal(body.text, "A private local preview.");
      await unlink(path);
      return;
    }
    assert.fail("Preview not found.");
  } finally {
    if (oldMode === undefined) delete process.env.AUTH_MAIL_MODE;
    else process.env.AUTH_MAIL_MODE = oldMode;
    if (oldURL === undefined) delete process.env.BETTER_AUTH_URL;
    else process.env.BETTER_AUTH_URL = oldURL;
  }
});
test("authentication continuations preserve invitations and reject external destinations", () => {
  assert.equal(
    authDestination("/onboarding?invitation=token"),
    "/onboarding?invitation=token",
  );
  for (const path of [
    "https://evil.example",
    "//evil.example",
    "/account/security",
    "/onboarding?next=\\evil.example",
  ])
    assert.equal(authDestination(path), "/dashboard");
});
