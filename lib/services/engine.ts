import type { Database, Collection, Entity, QuotationItem } from "@/types";
import { totals, today } from "@/lib/utils";
import { createEmptyDatabase } from "@/lib/database/empty";
export const uid = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
export function invoiceBalance(db: Database, invoiceId: string) {
  const invoice = db.invoices.find((i) => i.id === invoiceId);
  return !invoice || ["Draft", "Cancelled"].includes(invoice.status)
    ? 0
    : Math.max(0, totals(invoice.items).total - paidAmount(db, invoiceId));
}
export function paidAmount(db: Database, id: string) {
  return db.payments
    .filter((p) => p.invoiceId === id)
    .reduce((sum, p) => sum + p.amount, 0);
}
export function customerBalance(db: Database, id: string) {
  return db.invoices
    .filter((i) => i.organizationId === id)
    .reduce((sum, i) => sum + invoiceBalance(db, i.id), 0);
}
export function purchaseTotal(
  items: QuotationItem[],
  rate: number,
  costs: number[],
) {
  return totals(items).total * rate + costs.reduce((a, b) => a + b, 0);
}
export function createEngine(
  initial: Database = createEmptyDatabase(),
  actor = "System",
) {
  let database = structuredClone(initial);
  function commit(change: (draft: Database) => void) {
    const draft = structuredClone(database);
    change(draft);
    database = draft;
  }
  function audit(
    draft: Database,
    module: string,
    action: string,
    record: string,
    before: string,
    after: string,
  ) {
    draft.audit.unshift({
      id: uid("audit"),
      name: `${action} ${record}`,
      status: "Recorded",
      createdAt: new Date().toISOString(),
      user: actor,
      module,
      action,
      record,
      before,
      after,
      device: "Server",
    });
  }
  function repository<K extends Collection>(collection: K) {
    return {
      getAll: () => database[collection] as Entity<K>[],
      getById: (id: string) =>
        (database[collection] as Entity<K>[]).find((r) => r.id === id),
      create: (record: Entity<K>) =>
        commit((d) => {
          if (
            [
              "audit",
              "roles",
              "users",
              "payments",
              "stock",
              "transactions",
              "deliveries",
              "goodsReceipts",
              "journals",
            ].includes(collection)
          )
            throw new Error("Use the dedicated workflow for this record.");
          if (
            (d[collection] as Entity<K>[]).some(
              (r) =>
                r.id === record.id ||
                (r.name === record.name &&
                  [
                    "orders",
                    "quotations",
                    "invoices",
                    "purchaseOrders",
                  ].includes(collection)),
            )
          )
            throw new Error("A record with this identifier already exists.");
          if (collection === "orders" && record.status !== "Confirmed")
            throw new Error(
              "New orders must be confirmed before stock allocation.",
            );
          (d[collection] as Entity<K>[]).unshift(record);
          audit(d, collection, "Created", record.name, "", record.status);
        }),
      update: (id: string, values: Partial<Entity<K>>) =>
        commit((d) => {
          const record = (d[collection] as Entity<K>[]).find(
            (r) => r.id === id,
          );
          if (!record) throw new Error("This record could not be found.");
          if (
            [
              "audit",
              "roles",
              "users",
              "payments",
              "stock",
              "transactions",
              "deliveries",
              "goodsReceipts",
              "journals",
            ].includes(collection)
          )
            throw new Error("Posted or system records cannot be edited here.");
          if (
            collection === "orders" &&
            ((values.status && values.status !== record.status) ||
              record.status !== "Confirmed")
          )
            throw new Error(
              "Use the order workflow to reserve, deliver or cancel stock.",
            );
          if (
            collection === "invoices" &&
            d.payments.some((p) => p.invoiceId === id)
          )
            throw new Error(
              "Invoices with payments are locked. Use a credit or reversal workflow.",
            );
          const before = JSON.stringify(record);
          Object.assign(record, values);
          audit(
            d,
            collection,
            "Updated",
            record.name,
            before,
            JSON.stringify(values),
          );
        }),
    };
  }
  function receivePayment(payment: Database["payments"][number]) {
    commit((d) => {
      const invoice = d.invoices.find((i) => i.id === payment.invoiceId);
      if (!invoice || invoice.organizationId !== payment.organizationId)
        throw new Error("Choose an invoice belonging to this customer.");
      if (invoice.status === "Cancelled" || invoice.status === "Draft")
        throw new Error("Payments require an issued invoice.");
      if (
        !Number.isFinite(payment.amount) ||
        payment.amount <= 0 ||
        payment.amount > invoiceBalance(d, invoice.id) + 0.005
      )
        throw new Error(
          "Payment must be positive and cannot exceed the outstanding balance.",
        );
      if (
        d.payments.some((p) => p.id === payment.id || p.name === payment.name)
      )
        throw new Error("Receipt already exists.");
      if (!d.banks.some((b) => b.id === payment.bankId))
        throw new Error("Choose an existing bank account.");
      d.payments.unshift(payment);
      invoice.status =
        invoiceBalance(d, invoice.id) < 0.01 ? "Paid" : "Partially Paid";
      audit(
        d,
        "payments",
        "Received",
        payment.name,
        "",
        String(payment.amount),
      );
    });
  }
  function transferStock(
    from: string,
    to: string,
    productId: string,
    quantity: number,
    reference: string,
    notes: string,
  ) {
    commit((d) => {
      if (from === to)
        throw new Error("Choose different source and destination warehouses.");
      if (!Number.isInteger(quantity) || quantity <= 0)
        throw new Error("Enter a positive whole quantity.");
      const source = d.stock.find(
        (s) => s.productId === productId && s.warehouseId === from,
      );
      if (!source || source.quantity - source.reserved < quantity)
        throw new Error(
          "Insufficient available stock in the source warehouse.",
        );
      if (!d.warehouses.some((w) => w.id === to))
        throw new Error("Destination warehouse not found.");
      source.quantity -= quantity;
      let destination = d.stock.find(
        (s) => s.productId === productId && s.warehouseId === to,
      );
      if (!destination) {
        destination = {
          id: uid("stock"),
          name: "Transferred stock",
          status: "Available",
          createdAt: new Date().toISOString(),
          productId,
          warehouseId: to,
          quantity: 0,
          reserved: 0,
        };
        d.stock.push(destination);
      }
      destination.quantity += quantity;
      d.transactions.unshift({
        id: uid("txn"),
        name: reference || "Stock transfer",
        status: "Transferred",
        createdAt: new Date().toISOString(),
        productId,
        warehouseId: from,
        toWarehouseId: to,
        quantity,
        reference,
        notes,
        date: new Date().toISOString(),
      });
      audit(d, "stock", "Transferred", productId, from, to);
    });
  }
  function convertQuotation(id: string) {
    let orderId = "";
    commit((d) => {
      const q = d.quotations.find((q) => q.id === id);
      if (!q) throw new Error("Quotation not found.");
      if (d.orders.some((o) => o.quotationId === id))
        throw new Error("This quotation already has a sales order.");
      if (["Rejected", "Expired"].includes(q.status))
        throw new Error("Only active quotations can be converted.");
      orderId = uid("ord");
      if (!q.items.length)
        throw new Error("A quotation needs at least one line item.");
      q.status = "Accepted";
      d.orders.unshift({
        id: orderId,
        name: `SO-${d.orders.length + 1}`,
        status: "Confirmed",
        createdAt: new Date().toISOString(),
        organizationId: q.organizationId,
        quotationId: id,
        date: today(d.settings.timezone),
        expectedDelivery: today(d.settings.timezone),
        total: totals(q.items).total,
        fulfilment: "0%",
        payment: "Unpaid",
        items: structuredClone(q.items),
      });
      audit(d, "orders", "Converted", q.name, "Quotation", "Sales Order");
    });
    return orderId;
  }
  function orderAction(id: string, action: "reserve" | "deliver" | "invoice") {
    let result = "";
    commit((d) => {
      const order = d.orders.find((o) => o.id === id);
      if (!order) throw new Error("Order not found.");
      if (action === "reserve") {
        if (order.status !== "Confirmed")
          throw new Error("Only confirmed orders can be reserved.");
        const allocations: NonNullable<
          Database["orders"][number]["allocations"]
        > = [];
        const required = new Map<string, number>();
        order.items.forEach((i) =>
          required.set(
            i.productId,
            (required.get(i.productId) || 0) + i.quantity,
          ),
        );
        for (const [productId, quantity] of required) {
          let remaining = quantity;
          const stocks = d.stock.filter((s) => s.productId === productId);
          if (
            stocks.reduce((s, x) => s + x.quantity - x.reserved, 0) < quantity
          )
            throw new Error("Insufficient stock to reserve this order.");
          for (const stock of stocks) {
            const count = Math.min(remaining, stock.quantity - stock.reserved);
            stock.reserved += count;
            if (count)
              allocations.push({
                productId,
                warehouseId: stock.warehouseId,
                quantity: count,
              });
            remaining -= count;
            if (!remaining) break;
          }
        }
        order.allocations = allocations;
        order.status = "Reserved";
      } else if (action === "deliver") {
        if (order.status !== "Reserved")
          throw new Error("Reserve stock before creating a delivery.");
        if (!order.allocations?.length)
          throw new Error("This order has no stock allocation.");
        for (const allocation of order.allocations) {
          const stock = d.stock.find(
            (s) =>
              s.productId === allocation.productId &&
              s.warehouseId === allocation.warehouseId,
          );
          if (
            !stock ||
            stock.reserved < allocation.quantity ||
            stock.quantity < allocation.quantity
          )
            throw new Error("Allocated stock is no longer available.");
          stock.reserved -= allocation.quantity;
          stock.quantity -= allocation.quantity;
          d.transactions.unshift({
            id: uid("txn"),
            name: order.name,
            status: "Delivered",
            createdAt: new Date().toISOString(),
            productId: allocation.productId,
            warehouseId: allocation.warehouseId,
            toWarehouseId: "",
            quantity: -allocation.quantity,
            reference: order.name,
            date: new Date().toISOString(),
          });
        }
        order.status = "Delivered";
        order.fulfilment = "100%";
        d.deliveries.unshift({
          id: uid("del"),
          name: `DN-${d.deliveries.length + 101}`,
          status: "Delivered",
          createdAt: new Date().toISOString(),
          organizationId: order.organizationId,
          orderId: id,
          date: new Date().toISOString(),
          warehouseId: order.allocations[0].warehouseId,
          reference: order.name,
        });
      } else {
        if (order.status !== "Delivered")
          throw new Error("Deliver the order before invoicing.");
        if (d.invoices.some((i) => i.orderId === id))
          throw new Error("This order has already been invoiced.");
        result = uid("inv");
        d.invoices.unshift({
          id: result,
          name: `${d.settings.invoicePrefix || "INV-"}${d.invoices.length + 1}`,
          status: "Draft",
          createdAt: new Date().toISOString(),
          organizationId: order.organizationId,
          orderId: id,
          date: today(d.settings.timezone),
          dueDate: new Date(Date.now() + 30 * 86400000)
            .toISOString()
            .slice(0, 10),
          owner: actor,
          items: structuredClone(order.items),
        });
      }
      audit(d, "orders", action, order.name, "", order.status);
    });
    return result;
  }
  function ticketAction(
    id: string,
    name: string,
    description: string,
    values: Partial<Database["tickets"][number]> = {},
  ) {
    commit((d) => {
      const ticket = d.tickets.find((t) => t.id === id);
      if (!ticket) throw new Error("Ticket not found.");
      if ("parts" in values || "attachments" in values)
        throw new Error("Use the dedicated inventory or file workflow.");
      Object.assign(ticket, values);
      d.serviceActivities.unshift({
        id: uid("sa"),
        name,
        status: "Recorded",
        createdAt: new Date().toISOString(),
        ticketId: id,
        date: new Date().toISOString(),
        user: actor,
        description,
      });
      audit(d, "tickets", name, ticket.name, "", description);
    });
  }
  function approveRequest(id: string, status: string) {
    commit((d) => {
      const approval = d.approvals.find((a) => a.id === id);
      if (!approval) throw new Error("Approval not found.");
      if (approval.status !== "Pending")
        throw new Error("This request has already been decided.");
      if (!["Approved", "Rejected", "Changes Requested"].includes(status))
        throw new Error("Invalid approval decision.");
      approval.status = status;
      if (approval.recordId) {
        const record = (
          approval.type === "purchaseOrders"
            ? d.purchaseOrders
            : approval.type === "expenses"
              ? d.expenses
              : []
        ).find((r) => r.id === approval.recordId);
        if (record) record.status = status;
      }
      audit(d, "approvals", status, approval.name, "Pending", status);
    });
  }

  function receiveGoods(
    purchaseOrderId: string,
    warehouseId: string,
    reference: string,
  ) {
    commit((d) => {
      const po = d.purchaseOrders.find((p) => p.id === purchaseOrderId);
      if (!po || po.status !== "Approved")
        throw new Error("Only approved purchase orders can be received.");
      if (!d.warehouses.some((w) => w.id === warehouseId))
        throw new Error("Choose an existing warehouse.");
      if (d.goodsReceipts.some((g) => g.purchaseOrderId === purchaseOrderId))
        throw new Error("This purchase order has already been received.");
      for (const item of po.items) {
        let stock = d.stock.find(
          (s) =>
            s.productId === item.productId && s.warehouseId === warehouseId,
        );
        if (!stock) {
          stock = {
            id: uid("stock"),
            name: "Warehouse stock",
            status: "Available",
            createdAt: new Date().toISOString(),
            productId: item.productId,
            warehouseId,
            quantity: 0,
            reserved: 0,
          };
          d.stock.push(stock);
        }
        stock.quantity += item.quantity;
        d.transactions.unshift({
          id: uid("txn"),
          name: po.name,
          status: "Received",
          createdAt: new Date().toISOString(),
          productId: item.productId,
          warehouseId,
          toWarehouseId: "",
          quantity: item.quantity,
          reference,
          date: new Date().toISOString(),
        });
      }
      d.goodsReceipts.unshift({
        id: uid("grn"),
        name: `GRN-${d.goodsReceipts.length + 1}`,
        status: "Received",
        createdAt: new Date().toISOString(),
        purchaseOrderId,
        warehouseId,
        reference,
        date: new Date().toISOString(),
      });
      po.status = "Received";
      audit(d, "goodsReceipts", "Received", po.name, "", reference);
    });
  }
  function issuePart(
    ticketId: string,
    productId: string,
    quantity: number,
    warehouseId: string,
  ) {
    commit((d) => {
      const ticket = d.tickets.find((t) => t.id === ticketId);
      if (!ticket || ["Closed", "Resolved"].includes(ticket.status))
        throw new Error("Choose an open service ticket.");
      if (!Number.isInteger(quantity) || quantity <= 0)
        throw new Error("Enter a positive whole quantity.");
      const stock = d.stock.find(
        (s) => s.productId === productId && s.warehouseId === warehouseId,
      );
      if (!stock || stock.quantity - stock.reserved < quantity)
        throw new Error("Insufficient available stock.");
      stock.quantity -= quantity;
      ticket.parts.push({ productId, quantity });
      d.transactions.unshift({
        id: uid("txn"),
        name: ticket.name,
        status: "Service issue",
        createdAt: new Date().toISOString(),
        productId,
        warehouseId,
        toWarehouseId: "",
        quantity: -quantity,
        reference: ticket.name,
        date: new Date().toISOString(),
      });
      audit(
        d,
        "tickets",
        "Part issued",
        ticket.name,
        "",
        `${productId}: ${quantity}`,
      );
    });
  }
  function cancelOrder(id: string) {
    commit((d) => {
      const order = d.orders.find((o) => o.id === id);
      if (!order || !["Confirmed", "Reserved"].includes(order.status))
        throw new Error("Only confirmed or reserved orders can be cancelled.");
      for (const a of order.allocations || []) {
        const stock = d.stock.find(
          (s) => s.productId === a.productId && s.warehouseId === a.warehouseId,
        );
        if (!stock || stock.reserved < a.quantity)
          throw new Error("Stock allocation is inconsistent.");
        stock.reserved -= a.quantity;
      }
      order.allocations = [];
      order.status = "Cancelled";
      audit(d, "orders", "Cancelled", order.name, "", "Cancelled");
    });
  }
  return {
    getSnapshot: () => database,
    repository,
    receivePayment,
    transferStock,
    convertQuotation,
    orderAction,
    ticketAction,
    approveRequest,
    receiveGoods,
    issuePart,
    cancelOrder,
    updateSettings: (values: Record<string, string>) =>
      commit((d) => {
        d.settings = { ...d.settings, ...values };
        audit(
          d,
          "settings",
          "Updated",
          "Workspace settings",
          "",
          JSON.stringify(values),
        );
      }),
    markNotifications: (id?: string) =>
      commit((d) => {
        d.notifications
          .filter((n) => !id || n.id === id)
          .forEach((n) => (n.read = true));
      }),
    addNote: (collection: Collection, id: string, note: string) =>
      commit((d) => {
        const record = (d[collection] as Entity<Collection>[]).find(
          (r) => r.id === id,
        );
        if (!record || !note.trim())
          throw new Error("Record and note are required.");
        record.notes = (record.notes || "") + "\n" + note.trim();
        audit(d, collection, "Note added", record.name, "", note);
      }),
  };
}
