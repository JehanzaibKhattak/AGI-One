"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Eye,
  FileDown,
  Save,
  Send,
} from "lucide-react";
import { useDatabase } from "@/lib/services/provider";
import {
  repository,
  uid,
  convertQuotation,
  purchaseTotal,
  getMember,
  getRevision,
} from "@/lib/services/repository";
import { totals, money, today, daysFromNow } from "@/lib/utils";
import { PageHeading, Badge, Modal } from "@/components/common/ui";
import { moduleFor, recordPath } from "@/lib/constants/modules";
import type { QuotationItem, Quotation, Invoice, PurchaseOrder } from "@/types";
const lineSchema = z.object({
  productId: z.string().min(1, "Choose a product"),
  description: z.string().min(1, "Description is required"),
  quantity: z
    .number()
    .positive("Quantity must be positive")
    .int("Quantity must be a whole number"),
  unitPrice: z.number().nonnegative(),
  discount: z.number().min(0).max(100),
  tax: z.number().min(0).max(100),
});
export function DocumentEditor({
  kind,
  id,
  customerId,
}: {
  kind: "quotations" | "invoices" | "purchaseOrders";
  id?: string;
  customerId?: string;
}) {
  const db = useDatabase();
  const [editRevision] = useState(getRevision);
  const router = useRouter();
  const existing = db[kind].find((x) => x.id === id);
  const config = moduleFor(kind);
  const [header, setHeader] = useState<Record<string, string>>(() => ({
    name:
      existing?.name ||
      `${kind === "quotations" ? db.settings.quotationPrefix : kind === "invoices" ? db.settings.invoicePrefix : "PO-"}${db[kind].length + 1}`,
    organizationId: customerId || "",
    contactId: "",
    supplierId: "",
    date: today(db.settings.timezone),
    validUntil: daysFromNow(30),
    dueDate: daysFromNow(30),
    expectedArrival: daysFromNow(30),
    owner: getMember().name,
    currency: db.settings.currency,
    paymentTerms: "Net 30",
    deliveryTerms: "4–6 weeks after purchase order",
    warranty: "12 months",
    installationTerms: "Installation and operator training included",
    notes: "",
    exchangeRate: "1",
    shippingMethod: "Air Freight",
    terms: "30% advance, balance before shipment",
    freight: "0",
    insurance: "0",
    customs: "0",
    clearing: "0",
    other: "0",
    ...Object.fromEntries(
      Object.entries(existing || {})
        .filter(([, v]) => typeof v === "string" || typeof v === "number")
        .map(([k, v]) => [k, String(v)]),
    ),
  }));
  const [items, setItems] = useState<QuotationItem[]>(() =>
    structuredClone(
      existing?.items || [
        {
          productId: "",
          description: "",
          quantity: 1,
          unitPrice: 0,
          discount: 0,
          tax: Number(db.settings.tax || 0),
        },
      ],
    ),
  );
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const total = totals(items);
  const costKeys = ["freight", "insurance", "customs", "clearing", "other"];
  const landed = purchaseTotal(
    items,
    Number(header.exchangeRate),
    costKeys.map((k) => Number(header[k])),
  );
  const change = (key: string, value: string) =>
    setHeader((h) => ({ ...h, [key]: value }));
  const update = (index: number, values: Partial<QuotationItem>) =>
    setItems((current) =>
      current.map((item, i) => (i === index ? { ...item, ...values } : item)),
    );
  const validate = () => {
    if (kind === "purchaseOrders" ? !header.supplierId : !header.organizationId)
      throw new Error(
        `Select a ${kind === "purchaseOrders" ? "supplier" : "customer"} first.`,
      );
    const result = z
      .array(lineSchema)
      .min(1, "Add at least one line item")
      .safeParse(items);
    if (!result.success) throw new Error(result.error.issues[0].message);
    if (
      kind === "purchaseOrders" &&
      (!Number.isFinite(landed) ||
        Number(header.exchangeRate) <= 0 ||
        costKeys.some((k) => Number(header[k]) < 0))
    )
      throw new Error(
        "Exchange rate must be positive and landed costs cannot be negative.",
      );
    if (kind === "invoices" && header.dueDate < header.date)
      throw new Error("Due date cannot precede invoice date.");
    if (kind === "quotations" && header.validUntil < header.date)
      throw new Error("Validity cannot precede quotation date.");
  };
  const save = async (status: string, convert = false) => {
    if (saving) return;
    setSaving(true);
    try {
      validate();
      if (
        existing &&
        kind === "invoices" &&
        db.payments.some((p) => p.invoiceId === id)
      )
        throw new Error("An invoice with recorded payments cannot be edited.");
      const recordId = id || uid(kind);
      const common = {
        ...header,
        id: recordId,
        createdAt: existing?.createdAt || new Date().toISOString(),
        status,
        items,
      };
      if (kind === "quotations") {
        const record = common as unknown as Quotation;
        if (existing)
          await repository("quotations").update(recordId, record, editRevision);
        else await repository("quotations").create(record, editRevision);
      } else if (kind === "invoices") {
        const record = {
          ...common,
          orderId: existing && "orderId" in existing ? existing.orderId : "",
        } as unknown as Invoice;
        if (existing)
          await repository("invoices").update(recordId, record, editRevision);
        else await repository("invoices").create(record, editRevision);
      } else {
        const record = {
          ...common,
          exchangeRate: Number(header.exchangeRate),
          ...Object.fromEntries(costKeys.map((k) => [k, Number(header[k])])),
        } as unknown as PurchaseOrder;
        if (existing)
          await repository("purchaseOrders").update(
            recordId,
            record,
            editRevision,
          );
        else await repository("purchaseOrders").create(record, editRevision);
      }
      toast.success(
        `${config.singular} ${status === "Draft" ? "saved as draft" : "saved"}`,
      );
      if (convert) {
        const orderId = await convertQuotation(recordId);
        router.push(recordPath("orders", orderId));
      } else router.push(recordPath(kind, recordId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save.");
    } finally {
      setSaving(false);
    }
  };
  const field = (key: string, label: string, type = "text") => (
    <label className="field" key={key}>
      <span>{label}</span>
      <input
        type={type}
        value={header[key]}
        onChange={(e) => change(key, e.target.value)}
        min={type === "number" ? 0 : undefined}
      />
    </label>
  );
  return (
    <>
      <button
        className="text-btn back-link"
        onClick={() => router.push(config.path)}
      >
        <ArrowLeft size={15} />
        Back to {config.title.toLowerCase()}
      </button>
      <PageHeading
        title={`${existing ? "Edit" : "New"} ${config.singular.toLowerCase()}`}
        description="Build a clear, accurate document with live totals."
      >
        <Badge>{existing?.status || "Draft"}</Badge>
        <button
          className="btn"
          onClick={() => {
            try {
              validate();
              setPreview(true);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <Eye size={15} />
          Preview
        </button>
      </PageHeading>
      <div className="document-layout">
        <div>
          <section className="panel form-panel">
            <div className="panel-heading">
              <h2>
                {kind === "purchaseOrders"
                  ? "Supplier & shipment"
                  : "Customer & document details"}
              </h2>
              <span className="muted">{header.name}</span>
            </div>
            <div className="form-grid">
              {kind === "purchaseOrders" ? (
                <label className="field">
                  <span>Supplier *</span>
                  <select
                    value={header.supplierId}
                    onChange={(e) => change("supplierId", e.target.value)}
                  >
                    <option value="">Select supplier</option>
                    {db.suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <>
                  <label className="field">
                    <span>Customer *</span>
                    <select
                      value={header.organizationId}
                      onChange={(e) => {
                        change("organizationId", e.target.value);
                        change("contactId", "");
                      }}
                    >
                      <option value="">Select customer</option>
                      {db.organizations.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {kind === "quotations" && (
                    <label className="field">
                      <span>Contact</span>
                      <select
                        value={header.contactId}
                        onChange={(e) => change("contactId", e.target.value)}
                      >
                        <option value="">Select contact</option>
                        {db.contacts
                          .filter(
                            (c) => c.organizationId === header.organizationId,
                          )
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                      </select>
                    </label>
                  )}
                </>
              )}
              {field("name", "Document number")}
              {field("date", "Date", "date")}
              {kind === "quotations"
                ? field("validUntil", "Valid until", "date")
                : kind === "invoices"
                  ? field("dueDate", "Due date", "date")
                  : field("expectedArrival", "Expected arrival", "date")}
              {kind !== "invoices" && (
                <label className="field">
                  <span>Currency</span>
                  <select
                    value={header.currency}
                    onChange={(e) => change("currency", e.target.value)}
                  >
                    {(kind === "purchaseOrders"
                      ? [
                          ...new Set([
                            db.settings.currency,
                            "USD",
                            "EUR",
                            "GBP",
                          ]),
                        ]
                      : [db.settings.currency]
                    ).map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
              )}
              {kind === "purchaseOrders" && (
                <>
                  {field(
                    "exchangeRate",
                    "Base-currency exchange rate",
                    "number",
                  )}
                  {field("shippingMethod", "Shipping method")}
                </>
              )}
            </div>
          </section>
          <section className="panel line-item-panel">
            <div className="panel-heading">
              <h2>Line items</h2>
              <span className="muted small">
                {items.length} item{items.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="table-scroll">
              <table className="line-items">
                <thead>
                  <tr>
                    {[
                      "Product / description",
                      "Qty",
                      "Unit price",
                      "Discount %",
                      "Tax %",
                      "Total",
                      "",
                    ].map((v, i) => (
                      <th key={i}>{v}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={i}>
                      <td>
                        <select
                          aria-label={`Product ${i + 1}`}
                          value={item.productId}
                          onChange={(e) => {
                            const p = db.products.find(
                              (p) => p.id === e.target.value,
                            );
                            update(i, {
                              productId: e.target.value,
                              description: p?.name || "",
                              unitPrice: p
                                ? kind === "purchaseOrders"
                                  ? p.unitCost
                                  : p.price
                                : 0,
                            });
                          }}
                        >
                          <option value="">Choose product</option>
                          {db.products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                        <input
                          aria-label={`Description ${i + 1}`}
                          value={item.description}
                          onChange={(e) =>
                            update(i, { description: e.target.value })
                          }
                          placeholder="Description"
                        />
                      </td>
                      {(
                        ["quantity", "unitPrice", "discount", "tax"] as const
                      ).map((key) => (
                        <td key={key}>
                          <input
                            aria-label={`${key} ${i + 1}`}
                            type="number"
                            min={key === "quantity" ? 1 : 0}
                            max={
                              key === "discount" || key === "tax"
                                ? 100
                                : undefined
                            }
                            value={item[key]}
                            onChange={(e) =>
                              update(i, { [key]: Number(e.target.value) })
                            }
                          />
                        </td>
                      ))}
                      <td className="tabular">
                        {kind === "purchaseOrders" &&
                        header.currency !== db.settings.currency
                          ? `${header.currency} ${totals([item]).total.toLocaleString()}`
                          : money(totals([item]).total)}
                      </td>
                      <td>
                        <button
                          className="icon-btn"
                          aria-label={`Remove line ${i + 1}`}
                          onClick={() =>
                            setItems(items.filter((_, j) => j !== i))
                          }
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              className="text-btn add-line"
              onClick={() =>
                setItems([
                  ...items,
                  {
                    productId: "",
                    description: "",
                    quantity: 1,
                    unitPrice: 0,
                    discount: 0,
                    tax: Number(db.settings.tax || 0),
                  },
                ])
              }
            >
              <Plus size={15} />
              Add line item
            </button>
          </section>
          <section className="panel form-panel">
            <div className="panel-heading">
              <h2>Terms & notes</h2>
            </div>
            <div className="form-grid">
              {kind === "purchaseOrders" ? (
                field("terms", "Payment & shipping terms")
              ) : (
                <>
                  {field("paymentTerms", "Payment terms")}
                  {kind === "quotations" && (
                    <>
                      {field("deliveryTerms", "Delivery terms")}
                      {field("warranty", "Warranty")}
                      {field("installationTerms", "Installation terms")}
                    </>
                  )}
                </>
              )}
              <label className="field full">
                <span>Notes</span>
                <textarea
                  rows={3}
                  value={header.notes}
                  onChange={(e) => change("notes", e.target.value)}
                />
              </label>
            </div>
          </section>
        </div>
        <aside className="document-summary panel">
          <div className="panel-heading">
            <h2>Document summary</h2>
          </div>
          <div className="summary-content">
            {[
              ["Subtotal", total.subtotal],
              ["Discount", -total.discount],
              ["Tax", total.tax],
            ].map(([label, v]) => (
              <div className="summary-row" key={label}>
                <span>{label}</span>
                <strong>
                  {header.currency}{" "}
                  {Number(v).toLocaleString("en-PK", {
                    maximumFractionDigits: 0,
                  })}
                </strong>
              </div>
            ))}
            {kind === "purchaseOrders" && (
              <div className="landed-fields">
                <h3>Landed costs · {db.settings.currency}</h3>
                {costKeys.map((key) =>
                  field(
                    key,
                    key === "customs"
                      ? "Customs duty"
                      : key === "clearing"
                        ? "Clearing charges"
                        : key[0].toUpperCase() + key.slice(1),
                    "number",
                  ),
                )}
              </div>
            )}
            <div className="summary-total">
              <span>
                {kind === "purchaseOrders"
                  ? "Estimated landed cost"
                  : "Grand total"}
              </span>
              <strong>
                {money(kind === "purchaseOrders" ? landed : total.total)}
              </strong>
            </div>
            <p className="muted small">
              All calculations update as you edit. Tax applies after line-item
              discounts.
            </p>
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <button
              className="btn primary"
              disabled={saving}
              onClick={() => save("Draft")}
            >
              <Save size={16} />
              Save draft
            </button>
            <button
              className="btn"
              disabled={saving}
              onClick={() =>
                save(kind === "purchaseOrders" ? "Awaiting Approval" : "Sent")
              }
            >
              <Send size={15} />
              {kind === "purchaseOrders"
                ? "Submit for approval"
                : "Mark as sent"}
            </button>
            {kind === "quotations" && (
              <button
                className="btn"
                disabled={saving}
                onClick={() => save("Accepted", true)}
              >
                Convert to sales order
              </button>
            )}
            <button
              className="text-btn"
              onClick={() => {
                try {
                  validate();
                  setPreview(true);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <FileDown size={15} />
              Generate PDF
            </button>
          </div>
        </aside>
      </div>
      <Modal
        open={preview}
        onOpenChange={setPreview}
        title={`${config.singular} preview`}
        wide
      >
        <div className="print-document">
          <div className="print-brand">
            <strong>AGI One</strong>
            <span>{db.settings.company}</span>
          </div>
          <h1>{header.name}</h1>
          <p>
            {kind === "purchaseOrders"
              ? db.suppliers.find((s) => s.id === header.supplierId)?.name
              : db.organizations.find((o) => o.id === header.organizationId)
                  ?.name}
          </p>
          <p>Date: {header.date}</p>
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i}>
                  <td>{item.description}</td>
                  <td>{item.quantity}</td>
                  <td>
                    {header.currency} {item.unitPrice.toLocaleString()}
                  </td>
                  <td>
                    {header.currency} {totals([item]).total.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="summary-total">
            <span>Total</span>
            <strong>
              {money(kind === "purchaseOrders" ? landed : total.total)}
            </strong>
          </div>
          <p>{header.paymentTerms || header.terms}</p>
          <p>{header.notes}</p>
          <small>Generated by AGI One</small>
        </div>
        <div className="modal-footer no-print">
          <button className="btn" onClick={() => setPreview(false)}>
            Close
          </button>
          <button className="btn primary" onClick={() => window.print()}>
            <FileDown size={15} />
            Print / Save as PDF
          </button>
        </div>
      </Modal>
    </>
  );
}
