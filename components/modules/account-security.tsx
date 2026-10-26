"use client";
import { useCallback, useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { PageHeading } from "@/components/common/ui";
type Session = {
  token: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  updatedAt: Date | string;
  expiresAt: Date | string;
};
export function AccountSecurity() {
  const { data: session, isPending, refetch } = authClient.useSession();
  const [sessions, setSessions] = useState<Session[]>([]),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [setup, setSetup] = useState<{
      totpURI: string;
      backupCodes: string[];
    } | null>(null),
    [codes, setCodes] = useState<string[]>([]);
  const load = useCallback(async () => {
    const result = await authClient.listSessions();
    if (result.error) throw new Error(result.error.message);
    return result.data || [];
  }, []);
  useEffect(() => {
    void load()
      .then(setSessions)
      .catch((e) => setError(e.message));
  }, [load]);
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      await refetch();
      setSessions(await load());
    } catch (e) {
      setError((e as Error).message || "Could not complete the request.");
    } finally {
      setBusy(false);
    }
  };
  const enabled = session?.user.twoFactorEnabled === true,
    secret = setup
      ? new URL(setup.totpURI).searchParams.get("secret") || ""
      : "";
  return (
    <>
      <PageHeading
        eyebrow="YOUR ACCOUNT"
        title="Account security"
        description="Protect your sign-in, manage recovery and review active sessions."
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="auth-message" role="status">
          {message}
        </p>
      )}
      <div className="account-security-grid">
        <section className="table-panel sales-pipeline">
          <h2>Authenticator app</h2>
          <p>
            {isPending
              ? "Loading security settings…"
              : enabled
                ? "Multi-factor authentication is enabled."
                : "Add a second factor to protect your account if your password is compromised."}
          </p>
          {setup ? (
            <>
              <p>
                In your authenticator app, add a time-based account for AGI One
                using this setup key. Keep it private.
              </p>
              <code className="totp-secret" data-testid="totp-secret">
                {secret}
              </code>
              <p>
                <a href={setup.totpURI}>Open in authenticator app</a>
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const code = String(
                    new FormData(e.currentTarget).get("code"),
                  );
                  void run(async () => {
                    const result = await authClient.twoFactor.verifyTotp({
                      code,
                    });
                    if (result.error) throw new Error(result.error.message);
                    setCodes(setup.backupCodes);
                    setSetup(null);
                    setMessage(
                      "Authenticator verified. MFA is now enabled. Save your backup codes.",
                    );
                  });
                }}
              >
                <label className="field">
                  <span>Authenticator code</span>
                  <input
                    name="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    pattern="[0-9]{6}"
                    maxLength={6}
                  />
                </label>
                <button className="btn primary" disabled={busy}>
                  Verify & enable MFA
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setSetup(null)}
                  disabled={busy}
                >
                  Cancel setup
                </button>
              </form>
            </>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget,
                  password = String(new FormData(form).get("password"));
                void run(async () => {
                  if (enabled) {
                    const result = await authClient.twoFactor.disable({
                      password,
                    });
                    if (result.error) throw new Error(result.error.message);
                    setCodes([]);
                    setMessage(
                      "MFA disabled. Your other sessions have been signed out.",
                    );
                  } else {
                    const result = await authClient.twoFactor.enable({
                      password,
                      issuer: "AGI One",
                    });
                    if (result.error) throw new Error(result.error.message);
                    if (!result.data || !("totpURI" in result.data))
                      throw new Error("Authenticator setup was not returned.");
                    setSetup({
                      totpURI: result.data.totpURI,
                      backupCodes: result.data.backupCodes,
                    });
                  }
                  form.reset();
                });
              }}
            >
              <label className="field">
                <span>Current password for MFA</span>
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  maxLength={128}
                />
              </label>
              <button className="btn primary" disabled={busy || isPending}>
                {enabled ? "Disable MFA" : "Set up authenticator"}
              </button>
            </form>
          )}
          {enabled && !setup && (
            <form
              className="security-subsection"
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget,
                  password = String(new FormData(form).get("password"));
                void run(async () => {
                  const result = await authClient.twoFactor.generateBackupCodes(
                    { password },
                  );
                  if (result.error) throw new Error(result.error.message);
                  setCodes(result.data?.backupCodes || []);
                  setMessage(
                    "New backup codes generated. Previous codes no longer work.",
                  );
                  form.reset();
                });
              }}
            >
              <label className="field">
                <span>Current password to replace backup codes</span>
                <input
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  required
                />
              </label>
              <button className="btn" disabled={busy}>
                Replace backup codes
              </button>
            </form>
          )}
          {codes.length > 0 && (
            <div className="security-subsection">
              <h3>Save your backup codes</h3>
              <p>
                Each code works once. Store these in your password manager. They
                will disappear when you leave this page.
              </p>
              <ul className="backup-codes">
                {codes.map((code) => (
                  <li key={code}>
                    <code>{code}</code>
                  </li>
                ))}
              </ul>
              <button className="btn" onClick={() => setCodes([])}>
                I have saved these codes
              </button>
            </div>
          )}
        </section>
        <section className="table-panel sales-pipeline">
          <h2>Change password</h2>
          <p>
            Changing your password signs out your other sessions. It does not
            remove MFA.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget,
                values = new FormData(form);
              void run(async () => {
                if (values.get("newPassword") !== values.get("confirmPassword"))
                  throw new Error("The passwords do not match.");
                const result = await authClient.changePassword({
                  currentPassword: String(values.get("currentPassword")),
                  newPassword: String(values.get("newPassword")),
                  revokeOtherSessions: true,
                });
                if (result.error) throw new Error(result.error.message);
                form.reset();
                setMessage(
                  "Password changed. Other sessions have been signed out.",
                );
              });
            }}
          >
            <label className="field">
              <span>Current password</span>
              <input
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <label className="field">
              <span>New password</span>
              <input
                name="newPassword"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
              />
            </label>
            <label className="field">
              <span>Confirm new password</span>
              <input
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
              />
            </label>
            <button className="btn primary" disabled={busy}>
              Change password
            </button>
          </form>
        </section>
      </div>
      <section className="table-panel sales-pipeline">
        <div className="panel-heading">
          <div>
            <h2>Active sessions</h2>
            <p>Review devices signed in to your account.</p>
          </div>
          <button
            className="btn"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const result = await authClient.revokeOtherSessions();
                if (result.error) throw new Error(result.error.message);
                setMessage("Other sessions have been signed out.");
              })
            }
          >
            Sign out other sessions
          </button>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Device</th>
                <th>IP address</th>
                <th>Last active</th>
                <th>Access</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.token}>
                  <td>{s.userAgent || "Unknown device"}</td>
                  <td>{s.ipAddress || "Unavailable"}</td>
                  <td>{new Date(s.updatedAt).toLocaleString()}</td>
                  <td>
                    {s.token === session?.session.token ? (
                      "This session"
                    ) : (
                      <button
                        className="btn"
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            const result = await authClient.revokeSession({
                              token: s.token,
                            });
                            if (result.error)
                              throw new Error(result.error.message);
                            setMessage("Session signed out.");
                          })
                        }
                      >
                        Sign out session
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
