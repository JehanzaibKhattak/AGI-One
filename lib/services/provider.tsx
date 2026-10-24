"use client";
import { useEffect, useSyncExternalStore, useState } from "react";
import {
  getSnapshot,
  getServerSnapshot,
  subscribe,
  initialize,
  resetDemo,
} from "./repository";
export function useDatabase() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
export function DataProvider({ children }: { children: React.ReactNode }) {
  const [error, setError] = useState("");
  useEffect(() => {
    try {
      initialize();
    } catch (e) {
      queueMicrotask(() =>
        setError(e instanceof Error ? e.message : "Unable to load demo data."),
      );
    }
  }, []);
  if (error)
    return (
      <div className="error-state">
        <h1>Couldn’t load your workspace</h1>
        <p>{error}</p>
        <button
          className="btn primary"
          onClick={() => {
            resetDemo();
            setError("");
          }}
        >
          Reset saved demo data
        </button>
      </div>
    );
  return children;
}
