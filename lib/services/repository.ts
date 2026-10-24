import type { Access, Branch } from "@/lib/access";
import { setBaseCurrency } from "@/lib/utils";
import { createEmptyDatabase } from "@/lib/database/empty";
import type { BaseRecord, Database, Collection, Entity } from "@/types";
import type { Command } from "./commands";
export {
  uid,
  invoiceBalance,
  customerBalance,
  paidAmount,
  purchaseTotal,
} from "./engine";
export class WorkspaceAccessError extends Error {
  constructor(public destination: string) {
    super("Please sign in or create a workspace.");
  }
}
let database = createEmptyDatabase();
const serverDatabase = database;
let revision = 0;
let sessionEpoch = 0;
let loadSequence = 0;
type Member = Access & {
  id?: string;
  name: string;
  email: string;
  branches?: Branch[];
};
let member: Member = { name: "", email: "", role: "viewer" };
let readMode: "full" | "directory" = "full";
const listeners = new Set<() => void>();
export const getSnapshot = () => database;
export const getServerSnapshot = () => serverDatabase;
export const getMember = () => member;
export const getRevision = () => revision;
export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function notify() {
  listeners.forEach((fn) => fn());
}
export function clearWorkspace() {
  sessionEpoch++;
  loadSequence++;
  database = createEmptyDatabase();
  revision = 0;
  member = { name: "", email: "", role: "viewer" };
  setBaseCurrency("USD");
  notify();
}
export async function initialize(mode: "full" | "directory" = readMode) {
  readMode = mode;
  const sequence = ++loadSequence;
  const response = await fetch(
    "/api/workspace" + (mode === "directory" ? "?mode=directory" : ""),
    { cache: "no-store" },
  );
  if (response.status === 401) throw new WorkspaceAccessError("/login");
  if (response.status === 403) throw new WorkspaceAccessError("/onboarding");
  const body = await response.json();
  if (!response.ok)
    throw new Error(body.error || "Unable to load your workspace.");
  if (sequence !== loadSequence) return false;
  if (body.revision < revision && body.member.email === member.email)
    return true;
  database = body.data;
  setBaseCurrency(database.settings.currency);
  revision = body.revision;
  member = body.member;
  notify();
  return true;
}
let pending = Promise.resolve();
function dispatch(
  command: Command,
  expectedRevision = revision,
): Promise<unknown> {
  const epoch = sessionEpoch;
  const principal = member.email;
  const next = pending.then(async () => {
    if (epoch !== sessionEpoch || principal !== member.email)
      throw new Error("Your session changed. Please reopen the record.");
    const response = await fetch(
      "/api/workspace" + (readMode === "directory" ? "?mode=directory" : ""),
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision: expectedRevision, command }),
      },
    );
    const body = await response.json();
    if (!response.ok) {
      if (response.status === 409) await initialize();
      throw new Error(body.error || "Unable to save changes.");
    }
    if (epoch !== sessionEpoch || principal !== member.email)
      throw new Error("Your session changed. Please reopen the record.");
    if (body.changes) {
      const next = structuredClone(database);
      for (const collection of Object.keys(
        body.changes,
      ) as (keyof Database)[]) {
        if (collection === "settings") {
          next.settings = body.changes.settings;
          continue;
        }
        if (
          readMode === "directory" &&
          !["audit", "notifications", "pipelines"].includes(collection)
        )
          continue;
        const rows = body.changes[collection] as BaseRecord[];
        const ids = new Set(rows.map((r) => r.id));
        (next[collection] as BaseRecord[]) = [
          ...rows,
          ...(next[collection] as BaseRecord[]).filter((r) => !ids.has(r.id)),
        ];
      }
      database = next;
    } else database = body.data;
    setBaseCurrency(database.settings.currency);
    revision = body.revision;
    notify();
    return body.result;
  });
  pending = next.then(
    () => {},
    () => {},
  );
  return next;
}
export function repository<K extends Collection>(collection: K) {
  return {
    getAll: () => database[collection] as Entity<K>[],
    getById: (id: string) =>
      (database[collection] as Entity<K>[]).find((r) => r.id === id),
    create: (record: Entity<K>, expectedRevision?: number) =>
      dispatch({ action: "create", collection, record }, expectedRevision),
    update: (
      id: string,
      values: Partial<Entity<K>>,
      expectedRevision?: number,
    ) =>
      dispatch({ action: "update", collection, id, values }, expectedRevision),
  };
}
export const receivePayment = (payment: Entity<"payments">) =>
  dispatch({ action: "receivePayment", payment });
export const transferStock = (
  ...args: [string, string, string, number, string, string]
) => dispatch({ action: "transferStock", args });
export const convertQuotation = async (id: string) =>
  String(await dispatch({ action: "convertQuotation", id }));
export const orderAction = async (
  id: string,
  operation: "reserve" | "deliver" | "invoice",
) => String((await dispatch({ action: "orderAction", id, operation })) || "");
export const ticketAction = (
  id: string,
  name: string,
  description: string,
  values: Partial<Entity<"tickets">> = {},
) => dispatch({ action: "ticketAction", id, name, description, values });
export const approveRequest = (id: string, status: string) =>
  dispatch({ action: "approveRequest", id, status });
export const receiveGoods = (...args: [string, string, string]) =>
  dispatch({ action: "receiveGoods", args });
export const issuePart = (...args: [string, string, number, string]) =>
  dispatch({ action: "issuePart", args });
export const cancelOrder = (id: string) =>
  dispatch({ action: "cancelOrder", id });
export const updateSettings = (
  values: Record<string, string>,
  expectedRevision?: number,
) => dispatch({ action: "updateSettings", values }, expectedRevision);
export const markNotifications = (id?: string) =>
  dispatch({ action: "markNotifications", id });
export const addNote = (collection: Collection, id: string, note: string) =>
  dispatch({ action: "addNote", collection, id, note });

export const salesCommand = (
  command: Extract<Command, { action: "convertLead" | "configurePipeline" }>,
  expectedRevision?: number,
) => dispatch(command, expectedRevision);
