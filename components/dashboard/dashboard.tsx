"use client";
import { opportunityOutcome } from "@/lib/services/sales";
import { can, areaForPath, collectionArea } from "@/lib/access";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Plus,
  Users,
  Target,
  Receipt,
  Wrench,
  Download,
} from "lucide-react";
import { PageHeading, Stat, Empty, Badge } from "@/components/common/ui";
import { useDatabase } from "@/lib/services/provider";
import { getMember, invoiceBalance } from "@/lib/services/repository";
import { money, totals, today, exportCSV } from "@/lib/utils";
import { RecordForm } from "@/components/forms/record-form";
import { moduleFor } from "@/lib/constants/modules";
import { RevenueChart, MiniBar } from "./charts";
import type { Collection } from "@/types";
export function Dashboard() {
  const db = useDatabase();
  const financeVisible = can(getMember(), "finance", "view");

  const current = today(db.settings.timezone);
  const [from, setFrom] = useState(current.slice(0, 7) + "-01");
  const [to, setTo] = useState(current);
  const [create, setCreate] = useState<Collection | null>(null);
  const inRange = (date: string) =>
    date.slice(0, 10) >= from && date.slice(0, 10) <= to;
  const invoices = db.invoices.filter(
    (i) => !["Draft", "Cancelled"].includes(i.status) && inRange(i.date),
  );
  const payments = db.payments.filter((p) => inRange(p.date));
  const sales = invoices.reduce((sum, i) => sum + totals(i.items).total, 0);
  const collections = payments.reduce((sum, p) => sum + p.amount, 0);
  const outstanding = db.invoices.reduce(
    (sum, i) => sum + invoiceBalance(db, i.id),
    0,
  );
  const pipeline = db.opportunities.filter(
    (o) => opportunityOutcome(o) === "open",
  );
  const trend = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(`${to}T12:00:00Z`);
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() - 5 + index);
    const month = date.toISOString().slice(0, 7);
    return {
      month: date.toLocaleDateString("en", {
        month: "short",
        year: "2-digit",
        timeZone: "UTC",
      }),
      revenue: invoices
        .filter((i) => i.date.startsWith(month))
        .reduce((sum, i) => sum + totals(i.items).total, 0),
      collections: payments
        .filter((p) => p.date.startsWith(month))
        .reduce((sum, p) => sum + p.amount, 0),
    };
  });
  const stages = [...new Set(pipeline.map((o) => o.status))].map((name) => ({
    name,
    value: pipeline
      .filter((o) => o.status === name)
      .reduce((sum, o) => sum + o.value, 0),
  }));
  const overdue = db.invoices.filter(
    (i) => i.dueDate < current && invoiceBalance(db, i.id) > 0,
  );
  const quick: [string, Collection, typeof Plus][] = [
    ["Add customer", "organizations", Users],
    ["New opportunity", "opportunities", Target],
    ["Receive payment", "payments", Receipt],
    ["New service ticket", "tickets", Wrench],
  ];
  return (
    <>
      <PageHeading
        eyebrow="YOUR BUSINESS AT A GLANCE"
        title={`Welcome, ${getMember().name.split(" ")[0] || "there"}`}
        description="Your team’s live customer relationships, sales and operations."
      >
        <button
          className="btn"
          disabled={
            !can(getMember(), "finance", "export") ||
            !can(getMember(), "sales", "export")
          }
          onClick={() =>
            exportCSV("agi-one-overview", [
              {
                from,
                to,
                sales,
                collections,
                outstanding,
                currency: db.settings.currency,
              },
            ])
          }
        >
          <Download size={15} />
          Export overview
        </button>
      </PageHeading>
      <div className="dashboard-context">
        <span>
          <span className="live-dot" />
          {db.settings.company}
        </span>
        <span>
          {db.settings.currency} · {db.settings.timezone}
        </span>
      </div>
      {can(getMember(), "customers", "view") && !db.organizations.length && (
        <section className="panel workspace-card">
          <Badge>GET STARTED</Badge>
          <h2>Your workspace starts here.</h2>
          <p>
            Add your first customer, invite your team, and set up your products
            or services. Your dashboard will reflect the records you create.
          </p>
          <div className="drawer-actions">
            <button
              className="btn primary"
              onClick={() => setCreate("organizations")}
            >
              <Plus size={16} />
              Add your first customer
            </button>
            <Link className="btn" href="/settings/users">
              Invite your team
            </Link>
            <Link className="btn" href="/settings">
              Workspace settings
            </Link>
          </div>
        </section>
      )}
      <section className="panel workspace-card">
        <div className="form-grid">
          <label className="field">
            From
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="field">
            To
            <input
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </div>
      </section>
      <div className="stats-grid">
        <Stat
          label="Issued sales · selected period"
          value={financeVisible ? money(sales, true) : "Restricted"}
          href="/finance/invoices"
        />
        <Stat
          label="Collections · selected period"
          value={financeVisible ? money(collections, true) : "Restricted"}
          href="/finance/receipts"
        />
        <Stat
          label="Outstanding · current"
          value={financeVisible ? money(outstanding, true) : "Restricted"}
          href="/finance/receivables"
        />
        <Stat
          label="Open pipeline · current"
          value={
            can(getMember(), "sales", "view")
              ? money(
                  pipeline.reduce((sum, o) => sum + o.value, 0),
                  true,
                )
              : "Restricted"
          }
          href="/sales/opportunities"
        />
      </div>
      <div className="dashboard-main">
        <section className="panel revenue-panel">
          <div className="panel-heading">
            <div>
              <h2>Sales & collections</h2>
              <p>Issued invoices and receipts within the selected period</p>
            </div>
          </div>
          <RevenueChart data={trend} currency={db.settings.currency} />
        </section>
        <section className="panel category-panel">
          <div className="panel-heading">
            <div>
              <h2>Pipeline by stage</h2>
              <p>Current open opportunities in {db.settings.currency}</p>
            </div>
          </div>
          {stages.length ? (
            <MiniBar data={stages} />
          ) : (
            <Empty
              title="No open opportunities"
              description="Create an opportunity to start tracking your pipeline."
            />
          )}
        </section>
      </div>
      <div className="dashboard-lower">
        <section className="panel attention-panel">
          <div className="panel-heading">
            <h2>Attention required</h2>
          </div>
          {[
            ["Overdue invoices", overdue.length, "/finance/receivables"],
            [
              "Open service tickets",
              db.tickets.filter(
                (t) => !["Resolved", "Closed"].includes(t.status),
              ).length,
              "/service/tickets",
            ],
            [
              "Pending approvals",
              db.approvals.filter((a) => a.status === "Pending").length,
              "/approvals",
            ],
            [
              "Products below reorder level",
              db.products.filter(
                (p) =>
                  db.stock
                    .filter((s) => s.productId === p.id)
                    .reduce((sum, s) => sum + s.quantity - s.reserved, 0) <
                  p.reorderLevel,
              ).length,
              "/inventory",
            ],
          ]
            .filter(([, , href]) => {
              const area = areaForPath(String(href));
              return !area || can(getMember(), area, "view");
            })
            .map(([label, count, href]) => (
              <Link
                className="attention-row"
                href={String(href)}
                key={String(label)}
              >
                <div>
                  <strong>{label}</strong>
                </div>
                <span className="attention-count">{count}</span>
                <ArrowUpRight size={15} />
              </Link>
            ))}
        </section>
        <section className="panel activity-panel">
          <div className="panel-heading">
            <h2>Recent activity</h2>
            <Link href="/settings/audit-log">View all</Link>
          </div>
          {db.audit.length ? (
            db.audit.slice(0, 6).map((a) => (
              <div className="workspace-event" key={a.id}>
                <div>
                  <strong>{a.name}</strong>
                  <p className="muted small">
                    {a.user} · {new Date(a.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <Empty
              title="A clean slate"
              description="Your team’s activity will appear here."
            />
          )}
        </section>
      </div>
      <section className="panel workspace-card">
        <h2>Quick actions</h2>
        <div className="drawer-actions">
          {quick
            .filter(([, key]) =>
              can(getMember(), collectionArea[key], "create"),
            )
            .map(([label, key, Icon]) => (
              <button className="btn" key={key} onClick={() => setCreate(key)}>
                <Icon size={16} />
                {label}
              </button>
            ))}
          <Link className="btn" href="/sales/quotations/new">
            Create quotation
            <ArrowUpRight size={15} />
          </Link>
        </div>
      </section>
      {create && (
        <RecordForm
          module={moduleFor(create)}
          onClose={() => setCreate(null)}
        />
      )}
    </>
  );
}
