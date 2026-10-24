import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, isValid, parseISO } from "date-fns";
import type { QuotationItem } from "@/types";
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
let baseCurrency = "USD";
export function setBaseCurrency(currency: string) {
  baseCurrency = currency;
}
export const money = (value: number, compact = false) =>
  baseCurrency +
  " " +
  new Intl.NumberFormat("en-PK", {
    maximumFractionDigits: compact ? 1 : 2,
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
  return {
    subtotal: roundMoney(subtotal),
    discount: roundMoney(discount),
    tax: roundMoney(tax),
    total: roundMoney(subtotal - discount + tax),
  };
}
export function csvText(rows: Record<string, unknown>[]) {
  const keys = [...new Set(rows.flatMap(Object.keys))];
  const escape = (value: unknown) =>
    '"' +
    String(value ?? "")
      .replace(/^[\t\r\n ]*[=+@-]|^[\t\r\n]/, "'$&")
      .replace(/"/g, '""') +
    '"';
  return [
    keys.map(escape).join(","),
    ...rows.map((row) => keys.map((key) => escape(row[key])).join(",")),
  ].join("\r\n");
}
export function exportCSV(name: string, rows: Record<string, unknown>[]) {
  download(name + ".csv", "\uFEFF" + csvText(rows), "text/csv;charset=utf-8;");
}
export function download(name: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const today = (timeZone = "UTC") =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export function daysFromNow(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export const roundMoney = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;
