import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { seal, unseal } from "../lib/server/connection-crypto";
import { exchangeToken, mailSchema } from "../lib/server/microsoft";
test("credentials are encrypted, authenticated and bound to their workspace/user", () => {
  process.env.CONNECTION_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  const encrypted = seal("private-token", "workspace:user");
  assert.ok(!encrypted.includes("private-token"));
  assert.equal(unseal(encrypted, "workspace:user"), "private-token");
  assert.throws(() => unseal(encrypted, "other-workspace:user"));
  assert.throws(() => unseal(encrypted, "workspace:other-user"));
  const bytes = Buffer.from(encrypted, "base64url");
  bytes[bytes.length - 1] ^= 1;
  assert.throws(() => unseal(bytes.toString("base64url"), "workspace:user"));
});
test("Microsoft token refresh keeps rotating credentials server-side and rejects missing scopes", async () => {
  process.env.MICROSOFT_CLIENT_ID = "test-client";
  process.env.MICROSOFT_CLIENT_SECRET = "test-secret";
  process.env.BETTER_AUTH_URL = "http://localhost:3000";
  process.env.CONNECTION_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  const previous = global.fetch;
  try {
    global.fetch = async (_input, init) => {
      assert.equal(init?.method, "POST");
      assert.ok(String(init?.body).includes("grant_type=refresh_token"));
      return Response.json({
        access_token: "new-access",
        refresh_token: "rotated-refresh",
        expires_in: 3600,
        scope: "User.Read Mail.ReadBasic Calendars.ReadBasic",
      });
    };
    const tokens = await exchangeToken({
      grant_type: "refresh_token",
      refresh_token: "old",
    });
    assert.equal(tokens.refreshToken, "rotated-refresh");
    assert.ok(tokens.expiresAt > Date.now());
    global.fetch = async () =>
      Response.json({
        access_token: "partial",
        expires_in: 3600,
        scope: "User.Read",
      });
    await assert.rejects(
      exchangeToken({ grant_type: "refresh_token" }, "old"),
      /permissions/,
    );
  } finally {
    global.fetch = previous;
  }
  const response = mailSchema.parse({
    value: [
      {
        id: "1",
        subject: "Example",
        receivedDateTime: "2026-01-01",
        webLink: "javascript:alert(1)",
      },
    ],
  });
  assert.equal(response.value[0].webLink, "");
});
