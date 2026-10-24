import { z } from "zod";
import { modules } from "@/lib/constants/modules";
import { createEngine, purchaseTotal } from "@/lib/services/engine";
import type { Database, Entity, Collection } from "@/types";
import type { Command } from "@/lib/services/commands";
import { HttpError } from "./errors";
const id = z.string().min(1).max(200);
const record = z.record(z.string().max(100), z.unknown());
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), collection: id, record }),
  z.object({ action: z.literal("update"), collection: id, id, values: record }),
  z.object({ action: z.literal("receivePayment"), payment: record }),
  z.object({
    action: z.literal("transferStock"),
    args: z.tuple([
      id,
      id,
      id,
      z.number().int().positive(),
      z.string().max(500),
      z.string().max(2000),
    ]),
  }),
  z.object({ action: z.literal("convertQuotation"), id }),
  z.object({
    action: z.literal("orderAction"),
    id,
    operation: z.enum(["reserve", "deliver", "invoice"]),
  }),
  z.object({
    action: z.literal("ticketAction"),
    id,
    name: z.string().min(1).max(200),
    description: z.string().max(5000),
    values: record,
  }),
  z.object({
    action: z.literal("approveRequest"),
    id,
    status: z.enum(["Approved", "Rejected", "Changes Requested"]),
  }),
  z.object({
    action: z.literal("receiveGoods"),
    args: z.tuple([id, id, z.string().min(1).max(500)]),
  }),
  z.object({
    action: z.literal("issuePart"),
    args: z.tuple([id, id, z.number().int().positive(), id]),
  }),
  z.object({ action: z.literal("cancelOrder"), id }),
  z.object({
    action: z.literal("updateSettings"),
    values: z.record(z.string().max(100), z.string().max(2000)),
  }),
  z.object({ action: z.literal("markNotifications"), id: id.optional() }),
  z.object({
    action: z.literal("addNote"),
    collection: id,
    id,
    note: z.string().trim().min(1).max(5000),
  }),
]);
const line = z.object({
  productId: id,
  description: z.string().min(1).max(1000),
  quantity: z.number().int().positive(),
  unitPrice: z.number().finite().min(0).max(1e12),
  discount: z.number().min(0).max(100),
  tax: z.number().min(0).max(100),
});
export function validateRecord(
  db: Database,
  collection: Collection,
  values: unknown,
) {
  const definition = modules.find((m) => m.key === collection);
  if (!definition || !values || typeof values !== "object")
    throw new Error("Unknown record type.");
  const row = values as Record<string, unknown>;
  z.object({
    id,
    name: z.string().trim().min(1).max(500),
    status: z.enum(definition.statuses as [string, ...string[]]),
    createdAt: z.string().min(1),
  }).parse(row);
  for (const field of definition.fields) {
    const value = row[field.key];
    if (field.required && (value === undefined || value === ""))
      throw new Error(`${field.label} is required.`);
    if (value === undefined || value === "") continue;
    if (field.type === "number")
      z.number()
        .finite()
        .min(0)
        .max(["probability", "compliance"].includes(field.key) ? 100 : 1e12)
        .parse(value);
    else if (field.type === "checkbox") z.boolean().parse(value);
    else z.string().max(10000).parse(value);
    if (field.type === "email") z.email().parse(value);
    if (field.type === "date" && !Number.isFinite(Date.parse(String(value))))
      throw new Error(`${field.label} must be a valid date.`);
    if (field.relation) {
      const linked = (
        db[field.relation] as (Entity<Collection> & {
          organizationId?: string;
        })[]
      ).find((r) => r.id === value);
      if (!linked)
        throw new Error(`${field.label} does not exist in this workspace.`);
      if (
        linked.organizationId &&
        row.organizationId &&
        linked.organizationId !== row.organizationId
      )
        throw new Error(`${field.label} must belong to this customer.`);
    }
  }
  if (["quotations", "invoices", "purchaseOrders"].includes(collection)) {
    if (
      collection !== "purchaseOrders" &&
      !db.organizations.some((o) => o.id === row.organizationId)
    )
      throw new Error("The customer does not exist in this workspace.");
    if (
      collection === "purchaseOrders" &&
      !db.suppliers.some((s) => s.id === row.supplierId)
    )
      throw new Error("The supplier does not exist in this workspace.");
    if (collection === "purchaseOrders") {
      z.number().finite().positive().parse(row.exchangeRate);
      for (const key of [
        "freight",
        "insurance",
        "customs",
        "clearing",
        "other",
      ])
        z.number().finite().min(0).parse(row[key]);
    }
    if (
      collection !== "purchaseOrders" &&
      row.currency &&
      row.currency !== db.settings.currency
    )
      throw new Error("Sales documents must use the workspace base currency.");
    if (
      collection === "invoices" &&
      (typeof row.date !== "string" ||
        typeof row.dueDate !== "string" ||
        row.dueDate < row.date)
    )
      throw new Error("Invoice dates are invalid.");
    const items = z.array(line).min(1).max(500).parse(row.items);
    for (const item of items)
      if (!db.products.some((p) => p.id === item.productId))
        throw new Error("A selected product does not exist.");
  }
}
function approvalAmount(collection: Collection, record: Entity<Collection>) {
  if (collection === "purchaseOrders") {
    const po = record as Entity<"purchaseOrders">;
    return purchaseTotal(po.items, po.exchangeRate, [
      po.freight,
      po.insurance,
      po.customs,
      po.clearing,
      po.other,
    ]);
  }
  const expense = record as Entity<"expenses">;
  return expense.amount + expense.tax;
}
export function executeCommand(
  db: Database,
  raw: unknown,
  actor: string,
  role: string,
) {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new HttpError(400, "Invalid operation or input.");
  const command = parsed.data as Command;
  function rejectUnsafeKeys(value: unknown) {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (["__proto__", "constructor", "prototype"].includes(key))
        throw new HttpError(400, "Invalid field name.");
      rejectUnsafeKeys(child);
    }
  }
  rejectUnsafeKeys(command);
  if (role === "viewer" && command.action !== "markNotifications")
    throw new HttpError(403, "Your workspace access is read-only.");
  if (command.action === "updateSettings" && role !== "owner")
    throw new HttpError(403, "Only the workspace owner can change settings.");
  const engine = createEngine(db, actor);
  let result: unknown;
  try {
    switch (command.action) {
      case "create": {
        if (command.collection === "approvals")
          throw new Error(
            "Approval requests are created by the submission workflow.",
          );
        validateRecord(db, command.collection, command.record);
        if (command.collection === "orders")
          throw new Error("Create orders by converting a quotation.");
        if (
          command.collection === "invoices" &&
          !["Draft", "Sent"].includes(command.record.status)
        )
          throw new Error("New invoices must be drafts or issued.");
        if (
          command.collection === "purchaseOrders" &&
          !["Draft", "Awaiting Approval"].includes(command.record.status)
        )
          throw new Error("Purchase orders require approval before receiving.");
        if (
          command.collection === "expenses" &&
          command.record.status !== "Awaiting Approval"
        )
          throw new Error("New expenses must await approval.");
        if (command.collection === "tickets") {
          (command.record as Entity<"tickets">).parts = [];
          (command.record as Entity<"tickets">).attachments = [];
        }
        if (
          ["quotations", "invoices", "purchaseOrders"].includes(
            command.collection,
          )
        )
          command.record.name = `${command.collection === "quotations" ? db.settings.quotationPrefix : command.collection === "invoices" ? db.settings.invoicePrefix : "PO-"}${db[command.collection].length + 1}`;
        engine
          .repository<Collection>(command.collection)
          .create(command.record);
        if (
          ["purchaseOrders", "expenses"].includes(command.collection) &&
          command.record.status === "Awaiting Approval"
        ) {
          engine.repository("approvals").create({
            id: crypto.randomUUID(),
            name: `Approve ${command.record.name}`,
            status: "Pending",
            createdAt: new Date().toISOString(),
            type: command.collection,
            requestedBy: actor,
            date: new Date().toISOString().slice(0, 10),
            amount: approvalAmount(command.collection, command.record),
            reason: "Submitted for approval",
            recordId: command.record.id,
          });
        }
        break;
      }
      case "update": {
        const current = (
          db[command.collection] as Entity<Collection>[] | undefined
        )?.find((r) => r.id === command.id);
        if (!current) throw new Error("Record not found.");
        if ("id" in command.values && command.values.id !== command.id)
          throw new Error("Record identifiers cannot change.");
        if (
          "createdAt" in command.values &&
          command.values.createdAt !== current.createdAt
        )
          throw new Error("Creation dates cannot change.");
        const editable = new Set([
          "name",
          "notes",
          ...modules
            .find((m) => m.key === command.collection)!
            .fields.map((f) => f.key),
          ...(["quotations", "invoices", "purchaseOrders"].includes(
            command.collection,
          )
            ? [
                "items",
                "status",
                "organizationId",
                "contactId",
                "supplierId",
                "date",
                "validUntil",
                "dueDate",
                "expectedArrival",
                "owner",
                "currency",
                "paymentTerms",
                "deliveryTerms",
                "warranty",
                "installationTerms",
                "exchangeRate",
                "shippingMethod",
                "terms",
                "freight",
                "insurance",
                "customs",
                "clearing",
                "other",
              ]
            : ["status"]),
        ]);
        for (const key of Object.keys(command.values))
          if (
            !editable.has(key) &&
            JSON.stringify(
              command.values[key as keyof typeof command.values],
            ) !==
              JSON.stringify(
                (current as unknown as Record<string, unknown>)[key],
              )
          )
            throw new Error(`The ${key} field cannot be changed here.`);
        if (command.collection === "invoices") {
          if (
            command.values.status &&
            !["Draft", "Sent", "Cancelled"].includes(command.values.status) &&
            command.values.status !== current.status
          )
            throw new Error("Payment status is calculated from receipts.");
          if (
            current.status !== "Draft" &&
            Object.keys(command.values).some(
              (key) =>
                !["status", "notes", "id", "createdAt"].includes(key) &&
                JSON.stringify(
                  (command.values as Record<string, unknown>)[key],
                ) !==
                  JSON.stringify(
                    (current as unknown as Record<string, unknown>)[key],
                  ),
            )
          )
            throw new Error(
              "Issued invoices are locked. Use a reversal workflow.",
            );
          if (current.status !== "Draft" && command.values.status === "Draft")
            throw new Error("Issued invoices cannot become drafts.");
        }
        if (
          command.collection === "expenses" &&
          command.values.status &&
          command.values.status !== current.status
        ) {
          if (current.status === "Awaiting Approval")
            throw new Error(
              "Use the approval workflow to decide this expense.",
            );
          if (
            role !== "owner" ||
            current.status !== "Approved" ||
            command.values.status !== "Paid"
          )
            throw new Error(
              "Only the owner can mark an approved expense paid.",
            );
        }
        const next = { ...current, ...command.values };
        validateRecord(db, command.collection, next);
        if (
          ["quotations", "purchaseOrders"].includes(command.collection) &&
          current.status !== "Draft" &&
          Object.keys(command.values).some(
            (k) => !["status", "notes"].includes(k),
          )
        )
          throw new Error("Only draft documents can be edited.");
        if (
          command.collection === "purchaseOrders" &&
          command.values.status &&
          command.values.status !== current.status &&
          !(
            current.status === "Draft" &&
            command.values.status === "Awaiting Approval"
          )
        )
          throw new Error("Use the approval or receiving workflow.");
        if (
          command.collection === "orders" &&
          Object.keys(command.values).some(
            (k) =>
              ![
                "name",
                "notes",
                "expectedDelivery",
                "status",
                "id",
                "createdAt",
              ].includes(k),
          )
        )
          throw new Error(
            "Order lines and customer are fixed after conversion.",
          );
        engine
          .repository(command.collection)
          .update(command.id, command.values);
        if (
          command.collection === "purchaseOrders" &&
          current.status === "Draft" &&
          command.values.status === "Awaiting Approval"
        )
          engine.repository("approvals").create({
            id: crypto.randomUUID(),
            name: `Approve ${current.name}`,
            status: "Pending",
            createdAt: new Date().toISOString(),
            type: "purchaseOrders",
            requestedBy: actor,
            date: new Date().toISOString().slice(0, 10),
            amount: approvalAmount(
              command.collection,
              next as Entity<Collection>,
            ),
            reason: "Submitted for approval",
            recordId: current.id,
          });
        break;
      }
      case "receivePayment":
        validateRecord(db, "payments", command.payment);
        command.payment.receivedBy = actor;
        engine.receivePayment(command.payment);
        break;
      case "transferStock":
        engine.transferStock(...command.args);
        break;
      case "convertQuotation":
        result = engine.convertQuotation(command.id);
        break;
      case "orderAction":
        result = engine.orderAction(command.id, command.operation);
        break;
      case "ticketAction": {
        if (
          Object.keys(command.values).some(
            (k) => !["status", "engineerId"].includes(k),
          )
        )
          throw new Error(
            "Use the stock workflow for replacement parts. File upload is not enabled.",
          );
        const current = db.tickets.find((t) => t.id === command.id);
        if (!current) throw new Error("Ticket not found.");
        validateRecord(db, "tickets", { ...current, ...command.values });
        engine.ticketAction(
          command.id,
          command.name,
          command.description,
          command.values,
        );
        break;
      }
      case "approveRequest":
        if (role !== "owner")
          throw new HttpError(403, "Only the owner can approve requests.");
        engine.approveRequest(command.id, command.status);
        break;
      case "receiveGoods":
        engine.receiveGoods(...command.args);
        break;
      case "issuePart":
        engine.issuePart(...command.args);
        break;
      case "cancelOrder":
        engine.cancelOrder(command.id);
        break;
      case "updateSettings": {
        const allowed = [
          "company",
          "email",
          "phone",
          "address",
          "currency",
          "tax",
          "paymentTerms",
          "sla",
          "quotationPrefix",
          "invoicePrefix",
          "branches",
          "timezone",
          "theme",
          "notifications",
        ];
        if (Object.keys(command.values).some((k) => !allowed.includes(k)))
          throw new Error("Unknown workspace preference.");
        if (
          command.values.currency &&
          command.values.currency !== db.settings.currency &&
          (db.invoices.length ||
            db.products.length ||
            db.quotations.length ||
            db.payments.length ||
            db.expenses.length ||
            db.banks.length ||
            db.purchaseOrders.length ||
            db.orders.length ||
            db.stock.length)
        )
          throw new Error(
            "Currency cannot change after financial records exist.",
          );
        if (command.values.currency)
          z.string()
            .regex(/^[A-Z]{3}$/)
            .parse(command.values.currency);
        if (command.values.tax)
          z.coerce.number().min(0).max(100).parse(command.values.tax);
        if (command.values.sla)
          z.coerce.number().int().min(1).max(8760).parse(command.values.sla);
        if (command.values.timezone)
          new Intl.DateTimeFormat("en", { timeZone: command.values.timezone });
        engine.updateSettings(command.values);
        break;
      }
      case "markNotifications":
        engine.markNotifications(command.id);
        break;
      case "addNote":
        if (
          !modules.some((m) => m.key === command.collection) ||
          ["audit", "users", "roles", "payments", "journals"].includes(
            command.collection,
          )
        )
          throw new Error("Notes are not allowed on this record.");
        engine.addNote(command.collection, command.id, command.note);
        break;
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(
      400,
      error instanceof z.ZodError
        ? "Some fields are invalid. Check the form values."
        : (error as Error).message,
    );
  }
  return { data: engine.getSnapshot(), result };
}
