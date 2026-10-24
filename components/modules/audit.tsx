"use client";
import { useEffect, useState } from "react";
import { PageHeading, Empty } from "@/components/common/ui";
type Event = {
  id: string;
  action: string;
  actor: string;
  email: string;
  created_at: string;
  detail: unknown;
};
export function AuditTrail() {
  const [pages, setPages] = useState<string[]>([]);
  const [rows, setRows] = useState<Event[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const before = pages.at(-1) || "";
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          "/api/audit" +
            (before ? "?cursor=" + encodeURIComponent(before) : ""),
          { signal: controller.signal },
        );
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        setRows(body.rows);
        setNext(body.next);
      } catch (e) {
        if (!controller.signal.aborted) setError((e as Error).message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [before]);
  return (
    <>
      <PageHeading
        title="Workspace audit trail"
        description="Server-recorded business operations, permissions, invitations and ownership changes."
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <section className="table-panel" aria-busy={loading}>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((event) => (
                <tr key={event.id}>
                  <td>{new Date(event.created_at).toLocaleString()}</td>
                  <td>
                    {event.actor}
                    <small>{event.email}</small>
                  </td>
                  <td>{event.action}</td>
                  <td>
                    {event.detail !== null ? (
                      <details>
                        <summary>View details</summary>
                        <pre className="audit-detail">
                          {JSON.stringify(event.detail, null, 2)}
                        </pre>
                      </details>
                    ) : (
                      "Restricted"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && !rows.length && (
          <Empty
            title="No recorded events"
            description="Your team’s activity will appear here."
          />
        )}
        <div className="table-footer">
          <span>
            {loading ? "Loading events…" : `${rows.length} events on this page`}
          </span>
          <div className="pagination">
            <button
              className="btn"
              disabled={!pages.length || loading}
              onClick={() => setPages((old) => old.slice(0, -1))}
            >
              Newer
            </button>
            <button
              className="btn"
              disabled={!next || loading}
              onClick={() => setPages((old) => [...old, next!])}
            >
              Older
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
