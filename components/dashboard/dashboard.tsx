"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  Download,
  ChevronDown,
  TrendingUp,
  Wallet,
  CircleDollarSign,
  Boxes,
  Target,
  Wrench,
  ShieldCheck,
  Trophy,
  Plus,
  ArrowRight,
  FileClock,
  Package,
  Clock3,
  Receipt,
  CheckCircle2,
  Building2,
} from "lucide-react";
import {
  PageHeading,
  Stat,
  Badge,
  Select,
  Modal,
} from "@/components/common/ui";
import { RevenueChart, CategoryChart, MiniBar, trend } from "./charts";
import { useDatabase } from "@/lib/services/provider";
import { money, initials, exportCSV } from "@/lib/utils";
import { RecordForm } from "@/components/forms/record-form";
import { moduleFor } from "@/lib/constants/modules";
import type { Collection } from "@/types";
export function Dashboard() {
  const db = useDatabase();
  const [range, setRange] = useState("This Month");
  const [create, setCreate] = useState<Collection | null>(null);
  const [custom, setCustom] = useState(false);
  const [from, setFrom] = useState("2026-09-01");
  const [to, setTo] = useState("2026-09-18");
  const factor =
    range === "Today"
      ? 0.045
      : range === "This Week"
        ? 0.23
        : range === "Quarter"
          ? 2.7
          : range === "Custom"
            ? Math.max(1, (Date.parse(to) - Date.parse(from)) / 86400000 + 1) /
              30
            : 1;
  const pipeline = db.opportunities.filter(
    (o) => !["Won", "Lost"].includes(o.status),
  );
  const quick: [string, Collection, typeof Plus][] = [
    ["New customer", "organizations", Building2],
    ["New opportunity", "opportunities", Target],
    ["Create quotation", "quotations", FileClock],
    ["Add service ticket", "tickets", Wrench],
    ["Create invoice", "invoices", Receipt],
    ["Receive payment", "payments", Wallet],
  ];
  return (
    <>
      <PageHeading
        title="Good morning, Admin"
        description="Here’s what’s happening across your business today."
        eyebrow="YOUR BUSINESS AT A GLANCE"
      >
        <div className="date-control">
          <CalendarDays size={15} />
          <Select
            label="Dashboard date range"
            value={range}
            onChange={(v) => {
              setRange(v);
              if (v === "Custom") setCustom(true);
            }}
            options={["Today", "This Week", "This Month", "Quarter", "Custom"]}
          />
        </div>
        <button
          className="btn"
          onClick={() =>
            exportCSV(
              "executive-summary",
              trend.map((d) => ({
                ...d,
                revenue: d.revenue * factor,
                collections: d.collections * factor,
              })),
            )
          }
        >
          <Download size={15} />
          Export overview
        </button>
      </PageHeading>
      <div className="dashboard-context">
        <span>
          <span className="live-dot" />
          All branches <span className="context-divider">/</span>{" "}
          {range === "Custom" ? `${from} — ${to}` : "September 2026"}
        </span>
        <span>
          Last updated just now <span className="demo-label">DEMO DATA</span>
        </span>
      </div>
      <div className="stats-grid dashboard-stats">
        <Stat
          label={
            range === "This Month"
              ? "Sales this month"
              : `Sales · ${range.toLowerCase()}`
          }
          value={money(48200000 * factor, true)}
          change="↗ 18.6%"
          icon={<TrendingUp size={17} />}
          href="/sales/orders"
        />
        <Stat
          label="Collections"
          value={money(29100000 * factor, true)}
          change="↗ 12.4%"
          icon={<Wallet size={17} />}
          href="/finance/receipts"
        />
        <Stat
          label="Outstanding receivables"
          value="PKR 17.4M"
          change="↘ 4.2%"
          icon={<CircleDollarSign size={17} />}
          href="/finance/receivables"
        />
        <Stat
          label="Inventory value"
          value="PKR 86.3M"
          change="↗ 6.8%"
          icon={<Boxes size={17} />}
          href="/inventory"
        />
      </div>
      <div className="operational-strip">
        <Link href="/sales/opportunities">
          <span className="strip-icon blue">
            <Target size={18} />
          </span>
          <div>
            <span>Open opportunities</span>
            <strong>
              {pipeline.length}
              <small>
                {money(
                  pipeline.reduce((s, o) => s + o.value, 0),
                  true,
                )}{" "}
                pipeline
              </small>
            </strong>
          </div>
          <ChevronDown className="rotate-arrow" size={16} />
        </Link>
        <Link href="/service/tickets">
          <span className="strip-icon purple">
            <Wrench size={18} />
          </span>
          <div>
            <span>Open service tickets</span>
            <strong>
              {
                db.tickets.filter(
                  (t) => !["Closed", "Resolved"].includes(t.status),
                ).length
              }
              <small className="amber-text">2 high priority</small>
            </strong>
          </div>
          <ChevronDown className="rotate-arrow" size={16} />
        </Link>
        <Link href="/service/maintenance">
          <span className="strip-icon amber">
            <CalendarDays size={18} />
          </span>
          <div>
            <span>PM due this month</span>
            <strong>
              {db.maintenance.filter((m) => m.status !== "Completed").length}
              <small>Across 3 branches</small>
            </strong>
          </div>
          <ChevronDown className="rotate-arrow" size={16} />
        </Link>
        <Link href="/tenders">
          <span className="strip-icon teal">
            <Trophy size={18} />
          </span>
          <div>
            <span>Active tenders</span>
            <strong>
              {
                db.tenders.filter((t) => !["Won", "Lost"].includes(t.status))
                  .length
              }
              <small>2 closing this month</small>
            </strong>
          </div>
          <ChevronDown className="rotate-arrow" size={16} />
        </Link>
      </div>
      <div className="dashboard-main">
        <section className="panel revenue-panel">
          <div className="panel-heading">
            <div>
              <h2>Revenue & collections</h2>
              <p>A clear view of your cash flow over time</p>
            </div>
            <span className="chart-period">Last 6 months</span>
          </div>
          <div className="revenue-summary">
            <div>
              <span className="legend-dot" />
              Revenue<strong>{money(48200000 * factor, true)}</strong>
            </div>
            <div>
              <span className="legend-dot green-dot" />
              Collections<strong>{money(29100000 * factor, true)}</strong>
            </div>
            <span className="growth-chip">
              <TrendingUp size={13} />
              18.6% vs last month
            </span>
          </div>
          <RevenueChart factor={factor} />
        </section>
        <section className="panel category-panel">
          <div className="panel-heading">
            <div>
              <h2>Sales by category</h2>
              <p>Where your revenue comes from</p>
            </div>
            <Link
              href="/reports"
              aria-label="View sales reports"
              className="icon-btn"
            >
              <ArrowUpRight size={18} />
            </Link>
          </div>
          <CategoryChart />
        </section>
      </div>
      <div className="dashboard-lower">
        <section className="panel attention-panel">
          <div className="panel-heading">
            <h2>
              Attention required <span className="count amber">6</span>
            </h2>
            <span className="muted small">Stay one step ahead</span>
          </div>
          {[
            {
              icon: Receipt,
              title: "Overdue invoices",
              text: "Follow up on outstanding customer payments",
              count: "12 invoices",
              tone: "red",
              href: "/finance/receivables",
            },
            {
              icon: Package,
              title: "Stock running low",
              text: "Reorder levels reached for critical products",
              count: "4 products",
              tone: "amber",
              href: "/inventory",
            },
            {
              icon: Clock3,
              title: "Reagent batches nearing expiry",
              text: "Review batches expiring in the next 30 days",
              count: "3 batches",
              tone: "amber",
              href: "/inventory/products/prd-3",
            },
            {
              icon: Wrench,
              title: "Preventive maintenance due",
              text: "Schedule upcoming equipment service visits",
              count: "9 visits",
              tone: "blue",
              href: "/service/maintenance",
            },
            {
              icon: FileClock,
              title: "Quotations awaiting follow-up",
              text: "Keep your active proposals moving forward",
              count: "5 quotations",
              tone: "blue",
              href: "/sales/quotations",
            },
            {
              icon: ShieldCheck,
              title: "Service contracts to renew",
              text: "Reconnect with customers before coverage ends",
              count: "2 contracts",
              tone: "purple",
              href: "/service/contracts",
            },
          ].map((a) => (
            <Link href={a.href} className="attention-row" key={a.title}>
              <span className={`attention-icon ${a.tone}`}>
                <a.icon size={17} />
              </span>
              <div>
                <strong>{a.title}</strong>
                <small>{a.text}</small>
              </div>
              <span className={`attention-count ${a.tone}`}>{a.count}</span>
              <ChevronDown size={14} className="rotate-arrow" />
            </Link>
          ))}
        </section>
        <section className="panel activity-panel">
          <div className="panel-heading">
            <h2>Recent activity</h2>
            <Link href="/settings/audit-log" className="text-btn">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <div className="activity-list">
            {db.activities.slice(0, 5).map((a, i) => (
              <Link
                href={`/crm/customers/${a.organizationId}`}
                className="activity-item"
                key={a.id}
              >
                <span className={`activity-avatar tone-${i % 3}`}>
                  {i === 1 ? <CheckCircle2 size={16} /> : initials(a.user)}
                </span>
                <div>
                  <strong>{a.name}</strong>
                  <p>
                    {
                      db.organizations.find((o) => o.id === a.organizationId)
                        ?.name
                    }
                  </p>
                  <small>
                    {a.user} <span>·</span>{" "}
                    {i === 0
                      ? "12 minutes ago"
                      : i === 1
                        ? "38 minutes ago"
                        : `${i} hours ago`}
                  </small>
                </div>
              </Link>
            ))}
          </div>
          <div className="activity-footer">
            <span className="live-dot" />
            You’re up to date with your team
          </div>
        </section>
      </div>
      <section className="quick-actions">
        <div>
          <h2>Make your next move</h2>
          <p>Everyday actions, one click away.</p>
        </div>
        <div>
          {quick.map(([label, key, Icon]) =>
            ["quotations", "invoices"].includes(key) ? (
              <Link
                key={key}
                href={moduleFor(key).path + "/new"}
                className="quick-action"
              >
                <Icon size={16} />
                {label}
                <Plus size={13} />
              </Link>
            ) : (
              <button
                key={key}
                className="quick-action"
                onClick={() => setCreate(key)}
              >
                <Icon size={16} />
                {label}
                <Plus size={13} />
              </button>
            ),
          )}
        </div>
      </section>
      <div className="secondary-charts">
        <section className="panel">
          <div className="panel-heading">
            <h2>Sales by month</h2>
            <span className="muted small">PKR millions</span>
          </div>
          <MiniBar
            data={trend.map((d) => ({
              name: d.month,
              value: d.revenue * factor,
            }))}
          />
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Pipeline by stage</h2>
            <Link href="/sales/opportunities" className="text-btn">
              View pipeline <ArrowUpRight size={13} />
            </Link>
          </div>
          <MiniBar
            horizontal
            data={[
              "New Lead",
              "Qualified",
              "Demo",
              "Quotation",
              "Negotiation",
              "PO Expected",
            ].map((name) => ({
              name,
              value: db.opportunities
                .filter((o) => o.status === name)
                .reduce((s, o) => s + o.value / 1e6, 0),
            }))}
          />
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Receivables aging</h2>
            <span className="muted small">PKR millions</span>
          </div>
          <MiniBar
            color="#e8a64d"
            data={[
              { name: "0–30", value: 8.2 },
              { name: "31–60", value: 5.1 },
              { name: "61–90", value: 2.8 },
              { name: "90+", value: 1.3 },
            ]}
          />
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Service ticket status</h2>
            <Badge>Live</Badge>
          </div>
          <MiniBar
            color="#55a996"
            data={["New", "Assigned", "Repairing", "Resolved"].map((name) => ({
              name,
              value: db.tickets.filter((t) => t.status === name).length,
            }))}
          />
        </section>
      </div>
      {create && (
        <RecordForm
          module={moduleFor(create)}
          onClose={() => setCreate(null)}
        />
      )}
      <Modal open={custom} onOpenChange={setCustom} title="Custom date range">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (from <= to) setCustom(false);
          }}
        >
          <div className="form-grid">
            <label className="field">
              From
              <input
                type="date"
                value={from}
                max={to}
                onChange={(e) => setFrom(e.target.value)}
                required
              />
            </label>
            <label className="field">
              To
              <input
                type="date"
                value={to}
                min={from}
                onChange={(e) => setTo(e.target.value)}
                required
              />
            </label>
          </div>
          <div className="modal-footer">
            <button className="btn primary">Apply range</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
