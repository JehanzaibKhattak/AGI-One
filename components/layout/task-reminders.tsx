"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useDatabase } from "@/lib/services/provider";
import { getRevision } from "@/lib/services/repository";
import type { SalesTask } from "@/types";
export function TaskReminders() {
  const db = useDatabase(),
    revision = getRevision();
  const [result, setResult] = useState<{ tasks: SalesTask[]; total: number }>({
    tasks: [],
    total: 0,
  });
  useEffect(() => {
    const c = new AbortController();
    const load = () => {
      if (document.visibilityState === "visible")
        fetch("/api/sales/reminders", { signal: c.signal })
          .then(async (r) => {
            if (r.ok) setResult(await r.json());
          })
          .catch(() => {});
    };
    load();
    const interval = setInterval(load, 30000);
    return () => {
      c.abort();
      clearInterval(interval);
    };
  }, [revision, db]);
  if (!result.total) return null;
  return (
    <Link className="task-reminder-banner" href="/sales/tasks" role="status">
      {result.total} task reminder{result.total === 1 ? "" : "s"} ·{" "}
      {result.tasks[0]?.name} <span>View tasks →</span>
    </Link>
  );
}
