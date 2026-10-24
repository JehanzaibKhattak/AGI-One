"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Plus,
  Landmark,
  Wallet,
  ShieldCheck,
} from "lucide-react";
import { PageHeading, Stat, Badge } from "@/components/common/ui";
import { DataTable } from "@/components/tables/data-table";
import { RecordForm } from "@/components/forms/record-form";
import { useDatabase } from "@/lib/services/provider";
import { displayRows, moduleFor, recordPath } from "@/lib/constants/modules";
import { invoiceBalance } from "@/lib/services/repository";
import { money, totals } from "@/lib/utils";
import { MiniBar } from "@/components/dashboard/charts";
import { useRouter } from "next/navigation";
export function Accounts() {
  const db = useDatabase();
  const router = useRouter();
  const [tab, setTab] = useState("Chart of Accounts");
  const [create, setCreate] = useState(false);
  const invoices = db.invoices.filter((i) => i.status !== "Cancelled");
  const revenue = invoices.reduce((s, i) => s + totals(i.items).total, 0);
  const expenses = db.expenses.reduce((s, e) => s + e.amount + e.tax, 0);
  const receipts = db.payments.reduce((s, p) => s + p.amount, 0);
  const receivables = invoices.reduce(
    (s, i) => s + invoiceBalance(db, i.id),
    0,
  );
  const bank = db.banks.reduce((s, b) => s + b.openingBalance, 0) + receipts;
  const accountRows = [
    {
      id: "1001",
      name: "Cash & bank",
      type: "Asset",
      debit: bank,
      credit: 0,
      status: "Active",
    },
    {
      id: "1201",
      name: "Trade receivables",
      type: "Asset",
      debit: receivables,
      credit: 0,
      status: "Active",
    },
    {
      id: "1301",
      name: "Inventory",
      type: "Asset",
      debit: displayRows(db, "products").reduce(
        (s, p) => s + Number(p.stockValue),
        0,
      ),
      credit: 0,
      status: "Active",
    },
    {
      id: "2101",
      name: "Trade payables",
      type: "Liability",
      debit: 0,
      credit: 8750000,
      status: "Active",
    },
    {
      id: "4001",
      name: "Sales revenue",
      type: "Income",
      debit: 0,
      credit: revenue,
      status: "Active",
    },
    {
      id: "5001",
      name: "Operating expenses",
      type: "Expense",
      debit: expenses,
      credit: 0,
      status: "Active",
    },
  ];
  return (
    <>
      <PageHeading
        eyebrow="FINANCIAL OVERVIEW"
        title="A clear view of your finances"
        description="Balances, transactions, and insights that keep your business moving."
      >
        <Link className="btn" href="/finance/receivables">
          Receivable aging <ArrowUpRight size={15} />
        </Link>
        <button className="btn primary" onClick={() => setCreate(true)}>
          <Plus size={15} />
          Journal entry
        </button>
      </PageHeading>
      <div className="stats-grid">
        <Stat
          label="Bank balance"
          value={money(bank, true)}
          icon={<Landmark size={17} />}
        />
        <Stat label="Receivables" value={money(receivables, true)} />
        <Stat label="Payables · opening snapshot" value="PKR 8.75M" />
        <Stat label="Revenue recorded" value={money(revenue, true)} />
      </div>
      <div className="finance-summary">
        <div>
          <Wallet size={20} />
          <span>Cash collections</span>
          <strong>
            {money(
              db.payments
                .filter((p) => p.method === "Cash")
                .reduce((s, p) => s + p.amount, 0),
              true,
            )}
          </strong>
        </div>
        <div>
          <span>Recorded expenses</span>
          <strong>{money(expenses, true)}</strong>
        </div>
        <div>
          <span>Revenue less operating expenses</span>
          <strong className="green-text">
            {money(revenue - expenses, true)}
          </strong>
          <small>Before cost of goods and tax</small>
        </div>
        <Link href="/finance/banking">
          <ShieldCheck size={18} />
          Reconcile bank accounts
          <ArrowUpRight size={15} />
        </Link>
      </div>
      <div className="tabs">
        {[
          "Chart of Accounts",
          "General Ledger",
          "Journal Entries",
          "Receivables",
          "Payables",
          "Banking",
        ].map((t) => (
          <button
            key={t}
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "Chart of Accounts" ? (
        <DataTable
          rows={accountRows}
          columns={[
            ["id", "Account code"],
            ["name", "Account name"],
            ["type", "Type"],
            ["debit", "Debit balance"],
            ["credit", "Credit balance"],
            ["status", "Status"],
          ]}
          name="chart of accounts"
        />
      ) : tab === "Receivables" ? (
        <Receivables embedded />
      ) : tab === "Banking" ? (
        <DataTable
          rows={displayRows(db, "banks")}
          columns={moduleFor("banks").columns}
          name="bank accounts"
          onOpen={(id) => router.push(recordPath("banks", id))}
        />
      ) : tab === "Payables" ? (
        <DataTable
          rows={displayRows(db, "purchaseOrders").filter(
            (p) => p.status !== "Cancelled",
          )}
          columns={moduleFor("purchaseOrders").columns}
          name="supplier commitments"
          onOpen={(id) => router.push(recordPath("purchaseOrders", id))}
        />
      ) : (
        <DataTable
          rows={displayRows(db, "journals")}
          columns={moduleFor("journals").columns}
          name="journal entries"
          onOpen={(id) => router.push(recordPath("journals", id))}
        />
      )}
      <div className="finance-footnote">
        Demo accounting summary. A balanced general ledger, COGS, tax posting,
        and statement reconciliation require the future accounting backend.
      </div>
      {create && (
        <RecordForm
          module={moduleFor("journals")}
          onClose={() => setCreate(false)}
        />
      )}
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
          (Date.parse("2026-09-18") - Date.parse(invoice.dueDate)) / 86400000,
        ),
      );
      return {
        ...i,
        days,
        aging:
          days <= 30
            ? "0–30 Days"
            : days <= 60
              ? "31–60 Days"
              : days <= 90
                ? "61–90 Days"
                : "90+ Days",
      };
    });
  const buckets = ["0–30 Days", "31–60 Days", "61–90 Days", "90+ Days"].map(
    (name) => ({
      name,
      value: rows
        .filter((r) => r.aging === name)
        .reduce((s, r) => s + Number(r.balance), 0),
    }),
  );
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
          <Badge>As of 18 Sep 2026</Badge>
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
