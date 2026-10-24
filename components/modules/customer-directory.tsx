"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Download,
  ArrowUpRight,
} from "lucide-react";
import { PageHeading, Badge, Empty } from "@/components/common/ui";
import { RecordForm } from "@/components/forms/record-form";
import { moduleFor } from "@/lib/constants/modules";
import { useDatabase } from "@/lib/services/provider";
import { getMember, getRevision } from "@/lib/services/repository";
import { can } from "@/lib/access";
import { money, download, initials } from "@/lib/utils";
import type { Organization } from "@/types";
type Row = Organization & {
  contact?: string;
  opportunities?: number;
  balance?: number;
};
export function CustomerDirectory() {
  const db = useDatabase();
  const router = useRouter();
  const member = getMember();
  const revision = getRevision();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [branch, setBranch] = useState("");
  const [limit, setLimit] = useState(25);
  const [cursors, setCursors] = useState<string[]>([]);
  const [create, setCreate] = useState(false);
  const [result, setResult] = useState<{
    rows: Row[];
    total: number;
    nextCursor: string | null;
    canExport: boolean;
  }>({ rows: [], total: 0, nextCursor: null, canExport: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search);
      setCursors([]);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);
  const cursor = cursors.at(-1) || "";
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      q: query,
      status,
      branchId: branch,
      limit: String(limit),
    });
    for (const key of ["status", "branchId"])
      if (!params.get(key)) params.delete(key);
    if (cursor) params.set("cursor", cursor);
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/records/organizations?" + params, {
          signal: controller.signal,
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        setResult(body);
      } catch (e) {
        if (!controller.signal.aborted) setError((e as Error).message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [query, status, branch, limit, cursor, revision, db]);
  const sales = can(member, "sales", "view"),
    finance = can(member, "finance", "view");
  const exportMatching = async () => {
    setExporting(true);
    setError("");
    try {
      const params = new URLSearchParams({ q: query });
      if (status) params.set("status", status);
      if (branch) params.set("branchId", branch);
      const response = await fetch(
        "/api/records/organizations/export?" + params,
      );
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error);
      }
      download(
        "agi-one-customers.csv",
        await response.text(),
        "text/csv;charset=utf-8",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExporting(false);
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="CUSTOMER RELATIONSHIPS"
        title="Your customer relationships"
        description="Find every customer, keep ownership clear, and move relationships forward."
      >
        {can(member, "customers", "create") && (
          <button className="btn primary" onClick={() => setCreate(true)}>
            <Plus size={16} />
            New customer
          </button>
        )}
      </PageHeading>
      <section className="table-panel customer-directory">
        <div className="table-toolbar">
          <div className="search-input">
            <Search size={16} />
            <input
              aria-label="Search organizations"
              placeholder="Search customers by name, code or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="toolbar-actions">
            <select
              aria-label="Customer status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setCursors([]);
              }}
            >
              <option value="">All statuses</option>
              {moduleFor("organizations").statuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            {Boolean(member.branches?.length) && (
              <select
                aria-label="Customer branch"
                value={branch}
                onChange={(e) => {
                  setBranch(e.target.value);
                  setCursors([]);
                }}
              >
                <option value="">All accessible branches</option>
                {member.branches?.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}
            {result.canExport && (
              <button
                className="btn"
                disabled={exporting || loading}
                onClick={() => void exportMatching()}
              >
                <Download size={15} />
                {exporting ? "Exporting…" : "Export matching customers"}
              </button>
            )}
          </div>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="table-scroll" aria-busy={loading}>
          <table>
            <thead>
              <tr>
                <th>Organization</th>
                <th>Type</th>
                <th>City</th>
                <th>Primary contact</th>
                <th>Sales owner</th>
                {sales && <th>Opportunities</th>}
                {finance && <th>Outstanding</th>}
                <th>Status</th>
                <th>
                  <span className="sr-only">Open record</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <button
                      className="record-link"
                      onClick={() => router.push("/crm/customers/" + row.id)}
                    >
                      <span className="avatar company-avatar">
                        {initials(row.name)}
                      </span>
                      <span>
                        {row.name}
                        <small>{row.code}</small>
                      </span>
                    </button>
                  </td>
                  <td>{row.type}</td>
                  <td>{row.city}</td>
                  <td>{row.contact || "—"}</td>
                  <td>{row.owner || "Unassigned"}</td>
                  {sales && <td>{row.opportunities || 0}</td>}
                  {finance && <td>{money(Number(row.balance || 0))}</td>}
                  <td>
                    <Badge>{row.status}</Badge>
                  </td>
                  <td>
                    <button
                      className="icon-btn"
                      aria-label={`Open ${row.name}`}
                      onClick={() => router.push("/crm/customers/" + row.id)}
                    >
                      <ArrowUpRight size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loading ? (
          <p className="directory-status" role="status">
            Loading customers…
          </p>
        ) : (
          !result.rows.length && (
            <Empty
              title={
                query
                  ? "No matching customers"
                  : "Your next relationship starts here"
              }
              description={
                query
                  ? "Try a different name, code or email."
                  : "Add a customer to start building your pipeline."
              }
            />
          )
        )}
        <div className="table-footer">
          <span>
            {result.total ? cursors.length * limit + 1 : 0}–
            {Math.min((cursors.length + 1) * limit, result.total)} of{" "}
            {result.total} matching customers
          </span>
          <div className="pagination">
            <label>
              Rows{" "}
              <select
                aria-label="Rows per page"
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setCursors([]);
                }}
              >
                {[25, 50, 100].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <button
              className="icon-btn"
              aria-label="Previous page"
              disabled={loading || !cursors.length}
              onClick={() => setCursors((previous) => previous.slice(0, -1))}
            >
              <ChevronLeft size={16} />
            </button>
            <span>Page {cursors.length + 1}</span>
            <button
              className="icon-btn"
              aria-label="Next page"
              disabled={loading || !result.nextCursor}
              onClick={() =>
                setCursors((previous) => [...previous, result.nextCursor!])
              }
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>
      {create && (
        <RecordForm
          module={moduleFor("organizations")}
          onClose={() => setCreate(false)}
        />
      )}
    </>
  );
}
