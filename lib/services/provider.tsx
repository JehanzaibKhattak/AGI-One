"use client";
import { usePathname, useRouter } from "next/navigation";
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
  const path = usePathname();
  const mode = [
    "/crm",
    "/crm/overview",
    "/crm/organizations",
    "/settings/users",
    "/settings/audit-log",
    "/settings",
  ].includes(path)
    ? "directory"
    : "full";
  const [state, setState] = useState({ loaded: false, error: "", mode });
  useEffect(() => {
    let active = true;
    const load = () =>
      initialize(mode)
        .then((loaded) => {
          if (active && loaded) setState({ loaded: true, error: "", mode });
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
  }, [router, mode]);
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
  if (!state.loaded || state.mode !== mode)
    return (
      <div className="error-state" role="status">
        Opening your workspace…
      </div>
    );
  return children;
}
