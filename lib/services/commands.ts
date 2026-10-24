import type { Collection, Entity } from "@/types";
export type Command =
  | { action: "create"; collection: Collection; record: Entity<Collection> }
  | {
      action: "update";
      collection: Collection;
      id: string;
      values: Partial<Entity<Collection>>;
    }
  | { action: "receivePayment"; payment: Entity<"payments"> }
  | {
      action: "transferStock";
      args: [string, string, string, number, string, string];
    }
  | { action: "convertQuotation"; id: string }
  | {
      action: "orderAction";
      id: string;
      operation: "reserve" | "deliver" | "invoice";
    }
  | {
      action: "ticketAction";
      id: string;
      name: string;
      description: string;
      values: Partial<Entity<"tickets">>;
    }
  | { action: "approveRequest"; id: string; status: string }
  | { action: "receiveGoods"; args: [string, string, string] }
  | { action: "issuePart"; args: [string, string, number, string] }
  | { action: "cancelOrder"; id: string }
  | { action: "updateSettings"; values: Record<string, string> }
  | { action: "markNotifications"; id?: string }
  | { action: "addNote"; collection: Collection; id: string; note: string };
