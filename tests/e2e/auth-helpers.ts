import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, type APIRequestContext } from "@playwright/test";
export async function accountMail(email: string, subject: string, after = 0) {
  let found: { text: string; createdAt: string } | undefined;
  await expect
    .poll(async () => {
      const files = await readdir(join(tmpdir(), "agi-one-mail")).catch(
        () => [],
      );
      const messages = await Promise.all(
        files
          .filter((f) => f.endsWith(".json"))
          .map(async (f) =>
            JSON.parse(
              await readFile(join(tmpdir(), "agi-one-mail", f), "utf8"),
            ),
          ),
      );
      found = messages
        .filter(
          (m) =>
            m.to === email &&
            m.subject === subject &&
            Date.parse(m.createdAt) >= after,
        )
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
      return Boolean(found);
    })
    .toBe(true);
  const url = found!.text.match(/https?:\/\/\S+/)?.[0];
  if (!url) throw new Error("Account mail link missing.");
  return url;
}
export async function signInResponse(
  context: APIRequestContext,
  email: string,
  password: string,
) {
  const origin = process.env.BASE_URL || "http://localhost:3000";
  let result = await context.post("/api/auth/sign-in/email", {
    headers: { Origin: origin },
    data: { email, password },
  });
  if (result.status() === 429) {
    const seconds = Math.min(
      60,
      Math.max(1, Number(result.headers()["retry-after"]) || 60),
    );
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
    result = await context.post("/api/auth/sign-in/email", {
      headers: { Origin: origin },
      data: { email, password },
    });
  }
  return result;
}
export async function signInAccount(
  context: APIRequestContext,
  email: string,
  password: string,
) {
  const result = await signInResponse(context, email, password);
  expect(result.ok(), await result.text()).toBeTruthy();
  return result;
}
export async function verifyAndSignIn(
  context: APIRequestContext,
  email: string,
  password: string,
) {
  const link = await accountMail(email, "Verify your AGI One email");
  const response = await context.get(link);
  expect(response.ok()).toBeTruthy();
  return signInAccount(context, email, password);
}
