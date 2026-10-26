"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
export function AccountAccess({
  mode,
  email = "",
  token = "",
  next = "/dashboard",
  invalid = false,
}: {
  mode: "verify" | "forgot" | "reset" | "two-factor";
  email?: string;
  token?: string;
  next?: string;
  invalid?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [backup, setBackup] = useState(false);
  const title =
    mode === "verify"
      ? "Verify your email"
      : mode === "forgot"
        ? "Reset your password"
        : mode === "reset"
          ? "Choose a new password"
          : "Verify your sign-in";
  return (
    <div className="account-auth-page">
      <section className="auth-card">
        <Link href="/login" className="brand-name">
          AGI <b>One</b>
        </Link>
        <h1>{title}</h1>
        <p>
          {mode === "verify"
            ? "Open the verification link in your email, then sign in. You must verify your address before joining a workspace."
            : mode === "forgot"
              ? "We’ll send a recovery link if an account exists for this address."
              : mode === "reset"
                ? "Use at least 12 characters. Resetting your password signs out existing sessions; your authenticator remains required if enabled."
                : backup
                  ? "Enter one unused backup code from your recovery set."
                  : "Enter the six-digit code from your authenticator app."}
        </p>
        {invalid && (
          <p className="form-error" role="alert">
            This link is invalid or expired. Request a new one.
          </p>
        )}
        {message ? (
          <div role="status" className="auth-message">
            {message}
          </div>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              const values = new FormData(e.currentTarget);
              try {
                if (mode === "verify") {
                  const callback = new URL("/login", window.location.origin);
                  callback.searchParams.set("verified", "1");
                  callback.searchParams.set("next", next);
                  const result = await authClient.sendVerificationEmail({
                    email: String(values.get("email")),
                    callbackURL: callback.href,
                  });
                  if (result.error) throw new Error(result.error.message);
                  setMessage(
                    "If this address needs verification, a new link has been sent. Check your inbox and spam folder.",
                  );
                } else if (mode === "forgot") {
                  const result = await authClient.requestPasswordReset({
                    email: String(values.get("email")),
                    redirectTo: new URL(
                      "/reset-password",
                      window.location.origin,
                    ).href,
                  });
                  if (result.error) throw new Error(result.error.message);
                  setMessage(
                    "If an account exists for this address, a recovery link has been sent. Check your inbox and spam folder.",
                  );
                } else if (mode === "reset") {
                  if (values.get("password") !== values.get("confirm"))
                    throw new Error("The passwords do not match.");
                  const result = await authClient.resetPassword({
                    newPassword: String(values.get("password")),
                    token,
                  });
                  if (result.error) throw new Error(result.error.message);
                  window.history.replaceState(null, "", "/reset-password");
                  setMessage(
                    "Your password has been reset. Sign in with your new password.",
                  );
                } else {
                  const result = backup
                    ? await authClient.twoFactor.verifyBackupCode({
                        code: String(values.get("code")).trim(),
                        trustDevice: false,
                      })
                    : await authClient.twoFactor.verifyTotp({
                        code: String(values.get("code")).trim(),
                        trustDevice: false,
                      });
                  if (result.error) throw new Error(result.error.message);
                  router.replace(next);
                  router.refresh();
                }
              } catch (e) {
                setError(
                  (e as Error).message || "Could not complete this request.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {(mode === "verify" || mode === "forgot") && (
              <label className="field">
                <span>Email address</span>
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  defaultValue={email}
                  required
                  maxLength={254}
                />
              </label>
            )}
            {mode === "reset" && (
              <>
                <label className="field">
                  <span>New password</span>
                  <input
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={12}
                    maxLength={128}
                  />
                </label>
                <label className="field">
                  <span>Confirm password</span>
                  <input
                    name="confirm"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={12}
                    maxLength={128}
                  />
                </label>
              </>
            )}
            {mode === "two-factor" && (
              <label className="field">
                <span>{backup ? "Backup code" : "Authenticator code"}</span>
                <input
                  key={String(backup)}
                  name="code"
                  autoComplete="one-time-code"
                  inputMode={backup ? "text" : "numeric"}
                  required
                  pattern={backup ? undefined : "[0-9]{6}"}
                  maxLength={backup ? 100 : 6}
                />
              </label>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="btn primary"
              disabled={busy || (mode === "reset" && (!token || invalid))}
            >
              {busy
                ? "Please wait…"
                : mode === "verify"
                  ? "Send verification link"
                  : mode === "forgot"
                    ? "Send recovery link"
                    : mode === "reset"
                      ? "Reset password"
                      : "Verify & continue"}
            </button>
          </form>
        )}
        {mode === "two-factor" && (
          <button
            className="text-btn"
            onClick={() => {
              setBackup(!backup);
              setError("");
            }}
          >
            {backup ? "Use authenticator code" : "Use a backup code"}
          </button>
        )}
        {mode === "reset" && (
          <Link className="text-btn" href="/forgot-password">
            Request a new recovery link
          </Link>
        )}
        <Link
          className="text-btn"
          href={
            "/login" +
            (next.startsWith("/onboarding?")
              ? "?" + new URLSearchParams({ next })
              : "")
          }
        >
          Back to sign in
        </Link>
      </section>
    </div>
  );
}
