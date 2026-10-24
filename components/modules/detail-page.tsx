"use client";
import { opportunityOutcome } from "@/lib/services/sales";
import { can, collectionArea } from "@/lib/access";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Pencil,
  Plus,
  ArrowUpRight,
  MapPin,
  Phone,
  Mail,
  Building2,
  CheckCircle2,
  FileText,
  Wrench,
  Send,
  Package,
  Truck,
  Receipt,
  Clock3,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeading, Badge, Stat, Empty, Modal } from "@/components/common/ui";
import { DataTable } from "@/components/tables/data-table";
import { RecordForm } from "@/components/forms/record-form";
import { useDatabase } from "@/lib/services/provider";
import {
  repository,
  getMember,
  ticketAction,
  customerBalance,
  invoiceBalance,
  convertQuotation,
  orderAction,
  addNote,
  issuePart,
  receiveGoods,
  cancelOrder,
} from "@/lib/services/repository";
import {
  type Module,
  moduleFor,
  displayRows,
  recordPath,
  cellLabel,
  type DisplayRow,
} from "@/lib/constants/modules";
import { money, initials, dateLabel, totals } from "@/lib/utils";
import type {
  BaseRecord,
  Collection,
  ServiceTicket,
  Equipment,
  QuotationItem,
} from "@/types";
export function DetailPage({ module, id }: { module: Module; id: string }) {
  const db = useDatabase();
  const router = useRouter();
  const [tab, setTab] = useState("Overview");
  const [edit, setEdit] = useState(false);
  const [action, setAction] = useState("");
  const [createKey, setCreateKey] = useState<Collection | null>(null);
  const record = (db[module.key] as BaseRecord[]).find((r) => r.id === id);
  const row = displayRows(db, module.key).find((r) => r.id === id);
  if (!record || !row)
    return (
      <Empty
        title="Record not found"
        description="This record may have been reset or the link is incorrect."
        action={
          <Link className="btn primary" href={module.path}>
            Back to {module.title}
          </Link>
        }
      />
    );
  const data = record as BaseRecord & Record<string, unknown>;
  const orgId =
    module.key === "organizations" ? id : String(data.organizationId || "");
  const org = db.organizations.find((o) => o.id === orgId);
  const ticket =
    module.key === "tickets" ? (record as ServiceTicket) : undefined;
  const equipment =
    module.key === "equipment"
      ? (record as Equipment)
      : ticket
        ? db.equipment.find((e) => e.id === ticket.equipmentId)
        : undefined;
  const tabs = module.tabs || ["Overview", "Notes", "Activity"];
  const isDoc = ["quotations", "invoices", "purchaseOrders"].includes(
    module.key,
  );
  const safe = async (
    fn: () => unknown | Promise<unknown>,
    message: string,
  ) => {
    try {
      await fn();
      toast.success(message);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const related = (
    key: Collection,
    filter?: (r: BaseRecord & Record<string, unknown>) => boolean,
  ) => {
    const ids = new Set(
      (db[key] as BaseRecord[])
        .filter((r) =>
          filter
            ? filter(r as BaseRecord & Record<string, unknown>)
            : (r as BaseRecord & { organizationId?: string }).organizationId ===
              orgId,
        )
        .map((r) => r.id),
    );
    return displayRows(db, key).filter((r) => ids.has(r.id));
  };
  const relatedTable = (key: Collection, rows?: DisplayRow[]) => {
    const m = moduleFor(key);
    return (
      <DataTable
        rows={rows || related(key)}
        columns={m.columns}
        name={key}
        onOpen={(rid) => router.push(recordPath(key, rid))}
      />
    );
  };
  const activities =
    module.key === "tickets"
      ? db.serviceActivities.filter((a) => a.ticketId === id)
      : module.key === "equipment"
        ? db.serviceActivities.filter((a) =>
            db.tickets.some((t) => t.id === a.ticketId && t.equipmentId === id),
          )
        : db.activities.filter(
            (a) => a.organizationId === orgId || a.recordId === id,
          );
  const timeline = (
    <div className="timeline">
      {activities.length ? (
        activities.map((a) => (
          <div className="timeline-item" key={a.id}>
            <span className="timeline-node">
              <CheckCircle2 size={15} />
            </span>
            <div>
              <strong>{a.name}</strong>
              <p>{a.description}</p>
              <small>
                {a.user} · {dateLabel(a.date)}
              </small>
            </div>
          </div>
        ))
      ) : (
        <Empty
          title="No activity yet"
          description="Notes and workflow updates will appear here."
        />
      )}
    </div>
  );
  const attributes = (
    <dl className="detail-grid">
      {module.fields
        .filter((f) => !["name", "notes"].includes(f.key))
        .map((f) => (
          <div key={f.key}>
            <dt>{f.label}</dt>
            <dd>
              {f.relation
                ? (db[f.relation] as BaseRecord[]).find(
                    (r) => r.id === data[f.key],
                  )?.name || "Not assigned"
                : cellLabel(f.key, data[f.key])}
            </dd>
          </div>
        ))}
    </dl>
  );
  const attachments =
    module.key === "tickets"
      ? ticket!.attachments
      : String(data.notes || "")
          .split("\n")
          .filter((s) => s.startsWith("Attachment: "))
          .map((s) => s.slice(12));
  const documents = (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Documents</h2>
          <p>
            Secure file uploads are not enabled yet. No files are stored by this
            page.
          </p>
        </div>
      </div>
      {attachments.length ? (
        <div className="document-list">
          {attachments.map((name, i) => (
            <div key={i}>
              <FileText size={20} />
              <strong>{name}</strong>
              <Badge>Legacy reference</Badge>
            </div>
          ))}
        </div>
      ) : (
        <Empty
          title="No attachments yet"
          description="File storage will be enabled before document uploads are available."
        />
      )}
    </section>
  );
  let content: React.ReactNode = null;
  if (tab === "Overview")
    content = (
      <div className="detail-layout">
        <section className="panel">
          <div className="panel-heading">
            <h2>
              {module.key === "organizations"
                ? "Organization details"
                : module.key === "tickets"
                  ? "Reported issue"
                  : "Record details"}
            </h2>
            <button
              className="text-btn"
              onClick={() =>
                isDoc
                  ? router.push(recordPath(module.key, id) + "/edit")
                  : setEdit(true)
              }
            >
              <Pencil size={14} />
              Edit
            </button>
          </div>
          {ticket && (
            <div className="issue-summary">
              <Badge>{ticket.priority}</Badge>
              <h3>{ticket.problem}</h3>
              <p>
                {equipment?.name} · {equipment?.serial}
              </p>
              <div className="sla-block">
                <Clock3 size={17} />
                <span>SLA deadline: {dateLabel(ticket.sla)}</span>
                <Badge>{row.slaStatus}</Badge>
              </div>
            </div>
          )}
          {attributes}
          {record.notes && (
            <div className="record-notes">
              <h3>Notes</h3>
              <p>{record.notes}</p>
            </div>
          )}
        </section>
        <aside>
          <section className="panel">
            <div className="panel-heading">
              <h2>
                {module.key === "tickets"
                  ? "Service timeline"
                  : "Recent activity"}
              </h2>
            </div>
            {timeline}
            <div className="panel-bottom">
              <button className="text-btn" onClick={() => setAction("note")}>
                <Plus size={14} />
                Add note
              </button>
            </div>
          </section>
          {org && module.key !== "organizations" && (
            <section className="panel linked-org">
              <span className="avatar company-avatar">
                {initials(org.name)}
              </span>
              <div>
                <small>LINKED CUSTOMER</small>
                <Link href={recordPath("organizations", org.id)}>
                  {org.name}
                  <ArrowUpRight size={14} />
                </Link>
                <span>{org.city}</span>
              </div>
            </section>
          )}
          {module.key === "organizations" && (
            <section className="panel upcoming-followups">
              <div className="panel-heading">
                <h2>Upcoming follow-ups</h2>
              </div>
              {db.opportunities
                .filter((o) => o.organizationId === id)
                .map((o) => (
                  <Link key={o.id} href={recordPath("opportunities", o.id)}>
                    <TargetIcon />
                    <span>
                      {o.nextActivity}
                      <small>
                        {dateLabel(o.closeDate)} · {o.owner}
                      </small>
                    </span>
                    <ArrowUpRight size={15} />
                  </Link>
                ))}
            </section>
          )}
        </aside>
      </div>
    );
  const tabMap: Record<string, Collection> = {
    Contacts: "contacts",
    Opportunities: "opportunities",
    Quotations: "quotations",
    Orders: "orders",
    Invoices: "invoices",
    Payments: "payments",
    "Installed Equipment": "equipment",
    "Service Tickets": "tickets",
    Contracts: "contracts",
    "Preventive Maintenance": "maintenance",
    Deliveries: "deliveries",
    "Goods Receipts": "goodsReceipts",
    "Today's Jobs": "tickets",
    "Upcoming PM": "maintenance",
    "Ticket History": "tickets",
  };
  if (tabMap[tab]) {
    const key = tabMap[tab];
    let filter:
      ((r: BaseRecord & Record<string, unknown>) => boolean) | undefined;
    if (module.key === "equipment")
      filter = (r) =>
        key === "contracts" ? r.id === data.contractId : r.equipmentId === id;
    if (module.key === "engineers")
      filter = (r) =>
        r.engineerId === id &&
        (tab !== "Today's Jobs" || !["Resolved", "Closed"].includes(r.status));
    if (module.key === "invoices" && key === "payments")
      filter = (r) => r.invoiceId === id;
    if (module.key === "orders") filter = (r) => r.orderId === id;
    if (module.key === "purchaseOrders")
      filter = (r) => r.purchaseOrderId === id;
    content = relatedTable(key, related(key, filter));
  }
  if (
    [
      "Activity",
      "Service Timeline",
      "Service History",
      "Timeline",
      "Follow-ups",
    ].includes(tab)
  )
    content = (
      <section className="panel">
        <div className="panel-heading">
          <h2>{tab}</h2>
          <button className="btn" onClick={() => setAction("note")}>
            <Plus size={15} />
            Add note
          </button>
        </div>
        {timeline}
      </section>
    );
  if (tab === "Documents") content = documents;
  if (tab === "Notes")
    content = (
      <section className="panel">
        <div className="panel-heading">
          <h2>Notes</h2>
          <button className="btn" onClick={() => setAction("note")}>
            <Plus size={15} />
            Add note
          </button>
        </div>
        <p className="notes-body">
          {record.notes || "No notes yet. Add context to help your team."}
        </p>
      </section>
    );
  if (tab === "Line Items") {
    const items = (data.items || []) as QuotationItem[];
    content = (
      <section className="panel">
        <div className="panel-heading">
          <h2>Line items</h2>
          <strong>{money(totals(items).total)}</strong>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {[
                  "Product",
                  "Quantity",
                  "Unit price",
                  "Discount",
                  "Tax",
                  "Total",
                ].map((s) => (
                  <th key={s}>{s}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i}>
                  <td>
                    <Link href={recordPath("products", item.productId)}>
                      {item.description}
                    </Link>
                  </td>
                  <td>{item.quantity}</td>
                  <td>{money(item.unitPrice)}</td>
                  <td>{item.discount}%</td>
                  <td>{item.tax}%</td>
                  <td>{money(totals([item]).total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }
  if (
    [
      "Stock",
      "Batches",
      "Serial Numbers",
      "Transactions",
      "Parts Carried",
      "Parts Used",
      "Purchases",
      "Sales",
    ].includes(tab)
  ) {
    let list: Record<string, unknown>[] = [];
    let columns: [string, string][] = [];
    if (tab === "Stock" || tab === "Parts Carried") {
      list = db.stock
        .filter((s) =>
          tab === "Parts Carried"
            ? s.warehouseId === "wh-4"
            : module.key === "warehouses"
              ? s.warehouseId === id
              : s.productId === id,
        )
        .map((s) => ({
          ...s,
          product: db.products.find((p) => p.id === s.productId)?.name,
          warehouse: db.warehouses.find((w) => w.id === s.warehouseId)?.name,
          available: s.quantity - s.reserved,
        }));
      columns = [
        ["product", "Product"],
        ["warehouse", "Warehouse"],
        ["quantity", "On hand"],
        ["reserved", "Reserved"],
        ["available", "Available"],
      ];
    }
    if (tab === "Batches") {
      list = db.batches
        .filter((b) => b.productId === id)
        .map((b) => ({ ...b }));
      columns = [
        ["lot", "Lot / batch"],
        ["manufacturingDate", "Manufactured"],
        ["expiry", "Expiry"],
        ["quantity", "Quantity"],
        ["status", "Status"],
      ];
    }
    if (tab === "Serial Numbers") {
      list = db.serials
        .filter((s) => s.productId === id)
        .map((s) => ({ ...s }));
      columns = [
        ["serial", "Serial number"],
        ["warranty", "Warranty"],
        ["status", "Status"],
      ];
    }
    if (tab === "Transactions" && module.key !== "banks") {
      list = db.transactions
        .filter((t) =>
          module.key === "warehouses"
            ? t.warehouseId === id || t.toWarehouseId === id
            : t.productId === id,
        )
        .map((t) => ({
          ...t,
          warehouse: db.warehouses.find((w) => w.id === t.warehouseId)?.name,
          destination:
            db.warehouses.find((w) => w.id === t.toWarehouseId)?.name || "—",
        }));
      columns = [
        ["date", "Date"],
        ["warehouse", "Warehouse"],
        ["destination", "Destination"],
        ["quantity", "Quantity"],
        ["reference", "Reference"],
        ["status", "Status"],
      ];
    }
    if (tab === "Transactions" && module.key === "banks") {
      list = db.payments
        .filter((p) => p.bankId === id)
        .map((p) => ({
          ...p,
          customer: db.organizations.find((o) => o.id === p.organizationId)
            ?.name,
        }));
      columns = [
        ["name", "Receipt"],
        ["customer", "Customer"],
        ["date", "Date"],
        ["amount", "Deposit"],
        ["reference", "Reference"],
      ];
    }
    if (tab === "Parts Used") {
      list = db.tickets
        .filter((t) => (ticket ? t.id === id : t.equipmentId === id))
        .flatMap((t) =>
          t.parts.map((p, i) => ({
            id: t.id + "-" + i,
            name: db.products.find((x) => x.id === p.productId)?.name,
            status: "Used",
            quantity: p.quantity,
            ticket: t.name,
          })),
        );
      columns = [
        ["name", "Part"],
        ["quantity", "Quantity"],
        ["ticket", "Ticket"],
      ];
    }
    if (tab === "Purchases" || tab === "Sales") {
      const key = tab === "Purchases" ? "purchaseOrders" : "orders";
      content = relatedTable(
        key,
        related(key, (r) =>
          (r.items as QuotationItem[]).some((i) => i.productId === id),
        ),
      );
    }
    if (!["Purchases", "Sales"].includes(tab))
      content = (
        <DataTable
          rows={list.map(
            (r, i) =>
              ({
                ...r,
                id: String(r.id || i),
                name: String(r.name || r.product || ""),
                status: String(r.status || "Available"),
              }) as DisplayRow,
          )}
          columns={columns}
          name={tab.toLowerCase()}
        />
      );
  }
  if (tab === "Service Compatibility")
    content = (
      <section className="panel text-panel">
        <h2>Service compatibility</h2>
        <p>
          {String(
            data.compatibility ||
              "No equipment compatibility restrictions recorded.",
          )}
        </p>
        <p>Part number: {String(data.partNumber || "—")}</p>
      </section>
    );
  if (tab === "Performance")
    content = (
      <div className="stats-grid">
        <Stat label="Completed this month" value={String(data.completed)} />
        <Stat label="Average response" value={String(data.responseTime)} />
        <Stat label="SLA compliance" value={String(data.compliance) + "%"} />
        <Stat label="Current jobs" value={Number(row.jobs)} />
      </div>
    );
  if (tab === "Landed Costs")
    content = (
      <section className="panel">
        <div className="panel-heading">
          <h2>Estimated landed cost</h2>
          <strong>{money(Number(row.total))}</strong>
        </div>
        <dl className="detail-grid">
          {[
            "currency",
            "exchangeRate",
            "freight",
            "insurance",
            "customs",
            "clearing",
            "other",
          ].map((k) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>
                {typeof data[k] === "number" && k !== "exchangeRate"
                  ? money(Number(data[k]))
                  : String(data[k])}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    );
  if (
    [
      "Products",
      "Competitors",
      "Technical Requirements",
      "Financial Proposal",
      "Result",
    ].includes(tab) &&
    module.key === "tenders"
  ) {
    const text =
      tab === "Products"
        ? data.products
        : tab === "Competitors"
          ? data.competitors
          : tab === "Technical Requirements"
            ? data.technical
            : tab === "Financial Proposal"
              ? `Estimated value: ${money(Number(data.value))}. Bid bond: ${money(Number(data.bidBond))}.`
              : record!.status;
    content = (
      <section className="panel text-panel">
        <h2>{tab}</h2>
        <p>{String(text || "No details recorded.")}</p>
        <button className="btn" onClick={() => setEdit(true)}>
          <Pencil size={15} />
          Update tender
        </button>
      </section>
    );
  }
  if (tab === "Reconciliation")
    content = (
      <section className="panel text-panel">
        <h2>Bank reconciliation</h2>
        <p>
          Statement matching is under development. Compare records with your
          bank statement; this screen does not certify reconciliation.
        </p>
        <p>
          Opening balance: {money(Number(data.openingBalance))} · Deposits:{" "}
          {money(Number(row.deposits))}
        </p>
        <h3>Closing balance: {money(Number(row.balance))}</h3>
        <button
          className="btn primary"
          disabled={Boolean(data.reconciled)}
          onClick={() =>
            safe(() => {
              throw new Error("Statement matching is not available yet.");
            }, "Account marked reconciled")
          }
        >
          <CheckCircle2 size={15} />
          {data.reconciled ? "Reconciled" : "Mark as reconciled"}
        </button>
      </section>
    );
  function renderHeader() {
    return (
      <>
        <Link href={module.path} className="text-btn back-link">
          <ArrowLeft size={15} />
          Back to {module.title.toLowerCase()}
        </Link>
        <PageHeading
          title={record!.name}
          description={`${module.singular} · ${String(data.code || data.serial || id)}${org ? " · " + org.city : ""}`}
        >
          <Badge>{record!.status}</Badge>
          {can(getMember(), collectionArea[module.key], "edit") &&
            ![
              "payments",
              "orders",
              "journals",
              "goodsReceipts",
              "transactions",
              "deliveries",
              "audit",
            ].includes(module.key) && (
              <button
                className="btn"
                onClick={() =>
                  isDoc
                    ? router.push(recordPath(module.key, id) + "/edit")
                    : setEdit(true)
                }
              >
                <Pencil size={15} />
                Edit details
              </button>
            )}
          {module.key === "organizations" && (
            <Link
              className="btn primary"
              href={`/sales/quotations/new?customer=${id}`}
            >
              <Plus size={15} />
              Create quotation
            </Link>
          )}
          {module.key === "tickets" && (
            <button
              className="btn primary"
              disabled={["Resolved", "Closed"].includes(record!.status)}
              onClick={() =>
                safe(
                  async () =>
                    await ticketAction(
                      id,
                      "Resolved",
                      "Equipment tested and returned to operation.",
                      { status: "Resolved" },
                    ),
                  "Ticket resolved",
                )
              }
            >
              <CheckCircle2 size={15} />
              Resolve ticket
            </button>
          )}
        </PageHeading>
        {module.key === "organizations" && (
          <>
            <div className="profile-contact">
              <span>
                <MapPin size={14} />
                {org?.city}
              </span>
              <a href={`tel:${org?.phone}`}>
                <Phone size={14} />
                {org?.phone}
              </a>
              <a href={`mailto:${org?.email}`}>
                <Mail size={14} />
                {org?.email}
              </a>
              <span>
                <Building2 size={14} />
                {org?.type}
              </span>
            </div>
            <div className="stats-grid five-stats">
              <Stat
                label="Lifetime sales"
                value={money(
                  db.invoices
                    .filter(
                      (i) =>
                        i.organizationId === id && i.status !== "Cancelled",
                    )
                    .reduce((s, i) => s + totals(i.items).total, 0),
                  true,
                )}
              />
              <Stat
                label="Outstanding balance"
                value={money(customerBalance(db, id), true)}
              />
              <Stat
                label="Open opportunities"
                value={
                  db.opportunities.filter(
                    (o) =>
                      o.organizationId === id &&
                      opportunityOutcome(o) === "open",
                  ).length
                }
              />
              <Stat
                label="Installed equipment"
                value={
                  db.equipment.filter((e) => e.organizationId === id).length
                }
              />
              <Stat
                label="Active contracts"
                value={
                  db.contracts.filter(
                    (c) => c.organizationId === id && c.status === "Active",
                  ).length
                }
              />
            </div>
          </>
        )}
        {module.key === "opportunities" && (
          <div className="pipeline-summary">
            <div>
              <span>Estimated revenue</span>
              <strong>{money(Number(data.value))}</strong>
            </div>
            <div>
              <span>Probability</span>
              <strong>{String(data.probability)}%</strong>
            </div>
            <label className="field">
              Stage
              <select
                value={record!.status}
                onChange={(e) =>
                  safe(
                    () =>
                      repository("opportunities").update(id, {
                        status: e.target.value,
                      }),
                    "Stage updated",
                  )
                }
              >
                {module.statuses.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>
        )}
        {module.key === "quotations" && (
          <div className="workflow-actions">
            <button
              className="btn"
              onClick={() =>
                safe(
                  () => repository("quotations").update(id, { status: "Sent" }),
                  "Quotation marked sent",
                )
              }
            >
              <Send size={15} />
              Mark as sent
            </button>
            <button
              className="btn primary"
              onClick={() =>
                safe(
                  async () =>
                    router.push(
                      recordPath("orders", await convertQuotation(id)),
                    ),
                  "Sales order created",
                )
              }
            >
              Convert to sales order <ArrowUpRight size={15} />
            </button>
            <button
              className="btn"
              onClick={() =>
                router.push(recordPath("quotations", id) + "/edit")
              }
            >
              <FileText size={15} />
              Preview / PDF
            </button>
          </div>
        )}
        {module.key === "purchaseOrders" && record!.status === "Approved" && (
          <form
            className="workflow-actions"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void safe(
                () =>
                  receiveGoods(
                    id,
                    String(form.get("warehouse")),
                    String(form.get("reference")),
                  ),
                "Goods received and stock updated",
              );
            }}
          >
            <label className="field">
              Receiving warehouse
              <select name="warehouse" required>
                <option value="">Choose warehouse</option>
                {db.warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Reference
              <input required name="reference" />
            </label>
            <button className="btn primary">Receive goods</button>
          </form>
        )}
        {module.key === "orders" &&
          ["Confirmed", "Reserved"].includes(record!.status) && (
            <button
              className="btn danger-outline"
              onClick={() =>
                void safe(
                  () => cancelOrder(id),
                  "Order cancelled and reservations released",
                )
              }
            >
              Cancel order
            </button>
          )}
        {module.key === "orders" && (
          <div className="workflow-actions">
            {(["reserve", "deliver", "invoice"] as const).map((a, i) => (
              <button
                key={a}
                className="btn"
                disabled={
                  a === "reserve"
                    ? record!.status !== "Confirmed"
                    : a === "deliver"
                      ? record!.status !== "Reserved"
                      : record!.status !== "Delivered"
                }
                onClick={() =>
                  safe(
                    async () => {
                      const result = await orderAction(id, a);
                      if (result) router.push(recordPath("invoices", result));
                    },
                    a === "reserve"
                      ? "Stock reserved"
                      : a === "deliver"
                        ? "Delivery recorded"
                        : "Invoice created",
                  )
                }
              >
                {i === 0 ? (
                  <Package size={15} />
                ) : i === 1 ? (
                  <Truck size={15} />
                ) : (
                  <Receipt size={15} />
                )}{" "}
                {a === "reserve"
                  ? "Reserve stock"
                  : a === "deliver"
                    ? "Create delivery"
                    : "Create invoice"}
              </button>
            ))}
          </div>
        )}
        {ticket && (
          <div className="workflow-actions">
            <button className="btn" onClick={() => setAction("assign")}>
              Assign engineer
            </button>
            <label className="inline-label">
              Status
              <select
                value={ticket.status}
                onChange={(e) =>
                  safe(
                    async () =>
                      await ticketAction(
                        id,
                        e.target.value,
                        `Ticket status changed to ${e.target.value}.`,
                        { status: e.target.value },
                      ),
                    "Ticket status updated",
                  )
                }
              >
                {module.statuses.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <button className="btn" onClick={() => setAction("note")}>
              <Plus size={15} />
              Add note
            </button>
            <button className="btn" onClick={() => setAction("part")}>
              <Wrench size={15} />
              Add part
            </button>
          </div>
        )}
        {module.key === "invoices" && (
          <div className="workflow-actions">
            <strong className="balance-callout">
              Balance due {money(invoiceBalance(db, id))}
            </strong>
            <button
              className="btn primary"
              disabled={invoiceBalance(db, id) <= 0}
              onClick={() => setCreateKey("payments")}
            >
              Receive payment
            </button>
            {record!.status === "Draft" && (
              <button
                className="btn"
                onClick={() =>
                  safe(
                    () => repository("invoices").update(id, { status: "Sent" }),
                    "Invoice issued",
                  )
                }
              >
                Issue invoice
              </button>
            )}
            <button
              className="btn"
              onClick={() => router.push(recordPath("invoices", id) + "/edit")}
            >
              Preview / PDF
            </button>
          </div>
        )}
        {module.key === "maintenance" && (
          <div className="workflow-actions">
            <button
              className="btn primary"
              disabled={record!.status === "Completed"}
              onClick={() =>
                safe(
                  () =>
                    repository("maintenance").update(id, {
                      status: "Completed",
                    }),
                  "Maintenance visit completed",
                )
              }
            >
              Complete visit
            </button>
          </div>
        )}
        <div className="tabs detail-tabs">
          {tabs.map((t) => (
            <button
              key={t}
              className={tab === t ? "active" : ""}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </>
    );
  }
  return (
    <>
      {renderHeader()}
      {content || (
        <Empty
          title="No records yet"
          description="Related records will appear as you work in this module."
        />
      )}
      {edit && (
        <RecordForm
          module={module}
          record={record}
          onClose={() => setEdit(false)}
        />
      )}{" "}
      {createKey && (
        <RecordForm
          module={moduleFor(createKey)}
          defaults={{
            organizationId: orgId,
            invoiceId: id,
            amount: invoiceBalance(db, id),
            name: `REC-${5101 + db.payments.length}`,
          }}
          onClose={() => setCreateKey(null)}
        />
      )}
      <Modal
        open={!!action}
        onOpenChange={(v) => {
          if (!v) setAction("");
        }}
        title={
          action === "assign"
            ? "Assign engineer"
            : action === "part"
              ? "Add replacement part"
              : "Add note"
        }
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            try {
              if (action === "assign") {
                const engineerId = String(f.get("engineer"));
                await ticketAction(
                  id,
                  "Engineer Assigned",
                  db.engineers.find((e) => e.id === engineerId)!.name,
                  { engineerId, status: "Assigned" },
                );
              } else if (action === "part") {
                const productId = String(f.get("product"));
                const quantity = Number(f.get("quantity"));
                if (quantity <= 0 || !Number.isInteger(quantity))
                  throw new Error("Enter a positive whole quantity.");
                await issuePart(
                  id,
                  productId,
                  quantity,
                  String(f.get("warehouse")),
                );
              } else {
                const note = String(f.get("note")).trim();
                if (!note) throw new Error("Enter a note.");
                if (ticket) await ticketAction(id, "Note added", note);
                else await addNote(module.key, id, note);
              }
              toast.success("Record updated");
              setAction("");
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
        >
          <div className="form-grid">
            {action === "assign" ? (
              <label className="field full">
                Engineer
                <select name="engineer" required>
                  <option value="">Select engineer</option>
                  {db.engineers.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} · {e.city}
                    </option>
                  ))}
                </select>
              </label>
            ) : action === "part" ? (
              <>
                <label className="field full">
                  Warehouse
                  <select required name="warehouse">
                    <option value="">Choose warehouse</option>
                    {db.warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field full">
                  Replacement part
                  <select name="product" required>
                    <option value="">Choose a part</option>
                    {db.products
                      .filter((p) => p.category === "Spare Parts")
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="field">
                  Quantity
                  <input
                    name="quantity"
                    type="number"
                    min="1"
                    step="1"
                    defaultValue="1"
                    required
                  />
                </label>
              </>
            ) : (
              <label className="field full">
                Note
                <textarea name="note" required rows={4} />
              </label>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn" onClick={() => setAction("")}>
              Cancel
            </button>
            <button className="btn primary">Save</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
function TargetIcon() {
  return (
    <span className="followup-icon">
      <Clock3 size={17} />
    </span>
  );
}
