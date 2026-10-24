"use client";
import { useState } from "react";
import {
  ChartNoAxesCombined,
  Boxes,
  Wallet,
  Users,
  Wrench,
  PackageCheck,
  Trophy,
  FileDown,
  ArrowRight,
  FileSpreadsheet,
  Download,
} from "lucide-react";
import { PageHeading, Modal } from "@/components/common/ui";
import { DataTable } from "@/components/tables/data-table";
import { useDatabase } from "@/lib/services/provider";
import {
  displayRows,
  type DisplayRow,
  cellLabel,
} from "@/lib/constants/modules";
import { exportCSV, download, totals, today } from "@/lib/utils";
const groups = [
  {
    name: "Sales",
    icon: ChartNoAxesCombined,
    description: "Understand revenue and what drives it.",
    reports: [
      "Sales by Customer",
      "Sales by Product",
      "Sales by City",
      "Sales by Salesperson",
      "Profitability by Product",
    ],
  },
  {
    name: "Inventory",
    icon: Boxes,
    description: "Keep your stock healthy and accountable.",
    reports: [
      "Inventory Valuation",
      "Slow Moving Stock",
      "Expiring Stock",
      "Stock Movement",
    ],
  },
  {
    name: "Finance",
    icon: Wallet,
    description: "Make confident financial decisions.",
    reports: ["Receivable Aging", "Customer Statement"],
  },
  {
    name: "CRM",
    icon: Users,
    description: "Find opportunities in every relationship.",
    reports: ["Customer Portfolio", "Opportunity Pipeline"],
  },
  {
    name: "Service",
    icon: Wrench,
    description: "Measure reliability and response.",
    reports: [
      "Service Response Time",
      "Engineer Performance",
      "Equipment Failure Frequency",
    ],
  },
  {
    name: "Procurement",
    icon: PackageCheck,
    description: "Track supplier commitments and costs.",
    reports: ["Purchase Order Summary", "Supplier Performance"],
  },
  {
    name: "Tender",
    icon: Trophy,
    description: "Turn bids into better business.",
    reports: ["Tender Pipeline", "Bid Bond Summary"],
  },
];
export function Reports() {
  const db = useDatabase();
  const [search, setSearch] = useState("");
  const [report, setReport] = useState("");
  const [city, setCity] = useState("All cities");
  const [from, setFrom] = useState(
    today(db.settings.timezone).slice(0, 4) + "-01-01",
  );
  const [to, setTo] = useState(today(db.settings.timezone));
  const [preview, setPreview] = useState(false);
  const inRange = (date: string) =>
    date.slice(0, 10) >= from && date.slice(0, 10) <= to;
  const orgIds = new Set(
    db.organizations
      .filter((o) => city === "All cities" || o.city === city)
      .map((o) => o.id),
  );
  const invoices = db.invoices.filter(
    (i) =>
      orgIds.has(i.organizationId) &&
      inRange(i.date) &&
      !["Draft", "Cancelled"].includes(i.status),
  );
  let rows: DisplayRow[] = [];
  let columns: [string, string][] = [];
  if (report.startsWith("Sales by") || report === "Profitability by Product") {
    const dim = report.endsWith("Customer")
      ? "Customer"
      : report.endsWith("City")
        ? "City"
        : report.endsWith("Salesperson")
          ? "Salesperson"
          : "Product";
    const aggregate = new Map<
      string,
      { value: number; cost: number; count: number }
    >();
    invoices.forEach((inv) =>
      inv.items.forEach((item) => {
        const org = db.organizations.find((o) => o.id === inv.organizationId)!;
        const product = db.products.find((p) => p.id === item.productId)!;
        const name =
          dim === "Customer"
            ? org.name
            : dim === "City"
              ? org.city
              : dim === "Salesperson"
                ? inv.owner
                : product.name;
        const prev = aggregate.get(name) || { value: 0, cost: 0, count: 0 };
        aggregate.set(name, {
          value: prev.value + totals([item]).total,
          cost: prev.cost + item.quantity * product.unitCost,
          count: prev.count + item.quantity,
        });
      }),
    );
    rows = [...aggregate].map(([name, v], i) => ({
      id: String(i),
      name,
      status: "Recorded",
      total: v.value,
      unitCost: v.cost,
      balance: v.value - v.cost,
      quantity: v.count,
    }));
    columns = [
      ["name", dim],
      ["quantity", "Units"],
      ["total", "Sales incl. tax"],
      ...(report === "Profitability by Product"
        ? ([
            ["unitCost", "Cost"],
            ["balance", "Sales less cost (incl. tax)"],
          ] as [string, string][])
        : []),
    ];
  } else if (["Inventory Valuation", "Slow Moving Stock"].includes(report)) {
    rows = displayRows(db, "products");
    if (report === "Slow Moving Stock")
      rows = rows.filter(
        (p) => !invoices.some((i) => i.items.some((l) => l.productId === p.id)),
      );
    columns = [
      ["sku", "SKU"],
      ["name", "Product"],
      ["category", "Category"],
      ["available", "Available"],
      ["reserved", "Reserved"],
      ["stockValue", "Stock value"],
    ];
  } else if (report === "Expiring Stock") {
    rows = db.batches
      .filter((b) => b.expiry < to && b.expiry >= from)
      .map((b) => ({
        ...b,
        product: db.products.find((p) => p.id === b.productId)?.name || "",
      }));
    columns = [
      ["name", "Batch"],
      ["product", "Product"],
      ["expiry", "Expiry"],
      ["quantity", "Quantity"],
    ];
  } else if (report === "Stock Movement") {
    rows = db.transactions
      .filter((t) => inRange(t.date))
      .map((t) => ({
        ...t,
        product: db.products.find((p) => p.id === t.productId)?.name || "",
      }));
    columns = [
      ["name", "Reference"],
      ["product", "Product"],
      ["date", "Date"],
      ["quantity", "Quantity"],
      ["status", "Movement"],
    ];
  } else if (report === "Receivable Aging") {
    rows = displayRows(db, "invoices")
      .filter(
        (i) => invoices.some((v) => v.id === i.id) && Number(i.balance) > 0,
      )
      .map((i) => ({
        ...i,
        days: Math.max(
          0,
          Math.floor(
            (Date.parse(today(db.settings.timezone)) -
              Date.parse(String(i.dueDate))) /
              86400000,
          ),
        ),
      }));
    columns = [
      ["name", "Invoice"],
      ["organization", "Customer"],
      ["dueDate", "Due date"],
      ["balance", "Outstanding"],
      ["days", "Days past due"],
    ];
  } else if (
    report === "Customer Statement" ||
    report === "Customer Portfolio"
  ) {
    rows = displayRows(db, "organizations").filter((o) => orgIds.has(o.id));
    columns = [
      ["name", "Customer"],
      ["city", "City"],
      ["owner", "Owner"],
      ["opportunities", "Open opportunities"],
      ["balance", "Current balance"],
    ];
  } else {
    const key =
      report === "Opportunity Pipeline"
        ? "opportunities"
        : report === "Service Response Time"
          ? "tickets"
          : report === "Engineer Performance"
            ? "engineers"
            : report === "Equipment Failure Frequency"
              ? "equipment"
              : report.includes("Supplier")
                ? "suppliers"
                : report.includes("Purchase")
                  ? "purchaseOrders"
                  : "tenders";
    rows = displayRows(db, key).filter(
      (r) => !r.city || city === "All cities" || r.city === city,
    );
    columns =
      key === "opportunities"
        ? [
            ["name", "Opportunity"],
            ["organization", "Customer"],
            ["value", "Value"],
            ["status", "Stage"],
          ]
        : key === "tickets"
          ? [
              ["name", "Ticket"],
              ["organization", "Customer"],
              ["opened", "Opened"],
              ["slaStatus", "SLA"],
              ["status", "Status"],
            ]
          : key === "engineers"
            ? [
                ["name", "Engineer"],
                ["jobs", "Jobs"],
                ["completed", "Completed"],
                ["responseTime", "Response"],
                ["compliance", "SLA %"],
              ]
            : key === "equipment"
              ? [
                  ["name", "Equipment"],
                  ["serial", "Serial"],
                  ["organization", "Customer"],
                  ["failures", "Recorded tickets"],
                ]
              : key === "suppliers"
                ? [
                    ["name", "Supplier"],
                    ["country", "Country"],
                    ["orders", "Purchase orders"],
                  ]
                : key === "purchaseOrders"
                  ? [
                      ["name", "PO"],
                      ["supplier", "Supplier"],
                      ["total", "Landed cost"],
                      ["status", "Status"],
                    ]
                  : [
                      ["name", "Tender"],
                      ["organization", "Organization"],
                      ["value", "Value"],
                      ["bidBond", "Bid bond"],
                      ["status", "Status"],
                    ];
    if (key === "equipment")
      rows = rows.map((r) => ({
        ...r,
        failures: db.tickets.filter((t) => t.equipmentId === r.id).length,
      }));
    if (key === "suppliers")
      rows = rows.map((r) => ({
        ...r,
        orders: db.purchaseOrders.filter((p) => p.supplierId === r.id).length,
      }));
  }
  const exportRows = rows.map((r) =>
    Object.fromEntries(columns.map(([k, label]) => [label, r[k]])),
  );
  const excel = () => {
    const esc = (v: unknown) =>
      String(v ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    const xml =
      '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Report"><Table>' +
      [columns.map((c) => c[1]), ...rows.map((r) => columns.map(([k]) => r[k]))]
        .map(
          (values) =>
            "<Row>" +
            values
              .map(
                (v) =>
                  `<Cell><Data ss:Type="${typeof v === "number" ? "Number" : "String"}">${esc(v)}</Data></Cell>`,
              )
              .join("") +
            "</Row>",
        )
        .join("") +
      "</Table></Worksheet></Workbook>";
    download(report + ".xml", xml, "application/vnd.ms-excel");
  };
  return (
    <>
      <PageHeading
        eyebrow="BUSINESS INTELLIGENCE"
        title="The insight behind every decision"
        description="Explore your business from every angle. Export what matters."
      />
      <div className="report-search">
        <input
          aria-label="Search reports"
          placeholder="Find a report…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span>
          {groups.reduce((s, g) => s + g.reports.length, 0)} curated reports
        </span>
      </div>
      <div className="report-grid">
        {groups
          .filter(
            (g) =>
              g.reports.some((r) =>
                r.toLowerCase().includes(search.toLowerCase()),
              ) || g.name.toLowerCase().includes(search.toLowerCase()),
          )
          .map((g, i) => (
            <section className="panel report-card" key={g.name}>
              <span className={`report-icon tone-${i % 3}`}>
                <g.icon size={21} />
              </span>
              <h2>{g.name} reports</h2>
              <p>{g.description}</p>
              <div>
                {g.reports
                  .filter(
                    (r) =>
                      !search ||
                      r.toLowerCase().includes(search.toLowerCase()) ||
                      g.name.toLowerCase().includes(search.toLowerCase()),
                  )
                  .map((r) => (
                    <button key={r} onClick={() => setReport(r)}>
                      {r}
                      <ArrowRight size={14} />
                    </button>
                  ))}
              </div>
            </section>
          ))}
      </div>
      <Modal
        open={!!report}
        onOpenChange={(v) => {
          if (!v) setReport("");
        }}
        title={report}
        description="Workspace records. Snapshot reports use current balances and today’s aging; transaction reports use the selected dates."
        wide
      >
        <div className="report-filters">
          <label className="field">
            From
            <input
              type="date"
              max={to}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="field">
            To
            <input
              type="date"
              min={from}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <label className="field">
            City
            <select value={city} onChange={(e) => setCity(e.target.value)}>
              {[
                "All cities",
                ...new Set(db.organizations.map((o) => o.city)),
              ].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <DataTable rows={rows} columns={columns} name="report rows" />
        <div className="modal-footer">
          <button className="btn" onClick={() => exportCSV(report, exportRows)}>
            <Download size={15} />
            CSV
          </button>
          <button className="btn" onClick={excel}>
            <FileSpreadsheet size={15} />
            Excel XML
          </button>
          <button className="btn primary" onClick={() => setPreview(true)}>
            <FileDown size={15} />
            PDF
          </button>
        </div>
      </Modal>
      <Modal open={preview} onOpenChange={setPreview} title="Print report" wide>
        <div className="print-document">
          <h1>AGI One · {report}</h1>
          <p>
            {from} — {to} · {city}
          </p>
          <table>
            <thead>
              <tr>
                {columns.map(([k, l]) => (
                  <th key={k}>{l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  {columns.map(([k]) => (
                    <td key={k}>{cellLabel(k, r[k])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            Demo data · Snapshot balances are not audited financial statements.
          </p>
        </div>
        <div className="modal-footer no-print">
          <button className="btn primary" onClick={() => window.print()}>
            Print / Save as PDF
          </button>
        </div>
      </Modal>
    </>
  );
}
