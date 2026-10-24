"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  getSnapshot,
  getServerSnapshot,
  subscribe,
  initialize,
  WorkspaceAccessError,
} from "./repository";
export function useDatabase() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
export function DataProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState({ loaded: false, error: "" });
  useEffect(() => {
    let active = true;
    const load = () =>
      initialize()
        .then((loaded) => {
          if (active && loaded) setState({ loaded: true, error: "" });
        })
        .catch((error: Error) => {
          if (active) {
            if (error instanceof WorkspaceAccessError)
              router.replace(error.destination);
            else
              setState((previous) => ({ ...previous, error: error.message }));
          }
        });
    void load();
    const refresh = () => {
      if (document.visibilityState === "visible") void load();
    };
    const timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [router]);
  if (state.error)
    return (
      <div className="error-state" role="alert">
        <h1>Couldn’t load your workspace</h1>
        <p>{state.error}</p>
        <button
          className="btn primary"
          onClick={() => window.location.reload()}
        >
          Try again
        </button>
      </div>
    );
  if (!state.loaded)
    return (
      <div className="error-state" role="status">
        Opening your workspace…
      </div>
    );
  return children;
}
