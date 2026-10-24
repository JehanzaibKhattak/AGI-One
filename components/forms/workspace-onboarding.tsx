"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
export function WorkspaceOnboarding({ invitation }: { invitation?: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <div className="login-page">
      <section className="login-brand-panel">
        <div className="brand-name">
          AGI <b>One</b>
        </div>
        <div className="login-story">
          <span className="eyebrow">YOUR BUSINESS, CONNECTED</span>
          <h1>
            A fresh start.
            <br />
            Built around you.
          </h1>
          <p>
            Your workspace begins with your team and your customers. Add only
            what your business needs.
          </p>
        </div>
      </section>
      <section className="login-form-panel">
        <div className="login-form">
          <h1>{invitation ? "Join your team" : "Create your workspace"}</h1>
          <p>
            {invitation
              ? "Accept your invitation to join the team with this account."
              : "Choose a name and base currency for your new workspace."}
          </p>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setPending(true);
              setError("");
              const values = new FormData(event.currentTarget);
              try {
                const response = await fetch("/api/workspace", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    name: values.get("name"),
                    currency: values.get("currency"),
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    invitation,
                  }),
                });
                const result = await response.json();
                if (response.status === 401) {
                  router.push(
                    "/login?next=" +
                      encodeURIComponent(
                        window.location.pathname + window.location.search,
                      ),
                  );
                  return;
                }
                if (!response.ok) throw new Error(result.error);
                router.replace("/dashboard");
                router.refresh();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setPending(false);
              }
            }}
          >
            <label className="field" hidden={Boolean(invitation)}>
              <span>Workspace name</span>
              <input
                name="name"
                required
                minLength={2}
                maxLength={100}
                placeholder="Your company"
                defaultValue={invitation ? "Join workspace" : ""}
              />
            </label>
            <label className="field" hidden={Boolean(invitation)}>
              <span>Base currency</span>
              <select name="currency" defaultValue="USD">
                {[
                  "USD",
                  "EUR",
                  "GBP",
                  "PKR",
                  "AED",
                  "SAR",
                  "CAD",
                  "AUD",
                  "INR",
                ].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <button className="btn primary login-submit" disabled={pending}>
              {pending ? "Opening workspace…" : "Continue"}
            </button>
          </form>
          <button
            className="text-btn"
            onClick={async () => {
              await authClient.signOut();
              router.push("/login");
            }}
          >
            Sign out
          </button>
        </div>
      </section>
    </div>
  );
}
