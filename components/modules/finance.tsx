"use client";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PageHeading, Stat, Badge } from "@/components/common/ui";
import { DataTable } from "@/components/tables/data-table";
import { useDatabase } from "@/lib/services/provider";
import { displayRows, recordPath } from "@/lib/constants/modules";
import { invoiceBalance } from "@/lib/services/repository";
import { money, totals, today } from "@/lib/utils";
import { MiniBar } from "@/components/dashboard/charts";
import { useRouter } from "next/navigation";
export function Accounts() {
  const db = useDatabase();
  const issued = db.invoices.filter(
    (i) => !["Draft", "Cancelled"].includes(i.status),
  );
  return (
    <>
      <PageHeading
        title="Sales & collections"
        description="Operational invoice and receipt totals for your workspace."
      />
      <div className="stats-grid">
        <Stat
          label="Issued invoices · including tax"
          value={money(
            issued.reduce((sum, i) => sum + totals(i.items).total, 0),
            true,
          )}
        />
        <Stat
          label="Receivables"
          value={money(
            issued.reduce((sum, i) => sum + invoiceBalance(db, i.id), 0),
            true,
          )}
        />
        <Stat
          label="Customer receipts"
          value={money(
            db.payments.reduce((sum, p) => sum + p.amount, 0),
            true,
          )}
        />
        <Stat
          label="Recorded expenses"
          value={money(
            db.expenses
              .filter((e) => e.status !== "Rejected")
              .reduce((sum, e) => sum + e.amount + e.tax, 0),
            true,
          )}
        />
      </div>
      <section className="panel workspace-card">
        <h2>Accounting integration</h2>
        <p>
          These are operational totals. General ledger posting, supplier bills,
          credit notes, tax returns and bank statement matching are not
          available yet. Use your accounting system for financial statements.
        </p>
        <div className="drawer-actions">
          <Link className="btn" href="/finance/invoices">
            Invoices
          </Link>
          <Link className="btn" href="/finance/receipts">
            Receipts
          </Link>
          <Link className="btn" href="/finance/expenses">
            Expenses
          </Link>
        </div>
      </section>
      <Receivables embedded />
    </>
  );
}
export function Receivables({ embedded = false }: { embedded?: boolean }) {
  const db = useDatabase();
  const router = useRouter();
  const rows: import("@/lib/constants/modules").DisplayRow[] = displayRows(
    db,
    "invoices",
  )
    .filter((i) => Number(i.balance) > 0)
    .map((i) => {
      const invoice = db.invoices.find((v) => v.id === i.id)!;
      const days = Math.max(
        0,
        Math.floor(
          (Date.parse(today(db.settings.timezone)) -
            Date.parse(invoice.dueDate)) /
            86400000,
        ),
      );
      return {
        ...i,
        days,
        aging:
          invoice.dueDate >= today(db.settings.timezone)
            ? "Not due"
            : days <= 30
              ? "0–30 Days"
              : days <= 60
                ? "31–60 Days"
                : days <= 90
                  ? "61–90 Days"
                  : "90+ Days",
      };
    });
  const buckets = [
    "Not due",
    "0–30 Days",
    "31–60 Days",
    "61–90 Days",
    "90+ Days",
  ].map((name) => ({
    name,
    value: rows
      .filter((r) => r.aging === name)
      .reduce((s, r) => s + Number(r.balance), 0),
  }));
  return (
    <>
      {!embedded && (
        <PageHeading
          title="Receivable aging"
          description="Prioritize collections with a clear view of outstanding customer balances."
        >
          <Link href="/finance/receipts" className="btn primary">
            Receive payment <ArrowUpRight size={15} />
          </Link>
        </PageHeading>
      )}
      <div className="stats-grid">
        {buckets.map((b) => (
          <Stat label={b.name} value={money(b.value, true)} key={b.name} />
        ))}
      </div>
      <section className="panel aging-panel">
        <div className="panel-heading">
          <h2>Outstanding by age</h2>
          <Badge>As of {today(db.settings.timezone)}</Badge>
        </div>
        <MiniBar
          color="#e4a344"
          data={buckets.map((b) => ({
            ...b,
            value: +(b.value / 1e6).toFixed(2),
          }))}
        />
      </section>
      <DataTable
        rows={rows}
        columns={[
          ["name", "Invoice"],
          ["organization", "Customer"],
          ["dueDate", "Due date"],
          ["balance", "Outstanding"],
          ["days", "Days overdue"],
          ["aging", "Age bucket"],
          ["status", "Status"],
        ]}
        filters={["aging", "organization"]}
        name="receivables"
        onOpen={(id) => router.push(recordPath("invoices", id))}
      />
    </>
  );
}
