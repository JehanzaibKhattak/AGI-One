import {
  can,
  branchOf,
  inBranch,
  collectionArea,
  type Access,
  type Area,
  type AccessAction,
} from "@/lib/access";
import type { BaseRecord, Database } from "@/types";
import type { Command } from "@/lib/services/commands";
import { HttpError } from "./errors";
export function requirePermission(
  access: Access,
  area: Area,
  action: AccessAction,
) {
  if (!can(access, area, action))
    throw new HttpError(
      403,
      `Your access does not allow ${action} in ${area}.`,
    );
}
export function authorizeCommand(
  access: Access,
  raw: unknown,
  db: Database,
): "owner" | "editor" | "viewer" {
  if (!raw || typeof raw !== "object" || !("action" in raw))
    throw new HttpError(400, "Invalid command.");
  const command = raw as Command;
  const require = (area: Area, action: AccessAction) =>
    requirePermission(access, area, action);
  if (
    "collection" in command &&
    !Object.hasOwn(collectionArea, command.collection)
  )
    throw new HttpError(400, "Unknown record type.");
  switch (command.action) {
    case "configurePipeline":
      if (access.role !== "owner")
        throw new HttpError(403, "Only the owner can configure pipelines.");
      break;
    case "convertLead":
      require("sales", "edit");
      require("sales", "create");
      require("customers", "create");
      break;
    case "create":
      require(collectionArea[command.collection], "create");
      break;
    case "update":
      require(collectionArea[command.collection], "edit");
      if (command.collection === "expenses" && command.values.status === "Paid")
        require("finance", "approve");
      break;
    case "addNote":
      require(collectionArea[command.collection], "edit");
      break;
    case "receivePayment":
      require("finance", "create");
      break;
    case "convertQuotation":
    case "cancelOrder":
      require("sales", "edit");
      break;
    case "orderAction":
      require("sales", "edit");
      if (command.operation === "invoice") require("finance", "create");
      else require("inventory", "edit");
      break;
    case "transferStock":
      require("inventory", "edit");
      break;
    case "ticketAction":
      require("service", "edit");
      break;
    case "issuePart":
      require("service", "edit");
      require("inventory", "edit");
      break;
    case "receiveGoods":
      require("procurement", "edit");
      require("inventory", "edit");
      break;
    case "approveRequest": {
      const approval = db.approvals.find((a) => a.id === command.id);
      if (!approval) throw new HttpError(404, "Request not found.");
      require(approval.type === "expenses"
        ? "finance"
        : "procurement", "approve");
      break;
    }
    case "updateSettings":
      if (access.role !== "owner")
        throw new HttpError(
          403,
          "Only the workspace owner can change settings.",
        );
      break;
    case "markNotifications":
      break;
    default:
      throw new HttpError(400, "Unknown command.");
  }
  if (
    access.role === "owner" ||
    command.action === "approveRequest" ||
    (command.action === "update" &&
      command.collection === "expenses" &&
      command.values.status === "Paid")
  )
    return "owner";
  return command.action === "markNotifications" ? "viewer" : "editor";
}
export function branchDatabase(db: Database, access: Access) {
  const result = structuredClone(db);
  for (const collection of Object.keys(result) as (keyof Database)[]) {
    if (collection === "settings") continue;
    (result[collection] as BaseRecord[]) = (
      result[collection] as BaseRecord[]
    ).filter((r) => inBranch(access, collection, branchOf(db, collection, r)));
  }
  return result;
}
export function mergeChanges(
  before: Database,
  changed: Database,
  access: Access,
): Database {
  const merged = structuredClone(before);
  merged.settings = changed.settings;
  for (const collection of Object.keys(changed) as (keyof Database)[]) {
    if (collection === "settings") continue;
    const ids = new Set((changed[collection] as BaseRecord[]).map((r) => r.id));
    (merged[collection] as BaseRecord[]) = [
      ...(changed[collection] as BaseRecord[]),
      ...(before[collection] as BaseRecord[]).filter((r) => !ids.has(r.id)),
    ];
  }
  for (const collection of Object.keys(merged) as (keyof Database)[]) {
    if (collection === "settings" || collection === "audit") continue;
    const old = new Map(
      (before[collection] as BaseRecord[]).map((r) => [r.id, r]),
    );
    for (const row of merged[collection] as BaseRecord[]) {
      if (JSON.stringify(row) === JSON.stringify(old.get(row.id))) continue;
      if (!inBranch(access, collection, branchOf(merged, collection, row)))
        throw new HttpError(
          403,
          "This operation is outside your assigned branches.",
        );
    }
  }
  return merged;
}
