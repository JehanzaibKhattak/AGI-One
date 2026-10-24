"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeading, Empty } from "@/components/common/ui";
type Connection = {
  configured: boolean;
  connected: boolean;
  account?: string;
  readAt?: string;
  messages?: {
    id: string;
    subject?: string;
    receivedDateTime: string;
    from?: { emailAddress: { name?: string; address: string } };
    webLink: string;
  }[];
  events?: {
    id: string;
    subject?: string;
    start: { dateTime: string; timeZone: string };
    end: { dateTime: string; timeZone: string };
    webLink: string;
  }[];
};
export function Connections() {
  const params = useSearchParams();
  const [data, setData] = useState<Connection | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const c = new AbortController();
    fetch("/api/connections/microsoft", { signal: c.signal })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error);
        setData(body);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, []);
  const action = async (method: "POST" | "DELETE" | "GET") => {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(
        "/api/connections/microsoft" + (method === "GET" ? "?read=1" : ""),
        { method },
      );
      const body = await r.json();
      if (!r.ok) throw new Error(body.error);
      if (method === "POST") window.location.assign(body.url);
      else if (method === "DELETE")
        setData({ configured: data?.configured || false, connected: false });
      else setData(body);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="YOUR CONNECTIONS"
        title="Email & calendar"
        description="Bring your business day into AGI One with Microsoft 365."
      />
      {params.get("connection") === "failed" && (
        <p className="form-error" role="alert">
          The connection was declined, expired or could not be completed. Try
          connecting again.
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <section className="table-panel sales-pipeline">
        <h2>Microsoft 365</h2>
        <p>
          Your connection is private to your AGI One account. Read recent inbox
          subjects and upcoming meetings. No message bodies, attachments, email
          sending or calendar changes are requested.
        </p>
        <p className="sales-explainer">
          {data?.connected
            ? `Connected as ${data.account}`
            : data?.configured
              ? "Ready to connect your work account."
              : data
                ? "Administrator setup required before accounts can connect."
                : "Checking connection…"}
        </p>
        <div className="toolbar-actions">
          {data?.connected ? (
            <>
              <button
                className="btn primary"
                disabled={busy}
                onClick={() => void action("GET")}
              >
                {busy ? "Reading…" : "Refresh email & calendar"}
              </button>
              <button
                className="btn"
                disabled={busy}
                onClick={() => void action("DELETE")}
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              className="btn primary"
              disabled={busy || !data?.configured}
              onClick={() => void action("POST")}
            >
              Connect Microsoft 365
            </button>
          )}
          {!data?.configured && (
            <a
              className="btn"
              href="https://github.com/JehanzaibKhattak/AGI-One/blob/main/docs/microsoft-365.md"
              target="_blank"
              rel="noreferrer"
            >
              Connection setup guide
            </a>
          )}
        </div>
      </section>
      {data?.readAt && (
        <>
          <p className="sales-explainer">
            Read {new Date(data.readAt).toLocaleString()} · Latest 20 inbox
            messages and first 20 meetings over the next 14 days. Content is
            fetched on demand and is not saved in CRM records.
          </p>
          <div className="sales-pipelines">
            <section className="table-panel sales-pipeline">
              <h2>Recent inbox</h2>
              {data.messages?.map((m) => (
                <article className="connection-item" key={m.id}>
                  <a
                    href={m.webLink || undefined}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {m.subject || "(No subject)"}
                  </a>
                  <p>
                    {m.from?.emailAddress.name ||
                      m.from?.emailAddress.address ||
                      "Unknown sender"}{" "}
                    · {new Date(m.receivedDateTime).toLocaleString()}
                  </p>
                </article>
              ))}
              {!data.messages?.length && <Empty title="No messages returned" />}
            </section>
            <section className="table-panel sales-pipeline">
              <h2>Upcoming calendar</h2>
              {data.events?.map((e) => (
                <article className="connection-item" key={e.id}>
                  <a
                    href={e.webLink || undefined}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {e.subject || "Untitled meeting"}
                  </a>
                  <p>
                    {new Date(
                      e.start.dateTime.replace(/Z$/, "") + "Z",
                    ).toLocaleString()}{" "}
                    –{" "}
                    {new Date(
                      e.end.dateTime.replace(/Z$/, "") + "Z",
                    ).toLocaleTimeString()}
                  </p>
                </article>
              ))}
              {!data.events?.length && <Empty title="No meetings returned" />}
            </section>
          </div>
        </>
      )}
      <p className="sales-explainer">
        Disconnect removes stored credentials from AGI One. You can also revoke
        AGI One’s consent in your Microsoft account or organization’s app
        portal.
      </p>
    </>
  );
}
