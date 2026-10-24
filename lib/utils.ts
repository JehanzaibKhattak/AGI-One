import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, isValid, parseISO } from "date-fns";
import type { QuotationItem } from "@/types";
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export const money = (value: number, compact = false) =>
  "PKR " +
  new Intl.NumberFormat("en-PK", {
    maximumFractionDigits: compact ? 1 : 0,
    notation: compact ? "compact" : "standard",
  }).format(value || 0);
export const dateLabel = (value: string) => {
  const date = parseISO(value);
  return isValid(date) ? format(date, "dd MMM yyyy") : value || "—";
};
export const initials = (value: string) =>
  value
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("");
export function totals(items: QuotationItem[]) {
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const discount = items.reduce(
    (s, i) => s + (i.quantity * i.unitPrice * i.discount) / 100,
    0,
  );
  const tax = items.reduce(
    (s, i) =>
      s + (i.quantity * i.unitPrice * (1 - i.discount / 100) * i.tax) / 100,
    0,
  );
  return { subtotal, discount, tax, total: subtotal - discount + tax };
}
export function exportCSV(name: string, rows: Record<string, unknown>[]) {
  const keys = [...new Set(rows.flatMap(Object.keys))];
  const escape = (v: unknown) =>
    '"' +
    String(v ?? "")
      .replace(/^[=+@-]/, "'$&")
      .replace(/"/g, '""') +
    '"';
  const csv = [
    keys.map(escape).join(","),
    ...rows.map((row) => keys.map((k) => escape(row[k])).join(",")),
  ].join("\r\n");
  download(name + ".csv", "\uFEFF" + csv, "text/csv;charset=utf-8;");
}
export function download(name: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
