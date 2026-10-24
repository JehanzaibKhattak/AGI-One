"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeading, Empty, Badge, Modal, Stat } from "@/components/common/ui";
import { RecordForm } from "@/components/forms/record-form";
import { RelationPicker } from "@/components/forms/relation-picker";
import { moduleFor } from "@/lib/constants/modules";
import { useDatabase } from "@/lib/services/provider";
import {
  getMember,
  getRevision,
  repository,
  salesCommand,
  uid,
} from "@/lib/services/repository";
import { can } from "@/lib/access";
import { money } from "@/lib/utils";
import type {
  BaseRecord,
  Lead,
  Opportunity,
  Pipeline,
  PipelineStage,
  SalesTask,
} from "@/types";

type Kind = "leads" | "tasks" | "opportunities";
export function SalesDirectory({ kind }: { kind: Kind }) {
  const db = useDatabase(),
    member = getMember(),
    revision = getRevision(),
    definition = moduleFor(kind);
  const [checkedAt, setCheckedAt] = useState(() => Date.now());
  const [rows, setRows] = useState<BaseRecord[]>([]),
    [total, setTotal] = useState(0),
    [next, setNext] = useState<string | null>(null),
    [cursors, setCursors] = useState<string[]>([]);
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [pipelineId, setPipelineId] = useState("default"),
    [mine, setMine] = useState(false);
  const [editing, setEditing] = useState<BaseRecord | "new" | null>(null),
    [convert, setConvert] = useState<Lead | null>(null),
    [customer, setCustomer] = useState(""),
    [conversionPipeline, setConversionPipeline] = useState("default"),
    [conversionRevision, setConversionRevision] = useState(0);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({ q: query, limit: "25" });
      if (status) params.set("status", status);
      if (cursors.at(-1)) params.set("cursor", cursors.at(-1)!);
      if (kind === "opportunities") params.set("pipelineId", pipelineId);
      if (mine && member.id) params.set("assigneeId", member.id);
      try {
        const r = await fetch(`/api/records/${kind}?${params}`, {
          signal: controller.signal,
        });
        const body = await r.json();
        if (!r.ok) throw new Error(body.error);
        setRows(body.rows);
        setCheckedAt(Date.now());
        setTotal(body.total);
        setNext(body.nextCursor);
      } catch (e) {
        if (!controller.signal.aborted) setError((e as Error).message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [kind, query, status, pipelineId, mine, cursors, revision, member.id]);
  const act = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const stages = db.pipelines.find((p) => p.id === pipelineId)?.stages || [];
  return (
    <>
      <PageHeading
        eyebrow="SALES WORKSPACE"
        title={definition.title}
        description={definition.description}
      >
        <Link className="btn" href="/sales/forecast">
          Forecast
        </Link>
        {can(member, "sales", "create") && (
          <button className="btn primary" onClick={() => setEditing("new")}>
            New {definition.singular.toLowerCase()}
          </button>
        )}
      </PageHeading>
      {kind === "tasks" && (
        <p className="sales-explainer">
          Due times use your browser’s local timezone. Reminders appear in the
          app while you are signed in.
        </p>
      )}
      <section className="table-panel">
        <div className="table-toolbar">
          <input
            aria-label={`Search ${kind}`}
            placeholder={`Search ${definition.title.toLowerCase()}…`}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursors([]);
            }}
          />
          <div className="toolbar-actions">
            {kind === "opportunities" && (
              <>
                <select
                  aria-label="Sales pipeline"
                  value={pipelineId}
                  onChange={(e) => {
                    setPipelineId(e.target.value);
                    setStatus("");
                    setCursors([]);
                  }}
                >
                  {db.pipelines.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <Link className="btn" href="/sales/pipelines">
                  Configure pipelines
                </Link>
              </>
            )}
            <select
              aria-label={`${definition.singular} status`}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setCursors([]);
              }}
            >
              <option value="">All statuses</option>
              {(kind === "opportunities"
                ? stages.map((s) => s.name)
                : definition.statuses
              ).map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            {kind === "tasks" && (
              <label>
                <input
                  type="checkbox"
                  checked={mine}
                  onChange={(e) => {
                    setMine(e.target.checked);
                    setCursors([]);
                  }}
                />{" "}
                My tasks
              </label>
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
                <th>{definition.singular}</th>
                <th>
                  {kind === "leads"
                    ? "Company"
                    : kind === "tasks"
                      ? "Due"
                      : "Value"}
                </th>
                <th>Status</th>
                <th>Next action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.name}</strong>
                    {kind === "leads" && (
                      <small className="sales-secondary">
                        {(row as Lead).email}
                      </small>
                    )}
                  </td>
                  <td>
                    {kind === "leads"
                      ? (row as Lead).company
                      : kind === "tasks"
                        ? new Date((row as SalesTask).dueAt).toLocaleString()
                        : money((row as Opportunity).value)}
                  </td>
                  <td>
                    <Badge>{row.status}</Badge>
                    {kind === "tasks" &&
                      !["Completed", "Cancelled"].includes(row.status) &&
                      Date.parse((row as SalesTask).dueAt) < checkedAt && (
                        <Badge>Overdue</Badge>
                      )}
                  </td>
                  <td>
                    <div className="toolbar-actions">
                      {can(member, "sales", "edit") &&
                        !(kind === "leads" && row.status === "Converted") && (
                          <button
                            className="btn"
                            disabled={busy}
                            onClick={() => setEditing(row)}
                          >
                            Edit
                          </button>
                        )}
                      {kind === "leads" &&
                        row.status === "Qualified" &&
                        can(member, "sales", "edit") &&
                        can(member, "sales", "create") &&
                        can(member, "customers", "create") && (
                          <button
                            className="btn primary"
                            onClick={() => {
                              setConvert(row as Lead);
                              setCustomer("");
                              setConversionPipeline("default");
                              setConversionRevision(getRevision());
                            }}
                          >
                            Convert lead
                          </button>
                        )}
                      {kind === "leads" &&
                        (row as Lead).organizationId &&
                        can(member, "customers", "view") && (
                          <Link
                            className="btn"
                            href={`/crm/customers/${(row as Lead).organizationId}`}
                          >
                            Customer
                          </Link>
                        )}
                      {kind === "tasks" &&
                        can(member, "sales", "edit") &&
                        !["Completed", "Cancelled"].includes(row.status) && (
                          <button
                            className="btn"
                            disabled={busy}
                            onClick={() =>
                              void act(() =>
                                repository("tasks").update(row.id, {
                                  status: "Completed",
                                }),
                              )
                            }
                          >
                            Complete
                          </button>
                        )}
                      {kind === "opportunities" &&
                        can(member, "sales", "edit") && (
                          <select
                            aria-label={`Stage for ${row.name}`}
                            value={
                              (row as Opportunity).stageId ||
                              stages.find((s) => s.name === row.status)?.id ||
                              ""
                            }
                            disabled={busy}
                            onChange={(e) => {
                              const stage = stages.find(
                                (s) => s.id === e.target.value,
                              )!;
                              void act(() =>
                                repository("opportunities").update(row.id, {
                                  stageId: stage.id,
                                  pipelineId,
                                  status: stage.name,
                                  probability: stage.probability,
                                }),
                              );
                            }}
                          >
                            {stages.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} · {s.probability}%
                              </option>
                            ))}
                          </select>
                        )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loading ? (
          <p className="directory-status" role="status">
            Loading…
          </p>
        ) : (
          !rows.length && (
            <Empty
              title={`No ${definition.title.toLowerCase()} yet`}
              description="Add a record or adjust the filters to get started."
            />
          )
        )}
        <div className="table-footer">
          <span>
            {total} matching records · Page {cursors.length + 1}
          </span>
          <div className="pagination">
            <button
              className="btn"
              disabled={loading || !cursors.length}
              onClick={() => setCursors((c) => c.slice(0, -1))}
            >
              Previous
            </button>
            <button
              className="btn"
              disabled={loading || !next}
              onClick={() => setCursors((c) => [...c, next!])}
            >
              Next
            </button>
          </div>
        </div>
      </section>
      {editing && (
        <RecordForm
          key={editing === "new" ? "new" : editing.id}
          module={definition}
          record={editing === "new" ? undefined : editing}
          defaults={
            kind === "opportunities"
              ? { pipelineId, status: stages[0]?.name }
              : {}
          }
          onClose={() => setEditing(null)}
        />
      )}
      {convert && (
        <Modal
          open
          title="Convert qualified lead"
          description="Create a contact and opportunity, with a new customer or an existing customer in the same branch."
          onOpenChange={(open) => {
            if (!open && !busy) setConvert(null);
          }}
        >
          <div className="form-grid">
            <label className="field full">
              <span>Existing customer (optional)</span>
              <RelationPicker
                collection="organizations"
                label="Existing customer"
                value={customer}
                onChange={setCustomer}
              />
            </label>
            <label className="field full">
              <span>Pipeline</span>
              <select
                value={conversionPipeline}
                onChange={(e) => setConversionPipeline(e.target.value)}
              >
                {db.pipelines.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-footer">
            <button
              className="btn"
              disabled={busy}
              onClick={() => setConvert(null)}
            >
              Cancel
            </button>
            <button
              className="btn primary"
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  await salesCommand(
                    {
                      action: "convertLead",
                      id: convert.id,
                      organizationId: customer || undefined,
                      pipelineId: conversionPipeline,
                    },
                    conversionRevision,
                  );
                  setConvert(null);
                })
              }
            >
              {busy ? "Converting…" : "Convert to customer & opportunity"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
export function Pipelines() {
  const db = useDatabase(),
    member = getMember();
  const [editing, setEditing] = useState<Pipeline | null>(null),
    [revision, setRevision] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const update = (index: number, values: Partial<PipelineStage>) =>
    setEditing((p) =>
      p
        ? {
            ...p,
            stages: p.stages.map((s, i) =>
              i === index ? { ...s, ...values } : s,
            ),
          }
        : p,
    );
  return (
    <>
      <PageHeading
        eyebrow="SALES CONFIGURATION"
        title="Pipelines"
        description="Set the stages, probabilities and outcomes your team uses to sell."
      >
        {member.role === "owner" && (
          <button
            className="btn primary"
            onClick={() => {
              setError("");
              setRevision(getRevision());
              setEditing({
                id: uid("pipeline"),
                name: "New pipeline",
                status: "Active",
                createdAt: new Date().toISOString(),
                stages: [
                  {
                    id: "open",
                    name: "Qualified",
                    probability: 25,
                    outcome: "open",
                  },
                  { id: "won", name: "Won", probability: 100, outcome: "won" },
                  { id: "lost", name: "Lost", probability: 0, outcome: "lost" },
                ],
              });
            }}
          >
            New pipeline
          </button>
        )}
      </PageHeading>
      <div className="sales-pipelines">
        {db.pipelines.map((p) => (
          <section className="table-panel sales-pipeline" key={p.id}>
            <h2>{p.name}</h2>
            <ol>
              {p.stages.map((s) => (
                <li key={s.id}>
                  <span>{s.name}</span>
                  <span>
                    {s.probability}% · {s.outcome}
                  </span>
                </li>
              ))}
            </ol>
            {member.role === "owner" && (
              <button
                className="btn"
                onClick={() => {
                  setRevision(getRevision());
                  setEditing(structuredClone(p));
                  setError("");
                }}
              >
                Edit {p.name}
              </button>
            )}
          </section>
        ))}
      </div>
      {editing && (
        <Modal
          open
          wide
          title="Configure pipeline"
          description="Changing probabilities recalculates deals in those stages. Move deals before deleting their stage or changing its outcome."
          onOpenChange={(open) => {
            if (!open && !busy) setEditing(null);
          }}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                await salesCommand(
                  {
                    action: "configurePipeline",
                    id: editing.id,
                    name: editing.name,
                    stages: editing.stages,
                  },
                  revision,
                );
                setEditing(null);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="field">
              <span>Pipeline name</span>
              <input
                required
                maxLength={100}
                value={editing.name}
                onChange={(e) =>
                  setEditing({ ...editing, name: e.target.value })
                }
              />
            </label>
            {editing.stages.map((s, i) => (
              <div className="pipeline-stage-editor" key={s.id}>
                <label className="field">
                  <span>Stage {i + 1}</span>
                  <input
                    required
                    maxLength={100}
                    value={s.name}
                    onChange={(e) => update(i, { name: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Probability %</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    required
                    value={s.probability}
                    onChange={(e) =>
                      update(i, { probability: Number(e.target.value) })
                    }
                  />
                </label>
                <label className="field">
                  <span>Outcome</span>
                  <select
                    value={s.outcome}
                    onChange={(e) => {
                      const outcome = e.target
                        .value as PipelineStage["outcome"];
                      update(i, {
                        outcome,
                        ...(outcome === "won"
                          ? { probability: 100 }
                          : outcome === "lost"
                            ? { probability: 0 }
                            : {}),
                      });
                    }}
                  >
                    {["open", "won", "lost"].map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="btn"
                  aria-label={`Move ${s.name} up`}
                  disabled={!i}
                  onClick={() => {
                    const stages = [...editing.stages];
                    [stages[i - 1], stages[i]] = [stages[i], stages[i - 1]];
                    setEditing({ ...editing, stages });
                  }}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn"
                  aria-label={`Remove ${s.name}`}
                  onClick={() =>
                    setEditing({
                      ...editing,
                      stages: editing.stages.filter((_, n) => n !== i),
                    })
                  }
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn"
              disabled={editing.stages.length >= 30}
              onClick={() =>
                setEditing({
                  ...editing,
                  stages: [
                    ...editing.stages,
                    {
                      id: crypto.randomUUID(),
                      name: "New stage",
                      probability: 50,
                      outcome: "open",
                    },
                  ],
                })
              }
            >
              Add stage
            </button>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="modal-footer">
              <button
                type="button"
                className="btn"
                onClick={() => setEditing(null)}
                disabled={busy}
              >
                Cancel
              </button>
              <button className="btn primary" disabled={busy}>
                {busy ? "Saving…" : "Save pipeline"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
type ForecastGroup = {
  owner: string;
  stage: string;
  outcome: string;
  count: number;
  value: number;
  weighted: number;
};
export function SalesForecast() {
  const db = useDatabase(),
    member = getMember(),
    revision = getRevision(),
    now = new Date();
  const [from, setFrom] = useState(
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`,
    ),
    [to, setTo] = useState(
      new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0))
        .toISOString()
        .slice(0, 10),
    ),
    [pipelineId, setPipelineId] = useState(""),
    [branchId, setBranchId] = useState(""),
    [owner, setOwner] = useState("");
  const [groups, setGroups] = useState<ForecastGroup[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    const c = new AbortController();
    fetch(
      "/api/sales/forecast?" +
        new URLSearchParams({ from, to, pipelineId, branchId, owner }),
      { signal: c.signal },
    )
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error);
        setGroups(body.groups);
        setError("");
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [from, to, pipelineId, branchId, owner, revision]);
  const sum = (outcome: string, weighted = false) =>
    groups
      .filter((g) => g.outcome === outcome)
      .reduce((n, g) => n + (weighted ? g.weighted : g.value), 0);
  return (
    <>
      <PageHeading
        eyebrow="SALES INTELLIGENCE"
        title="Sales forecast"
        description="Expected closes, weighted by configured stage probability. This forecast is not recognized revenue."
      />
      <div className="table-panel">
        <div className="table-toolbar sales-forecast-filters">
          <label className="field">
            <span>Close from</span>
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setLoading(true);
                setFrom(e.target.value);
              }}
            />
          </label>
          <label className="field">
            <span>Close through</span>
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setLoading(true);
                setTo(e.target.value);
              }}
            />
          </label>
          <label className="field">
            <span>Pipeline</span>
            <select
              value={pipelineId}
              onChange={(e) => {
                setLoading(true);
                setPipelineId(e.target.value);
              }}
            >
              <option value="">All pipelines</option>
              {db.pipelines.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Branch</span>
            <select
              value={branchId}
              onChange={(e) => {
                setLoading(true);
                setBranchId(e.target.value);
              }}
            >
              <option value="">All accessible branches</option>
              {member.branches?.map((b) => (
                <option value={b.id} key={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Sales owner (exact name)</span>
            <input
              value={owner}
              onChange={(e) => {
                setLoading(true);
                setOwner(e.target.value);
              }}
            />
          </label>
        </div>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Calculating forecast…</p>
      ) : (
        !error && (
          <>
            <div className="stats-grid">
              <Stat label="Open pipeline" value={money(sum("open"))} />
              <Stat
                label="Weighted open pipeline"
                value={money(sum("open", true))}
              />
              <Stat label="Closed won" value={money(sum("won"))} />
              <Stat
                label="Won + weighted open"
                value={money(sum("won") + sum("open", true))}
              />
            </div>
            <section className="table-panel">
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Owner</th>
                      <th>Stage</th>
                      <th>Outcome</th>
                      <th>Deals</th>
                      <th>Value</th>
                      <th>Weighted value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((g) => (
                      <tr key={g.owner + ":" + g.stage + ":" + g.outcome}>
                        <td>{g.owner || "Unassigned"}</td>
                        <td>{g.stage}</td>
                        <td>{g.outcome}</td>
                        <td>{g.count}</td>
                        <td>{money(g.value)}</td>
                        <td>{money(g.weighted)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!groups.length && (
                <Empty
                  title="No deals closing in this period"
                  description="Set expected close dates on opportunities to include them in the forecast."
                />
              )}
            </section>
          </>
        )
      )}
    </>
  );
}
