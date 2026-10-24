import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  clearWorkspace,
  initialize,
  getSnapshot,
  getMember,
  repository,
} from "../lib/services/repository";
import { fixture } from "./fixtures";
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  clearWorkspace();
});
function response(email: string, name: string, revision = 1) {
  const data = fixture();
  data.settings.company = name;
  return Response.json({
    data,
    revision,
    member: { name, email, role: "owner" },
  });
}
test("a late workspace load cannot replace another signed-in account's data", async () => {
  clearWorkspace();
  let finish!: (value: Response) => void;
  globalThis.fetch = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  const previous = initialize();
  clearWorkspace();
  globalThis.fetch = async () =>
    response("second@example.com", "Second workspace");
  await initialize();
  finish(response("first@example.com", "First workspace"));
  assert.equal(await previous, false);
  assert.equal(getMember().email, "second@example.com");
  assert.equal(getSnapshot().settings.company, "Second workspace");
});
test("a mutation finishing after sign-out cannot restore the previous workspace", async () => {
  clearWorkspace();
  globalThis.fetch = async () =>
    response("first@example.com", "First workspace");
  await initialize();
  let finish!: (value: Response) => void;
  globalThis.fetch = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  const write = repository("organizations").update("customer", {
    name: "Pending update",
  });
  await Promise.resolve();
  clearWorkspace();
  finish(response("first@example.com", "First workspace", 2));
  await assert.rejects(write, /session changed/);
  assert.equal(getMember().email, "");
  assert.deepEqual(getSnapshot().organizations, []);
});
