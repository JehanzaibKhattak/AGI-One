"use client";
import { useEffect, useId, useState } from "react";
import type { Collection } from "@/types";
export function RelationPicker({
  collection,
  label,
  value,
  onChange,
  organizationId,
}: {
  collection: Collection;
  label: string;
  value: string;
  onChange: (id: string) => void;
  organizationId?: string;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const [rows, setRows] = useState<{ id: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState(0);
  const choose = (row: { id: string; name: string }) => {
    onChange(row.id);
    setSelected(row.name);
    setQuery("");
    setOpen(false);
  };
  useEffect(() => {
    if (!value) return;
    const controller = new AbortController();
    void fetch(
      `/api/records/${collection}?id=${encodeURIComponent(value)}&limit=1`,
      { signal: controller.signal },
    )
      .then(async (response) => {
        const body = await response.json();
        if (response.ok) setSelected(body.rows[0]?.name || "");
      })
      .catch(() => {});
    return () => controller.abort();
  }, [collection, value]);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ q: query, limit: "10" });
      if (organizationId) params.set("organizationId", organizationId);
      void fetch(`/api/records/${collection}?` + params, {
        signal: controller.signal,
      })
        .then(async (response) => {
          const body = await response.json();
          if (!response.ok) throw new Error(body.error);
          setError("");
          setRows(body.rows);
        })
        .catch((e) => {
          if (!controller.signal.aborted) setError(e.message);
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [collection, query, open, organizationId]);
  return (
    <div className="relation-picker">
      <input
        aria-label={label}
        role="combobox"
        aria-controls={id}
        aria-expanded={open}
        aria-autocomplete="list"
        aria-activedescendant={
          open && rows[active] ? id + "-" + rows[active].id : undefined
        }
        autoComplete="off"
        value={value ? selected : query}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((index) =>
              Math.min(index + 1, Math.max(0, rows.length - 1)),
            );
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((index) => Math.max(0, index - 1));
          }
          if (e.key === "Enter" && open && rows[active]) {
            e.preventDefault();
            choose(rows[active]);
          }
          if (e.key === "Escape") setOpen(false);
        }}
        onChange={(event) => {
          setActive(0);
          setQuery(event.target.value);
          onChange("");
          setOpen(true);
        }}
      />
      {open && (
        <div
          role="listbox"
          id={id}
          aria-label={`${label} matches`}
          className="relation-options"
        >
          {error ? (
            <p role="alert">{error}</p>
          ) : rows.length ? (
            rows.map((row) => (
              <button
                type="button"
                id={id + "-" + row.id}
                tabIndex={-1}
                role="option"
                aria-selected={row.id === value || rows[active]?.id === row.id}
                key={row.id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(row)}
              >
                {row.name}
              </button>
            ))
          ) : (
            <p>No matching records</p>
          )}
        </div>
      )}
    </div>
  );
}
