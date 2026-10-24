"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  LayoutGrid,
  List,
  ArrowUpRight,
  ArrowRightLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  UserRound,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeading, Stat, Badge, Modal } from "@/components/common/ui";
import { DataTable } from "@/components/tables/data-table";
import { RecordForm } from "@/components/forms/record-form";
import { useDatabase } from "@/lib/services/provider";
import {
  repository,
  transferStock,
  approveRequest,
  customerBalance,
  getMember,
} from "@/lib/services/repository";
import {
  type Module,
  displayRows,
  recordPath,
  moduleFor,
  cellLabel,
} from "@/lib/constants/modules";
import { money, initials, dateLabel, today, daysFromNow } from "@/lib/utils";
import type { BaseRecord, Collection } from "@/types";
import {
  addMonths,
  format,
  startOfMonth,
  getDaysInMonth,
  getDay,
} from "date-fns";
export function ModulePage({ module }: { module: Module }) {
  const db = useDatabase();
  const router = useRouter();
  const [create, setCreate] = useState(false);
  const [peek, setPeek] = useState<string | null>(null);
  const [view, setView] = useState(
    module.key === "opportunities"
      ? "board"
      : module.key === "engineers"
        ? "cards"
        : "table",
  );
  const [tab, setTab] = useState("All");
  const [transfer, setTransfer] = useState(false);
  const [bulk, setBulk] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState(module.statuses[0] || "");
  const [month, setMonth] = useState(new Date());
  const rows = displayRows(db, module.key);
  const visible = tab === "All" ? rows : rows.filter((r) => r.status === tab);
  const selected = rows.find((r) => r.id === peek);
  const raw = (db[module.key] as BaseRecord[]).find((r) => r.id === peek);
  const isDoc = ["quotations", "invoices", "purchaseOrders"].includes(
    module.key,
  );
  const isReadOnly = [
    "audit",
    "payments",
    "journals",
    "goodsReceipts",
    "transactions",
    "deliveries",
  ].includes(module.key);
  const add = () =>
    isDoc ? router.push(module.path + "/new") : setCreate(true);
  const statusTabs = [
    "organizations",
    "tickets",
    "invoices",
    "products",
    "contracts",
    "tenders",
  ].includes(module.key);
  const title =
    module.key === "organizations"
      ? "Your customer relationships"
      : module.title;
  return (
    <>
      <PageHeading
        title={title}
        description={module.description}
        eyebrow={
          module.key === "organizations" ? "CUSTOMER RELATIONSHIPS" : undefined
        }
      >
        {module.key === "warehouses" && (
          <button className="btn" onClick={() => setTransfer(true)}>
            <ArrowRightLeft size={15} />
            Transfer stock
          </button>
        )}
        {getMember().role !== "viewer" &&
          ![
            "audit",
            "journals",
            "goodsReceipts",
            "transactions",
            "deliveries",
            "orders",
            "approvals",
            "users",
            "roles",
          ].includes(module.key) && (
            <button className="btn primary" onClick={add}>
              <Plus size={16} />
              {module.key === "payments"
                ? "Receive payment"
                : `New ${module.singular.toLowerCase()}`}
            </button>
          )}
      </PageHeading>
      {module.key === "organizations" && (
        <div className="stats-grid">
          <Stat label="Total organizations" value={db.organizations.length} />
          <Stat
            label="Active relationships"
            value={db.organizations.filter((o) => o.status === "Active").length}
          />
          <Stat
            label="Open opportunities"
            value={
              db.opportunities.filter(
                (o) => !["Won", "Lost"].includes(o.status),
              ).length
            }
          />
          <Stat
            label="Outstanding balance"
            value={money(
              db.organizations.reduce(
                (s, o) => s + customerBalance(db, o.id),
                0,
              ),
              true,
            )}
          />
        </div>
      )}
      {module.key === "products" && (
        <div className="stats-grid inventory-stats">
          <Stat
            label="Inventory value"
            value={money(
              rows.reduce((s, r) => s + Number(r.stockValue), 0),
              true,
            )}
          />
          <Stat label="Total SKUs" value={rows.length} />
          <Stat
            label="Low stock"
            value={rows.filter((r) => r.status === "Low Stock").length}
          />
          <Stat
            label="Out of stock"
            value={rows.filter((r) => r.status === "Out of Stock").length}
          />
          <Stat
            label="Expiring soon"
            value={db.batches.filter((b) => b.expiry < daysFromNow(30)).length}
          />
          <Stat
            label="Reserved stock"
            value={rows.reduce((s, r) => s + Number(r.reserved), 0)}
          />
        </div>
      )}
      {module.key === "tickets" && (
        <div className="stats-grid">
          <Stat
            label="Open tickets"
            value={
              rows.filter((r) => !["Resolved", "Closed"].includes(r.status))
                .length
            }
          />
          <Stat
            label="Critical priority"
            value={rows.filter((r) => r.priority === "Critical").length}
          />
          <Stat
            label="SLA breached"
            value={rows.filter((r) => r.slaStatus === "Breached").length}
          />
          <Stat
            label="Resolved / closed"
            value={
              rows.filter((r) => ["Resolved", "Closed"].includes(r.status))
                .length
            }
          />
        </div>
      )}
      {module.key === "equipment" && (
        <div className="equipment-banner">
          <span className="equipment-banner-icon">✚</span>
          <div>
            <h2>Connected care starts with reliable equipment.</h2>
            <p>
              {db.equipment.length} registered assets ·{" "}
              {new Set(db.equipment.map((e) => e.organizationId)).size} customer
              sites · Complete lifecycle visibility
            </p>
          </div>
          <Badge>
            {db.equipment.filter((e) => e.status === "Installed").length}{" "}
            installed
          </Badge>
        </div>
      )}
      {module.key === "opportunities" && (
        <div className="pipeline-summary">
          <div>
            <span>Total pipeline</span>
            <strong>
              {money(
                db.opportunities
                  .filter((o) => !["Won", "Lost"].includes(o.status))
                  .reduce((s, o) => s + o.value, 0),
                true,
              )}
            </strong>
          </div>
          <div>
            <span>Weighted revenue</span>
            <strong>
              {money(
                db.opportunities
                  .filter((o) => !["Won", "Lost"].includes(o.status))
                  .reduce((s, o) => s + (o.value * o.probability) / 100, 0),
                true,
              )}
            </strong>
          </div>
          <div>
            <span>Won this month</span>
            <strong className="green-text">
              {money(
                db.opportunities
                  .filter((o) => o.status === "Won")
                  .reduce((s, o) => s + o.value, 0),
                true,
              )}
            </strong>
          </div>
          <div className="segmented">
            <button
              className={view === "board" ? "active" : ""}
              onClick={() => setView("board")}
            >
              <LayoutGrid size={15} />
              Board
            </button>
            <button
              className={view === "table" ? "active" : ""}
              onClick={() => setView("table")}
            >
              <List size={15} />
              Table
            </button>
          </div>
        </div>
      )}
      {[
        "suppliers",
        "purchaseOrders",
        "purchaseRequests",
        "goodsReceipts",
      ].includes(module.key) && (
        <>
          <div className="tabs route-tabs">
            {(
              [
                "suppliers",
                "purchaseRequests",
                "purchaseOrders",
                "goodsReceipts",
              ] as Collection[]
            ).map((key) => (
              <Link
                className={module.key === key ? "active" : ""}
                href={moduleFor(key).path}
                key={key}
              >
                {key === "suppliers" ? "Suppliers" : moduleFor(key).title}
              </Link>
            ))}
          </div>
          <div className="procurement-flow">
            {[
              "Purchase request",
              "Approval",
              "Purchase order",
              "Shipment",
              "Goods receipt",
              "Supplier invoice",
              "Payment",
            ].map((s, i) => (
              <span key={s}>
                <b>{i + 1}</b>
                {s}
                {i < 6 && <ArrowRight size={13} />}
              </span>
            ))}
          </div>
        </>
      )}
      {module.key === "contracts" && (
        <div className="stats-grid">
          <Stat
            label="Active contracts"
            value={rows.filter((r) => r.status === "Active").length}
          />
          <Stat
            label="Expiring in 30 days"
            value={rows.filter((r) => r.renewal === "Within 30 days").length}
          />
          <Stat
            label="Expiring in 60 days"
            value={
              rows.filter((r) =>
                ["Within 30 days", "Within 60 days"].includes(
                  String(r.renewal),
                ),
              ).length
            }
          />
          <Stat
            label="Expiring in 90 days"
            value={
              rows.filter((r) => String(r.renewal).startsWith("Within")).length
            }
          />
        </div>
      )}
      {module.key === "invoices" && (
        <div className="stats-grid">
          <Stat
            label="Total invoiced"
            value={money(
              rows.reduce((s, r) => s + Number(r.total), 0),
              true,
            )}
          />
          <Stat
            label="Collected"
            value={money(
              rows.reduce((s, r) => s + Number(r.paid), 0),
              true,
            )}
          />
          <Stat
            label="Outstanding"
            value={money(
              rows.reduce((s, r) => s + Number(r.balance), 0),
              true,
            )}
          />
          <Stat
            label="Overdue invoices"
            value={rows.filter((r) => r.status === "Overdue").length}
          />
        </div>
      )}
      {module.key === "tenders" && (
        <div className="stats-grid">
          <Stat
            label="Active bids"
            value={
              rows.filter((r) => !["Won", "Lost"].includes(r.status)).length
            }
          />
          <Stat
            label="Estimated pipeline"
            value={money(
              db.tenders
                .filter((t) => !["Won", "Lost"].includes(t.status))
                .reduce((s, t) => s + t.value, 0),
              true,
            )}
          />
          <Stat
            label="Bid bonds"
            value={money(
              db.tenders.reduce((s, t) => s + t.bidBond, 0),
              true,
            )}
          />
          <Stat
            label="Won"
            value={rows.filter((r) => r.status === "Won").length}
          />
        </div>
      )}
      {module.key === "warehouses" && (
        <div className="warehouse-cards">
          {rows.map((w) => (
            <button
              className="panel warehouse-card"
              key={w.id}
              onClick={() => setPeek(w.id)}
            >
              <span className="warehouse-icon">
                <LayoutGrid size={21} />
              </span>
              <h3>{w.name}</h3>
              <p>
                {w.city} · {w.manager}
              </p>
              <strong>{money(Number(w.stockValue), true)}</strong>
              <div>
                <span>{w.stock} units</span>
                <Badge>{w.lowStock} low stock</Badge>
              </div>
            </button>
          ))}
        </div>
      )}
      {["maintenance", "engineers"].includes(module.key) && (
        <div className="view-toolbar">
          <span className="muted">
            {rows.length} {module.title.toLowerCase()}
          </span>
          <div className="segmented">
            <button
              className={view === "table" ? "active" : ""}
              onClick={() => setView("table")}
            >
              <List size={15} />
              Table
            </button>
            <button
              className={view !== "table" ? "active" : ""}
              onClick={() =>
                setView(module.key === "maintenance" ? "calendar" : "cards")
              }
            >
              {module.key === "maintenance" ? (
                <CalendarDays size={15} />
              ) : (
                <LayoutGrid size={15} />
              )}{" "}
              {module.key === "maintenance" ? "Calendar" : "Cards"}
            </button>
          </div>
        </div>
      )}
      {statusTabs && (
        <div className="tabs">
          <button
            className={tab === "All" ? "active" : ""}
            onClick={() => setTab("All")}
          >
            All {module.title.toLowerCase()} <span>{rows.length}</span>
          </button>
          {[...new Set(rows.map((r) => r.status))].slice(0, 5).map((s) => (
            <button
              key={s}
              className={tab === s ? "active" : ""}
              onClick={() => setTab(s)}
            >
              {s}
              <span>{rows.filter((r) => r.status === s).length}</span>
            </button>
          ))}
        </div>
      )}
      {view === "board" && module.key === "opportunities" ? (
        <div className="kanban">
          {module.statuses.map((stage, index) => {
            const opportunities = db.opportunities.filter(
              (o) => o.status === stage,
            );
            return (
              <section className="kanban-column" key={stage}>
                <div className="kanban-heading">
                  <span className={`stage-dot stage-${index}`} />
                  <h3>{stage}</h3>
                  <span>{opportunities.length}</span>
                  <button
                    className="icon-btn"
                    aria-label={`New ${stage} opportunity`}
                    onClick={() => setCreate(true)}
                  >
                    <Plus size={15} />
                  </button>
                </div>
                <div className="kanban-value">
                  {money(
                    opportunities.reduce((s, o) => s + o.value, 0),
                    true,
                  )}
                </div>
                {opportunities.map((o) => (
                  <article className="deal-card" key={o.id}>
                    <button
                      className="deal-title"
                      onClick={() =>
                        router.push(recordPath("opportunities", o.id))
                      }
                    >
                      {
                        db.organizations.find((c) => c.id === o.organizationId)
                          ?.name
                      }
                    </button>
                    <p>{o.name}</p>
                    <strong>{money(o.value, true)}</strong>
                    <div className="deal-meta">
                      <CalendarDays size={12} />
                      {dateLabel(o.closeDate)}
                      <span>{o.probability}%</span>
                    </div>
                    <div className="deal-next">
                      <Clock size={12} />
                      {o.nextActivity}
                    </div>
                    <div className="deal-footer">
                      <span className="avatar tiny" title={o.owner}>
                        {initials(o.owner)}
                      </span>
                      <select
                        aria-label={`Stage for ${o.name} at ${db.organizations.find((c) => c.id === o.organizationId)?.name}`}
                        value={o.status}
                        onChange={async (e) => {
                          try {
                            await repository("opportunities").update(o.id, {
                              status: e.target.value,
                              probability: [10, 25, 40, 55, 75, 90, 100, 0][
                                module.statuses.indexOf(e.target.value)
                              ],
                            });
                            toast.success("Opportunity stage updated");
                          } catch (error) {
                            toast.error((error as Error).message);
                          }
                        }}
                      >
                        {module.statuses.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </article>
                ))}
                {!opportunities.length && (
                  <div className="kanban-empty">No opportunities yet</div>
                )}
              </section>
            );
          })}
        </div>
      ) : view === "calendar" && module.key === "maintenance" ? (
        <section className="panel">
          <div className="panel-heading">
            <h2>{format(month, "MMMM yyyy")}</h2>
            <div className="heading-actions">
              <button
                className="icon-btn"
                aria-label="Previous month"
                onClick={() => setMonth(addMonths(month, -1))}
              >
                <ChevronLeft size={17} />
              </button>
              <button className="btn" onClick={() => setMonth(new Date())}>
                Today
              </button>
              <button
                className="icon-btn"
                aria-label="Next month"
                onClick={() => setMonth(addMonths(month, 1))}
              >
                <ChevronRight size={17} />
              </button>
            </div>
          </div>
          <div className="calendar-grid">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div className="calendar-label" key={d}>
                {d}
              </div>
            ))}
            {Array.from({ length: getDay(startOfMonth(month)) }, (_, i) => (
              <div className="calendar-day blank" key={`blank-${i}`} />
            ))}
            {Array.from({ length: getDaysInMonth(month) }, (_, i) => {
              const date =
                format(month, "yyyy-MM") + "-" + String(i + 1).padStart(2, "0");
              return (
                <div
                  className={`calendar-day ${date === today(db.settings.timezone) ? "today" : ""}`}
                  key={date}
                >
                  <span>{i + 1}</span>
                  {db.maintenance
                    .filter((m) => m.nextPM === date)
                    .map((m) => (
                      <button
                        className="calendar-event"
                        key={m.id}
                        onClick={() => setPeek(m.id)}
                      >
                        <strong>
                          {
                            db.organizations.find(
                              (o) => o.id === m.organizationId,
                            )?.name
                          }
                        </strong>
                        <small>
                          {
                            db.engineers.find((e) => e.id === m.engineerId)
                              ?.name
                          }
                        </small>
                        <Badge>{m.status}</Badge>
                      </button>
                    ))}
                </div>
              );
            })}
          </div>
        </section>
      ) : view === "cards" && module.key === "engineers" ? (
        <div className="engineer-grid">
          {db.engineers.map((e) => (
            <section className="panel engineer-card" key={e.id}>
              <div>
                <span className="avatar large">{initials(e.name)}</span>
                <Badge>{e.status}</Badge>
              </div>
              <h2>{e.name}</h2>
              <p>
                <UserRound size={14} />
                {e.city} · Field Service Engineer
              </p>
              <div className="engineer-metrics">
                <div>
                  <strong>
                    {
                      db.tickets.filter(
                        (t) =>
                          t.engineerId === e.id &&
                          !["Closed", "Resolved"].includes(t.status),
                      ).length
                    }
                  </strong>
                  <span>Current jobs</span>
                </div>
                <div>
                  <strong>{e.completed}</strong>
                  <span>Completed</span>
                </div>
                <div>
                  <strong>{e.compliance}%</strong>
                  <span>SLA compliance</span>
                </div>
              </div>
              <Link className="btn" href={recordPath("engineers", e.id)}>
                View engineer
                <ArrowUpRight size={14} />
              </Link>
            </section>
          ))}
        </div>
      ) : (
        <DataTable
          rows={visible}
          columns={module.columns}
          filters={module.filters}
          name={module.key}
          onOpen={setPeek}
          onBulk={
            !isReadOnly &&
            module.statuses.length &&
            ![
              "orders",
              "quotations",
              "invoices",
              "purchaseOrders",
              "approvals",
            ].includes(module.key)
              ? (ids) => setBulk(ids)
              : undefined
          }
        />
      )}

      <Modal
        open={!!peek}
        onOpenChange={(v) => {
          if (!v) setPeek(null);
        }}
        title={selected?.name || "Record details"}
        description={module.singular}
        drawer
      >
        {selected && (
          <>
            <div className="drawer-summary">
              <div className="avatar large">{initials(selected.name)}</div>
              <div>
                <h2>{selected.name}</h2>
                <Badge>{selected.status}</Badge>
              </div>
            </div>
            <dl className="detail-grid">
              {module.columns
                .filter(([key]) => !["name", "status"].includes(key))
                .map(([key, label]) => (
                  <div key={key}>
                    <dt>{label}</dt>
                    <dd>
                      {["before", "after"].includes(key) ? (
                        <span className="break-text">
                          {cellLabel(key, selected[key])}
                        </span>
                      ) : (
                        cellLabel(key, selected[key])
                      )}
                    </dd>
                  </div>
                ))}
            </dl>
            {module.key === "approvals" ? (
              <div className="drawer-actions">
                {["Approved", "Rejected", "Changes Requested"].map((s) => (
                  <button
                    className={`btn ${s === "Approved" ? "primary" : ""}`}
                    key={s}
                    disabled={selected.status !== "Pending"}
                    onClick={() => {
                      void approveRequest(selected.id, s)
                        .then(() => toast.success(`Request ${s.toLowerCase()}`))
                        .catch((e) => toast.error(e.message));
                    }}
                  >
                    <ShieldCheck size={15} />
                    {s === "Approved"
                      ? "Approve"
                      : s === "Rejected"
                        ? "Reject"
                        : "Request changes"}
                  </button>
                ))}
              </div>
            ) : (
              module.key !== "audit" && (
                <div className="drawer-actions">
                  <Link
                    className="btn primary"
                    href={recordPath(module.key, selected.id)}
                  >
                    Open {module.singular.toLowerCase()}{" "}
                    <ArrowUpRight size={15} />
                  </Link>
                  {module.key === "organizations" && (
                    <>
                      <Link
                        className="btn"
                        href={`/sales/quotations/new?customer=${selected.id}`}
                      >
                        Create quotation
                      </Link>
                      <button
                        className="btn"
                        onClick={() => {
                          setCreate(true);
                        }}
                      >
                        Create service ticket
                      </button>
                    </>
                  )}
                  {!isDoc && !isReadOnly && module.key !== "organizations" && (
                    <button className="btn" onClick={() => setCreate(true)}>
                      Edit details
                    </button>
                  )}
                </div>
              )
            )}
          </>
        )}
      </Modal>
      {create && (
        <RecordForm
          module={
            peek && module.key === "organizations"
              ? moduleFor("tickets")
              : module
          }
          record={peek && module.key !== "organizations" ? raw : undefined}
          defaults={
            peek && module.key === "organizations"
              ? { organizationId: peek }
              : undefined
          }
          onClose={() => setCreate(false)}
        />
      )}
      <Modal
        open={bulk.length > 0}
        onOpenChange={(v) => {
          if (!v) setBulk([]);
        }}
        title={`Update ${bulk.length} records`}
        description="Apply a status to all selected records."
      >
        <div className="form-grid">
          <label className="field full">
            New status
            <select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value)}
            >
              {module.statuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={() => setBulk([])}>
            Cancel
          </button>
          <button
            className="btn primary"
            onClick={() => {
              void (async () => {
                try {
                  for (const id of bulk)
                    await repository(module.key).update(id, {
                      status: bulkStatus,
                    });
                  setBulk([]);
                  toast.success("Selected records updated");
                } catch (error) {
                  toast.error((error as Error).message);
                }
              })();
            }}
          >
            Apply status
          </button>
        </div>
      </Modal>
      {transfer && <StockTransfer onClose={() => setTransfer(false)} />}
    </>
  );
}
export function StockTransfer({ onClose }: { onClose: () => void }) {
  const db = useDatabase();
  const [error, setError] = useState("");
  return (
    <Modal
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      title="Transfer stock"
      description="Available quantities update in both warehouses."
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          try {
            await transferStock(
              String(f.get("from")),
              String(f.get("to")),
              String(f.get("product")),
              Number(f.get("quantity")),
              String(f.get("reference")),
              String(f.get("notes")),
            );
            toast.success("Stock transferred");
            onClose();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <div className="form-grid">
          {["from", "to"].map((key) => (
            <label className="field" key={key}>
              {key === "from" ? "From warehouse" : "To warehouse"}
              <select required name={key}>
                <option value="">Choose warehouse</option>
                {db.warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <label className="field full">
            Product
            <select name="product" required>
              <option value="">Select product</option>
              {db.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Quantity
            <input type="number" min="1" step="1" required name="quantity" />
          </label>
          <label className="field">
            Reference
            <input name="reference" required />
          </label>
          <label className="field full">
            Notes
            <textarea name="notes" />
          </label>
        </div>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary">
            <ArrowRightLeft size={15} />
            Transfer stock
          </button>
        </div>
      </form>
    </Modal>
  );
}
