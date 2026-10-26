"use client";
import Link from "next/link";
import { authDestination } from "@/lib/auth-navigation";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Eye,
  EyeOff,
  ShieldCheck,
  Users,
  ChartNoAxesCombined,
  Wrench,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
export default function Login() {
  const router = useRouter();
  const [signup, setSignup] = useState(false);
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <div className="login-page">
      <section className="login-brand-panel">
        <div className="brand">
          <span className="brand-icon">
            a<span>1</span>
          </span>
          <span className="brand-name">
            AGI <b>One</b>
            <small>Customer relationship management</small>
          </span>
        </div>
        <div className="login-story">
          <span className="eyebrow">YOUR BUSINESS, CONNECTED</span>
          <h1>
            Every relationship.
            <br />
            One workspace.
          </h1>
          <p>
            Bring your customers, sales, service and operations together. Give
            your team the clarity to move forward.
          </p>
          <div className="login-feature-grid">
            <span>
              <Users size={19} />
              Customer relationships
            </span>
            <span>
              <ChartNoAxesCombined size={19} />
              Sales & opportunities
            </span>
            <span>
              <Wrench size={19} />
              Service & operations
            </span>
            <span>
              <ShieldCheck size={19} />
              Workspace access controls
            </span>
          </div>
        </div>
        <span className="login-caption">AGI One · Business, connected.</span>
      </section>
      <section className="login-form-panel">
        <div className="login-form">
          <span className="login-welcome">WELCOME TO AGI ONE</span>
          <h1>{signup ? "Start your workspace." : "Good to have you back."}</h1>
          <p>
            {signup
              ? "Create your account, then set up or join your team."
              : "Sign in to keep your business moving."}
          </p>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setError("");
              setPending(true);
              const values = new FormData(event.currentTarget);
              try {
                const email = String(values.get("email")).trim();
                const password = String(values.get("password"));
                const requestedNext = new URLSearchParams(
                  window.location.search,
                ).get("next");
                const next = authDestination(requestedNext);
                const verificationCallback = new URL(
                  "/login?verified=1",
                  window.location.origin,
                );
                verificationCallback.searchParams.set(
                  "next",
                  next === "/dashboard" ? "/onboarding?verified=1" : next,
                );
                const result = signup
                  ? await authClient.signUp.email({
                      name: String(values.get("name")).trim(),
                      email,
                      password,
                      callbackURL: verificationCallback.href,
                    })
                  : await authClient.signIn.email({ email, password });
                if (result.error) {
                  if (result.error.code === "EMAIL_NOT_VERIFIED") {
                    router.replace(
                      "/verify-email?" + new URLSearchParams({ email, next }),
                    );
                    return;
                  }
                  throw new Error(result.error.message || "Unable to sign in.");
                }
                if (signup) {
                  router.replace(
                    "/verify-email?" +
                      new URLSearchParams({
                        email,
                        next:
                          next === "/dashboard"
                            ? "/onboarding?verified=1"
                            : next,
                      }),
                  );
                  return;
                }
                if (
                  result.data &&
                  "twoFactorRedirect" in result.data &&
                  result.data.twoFactorRedirect
                ) {
                  router.replace(
                    "/two-factor?" + new URLSearchParams({ next }),
                  );
                  return;
                }
                router.replace(next);
                router.refresh();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setPending(false);
              }
            }}
          >
            {signup && (
              <label className="field">
                <span>Full name</span>
                <input
                  name="name"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={100}
                />
              </label>
            )}
            <label className="field">
              <span>Email address</span>
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
              />
            </label>
            <label className="field">
              <span>Password</span>
              <div className="password-input">
                <input
                  name="password"
                  aria-label="Password"
                  type={show ? "text" : "password"}
                  autoComplete={signup ? "new-password" : "current-password"}
                  required
                  minLength={signup ? 12 : 1}
                />
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={show ? "Hide password" : "Show password"}
                  onClick={() => setShow(!show)}
                >
                  {show ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              {signup && <small>Use at least 12 characters.</small>}
            </label>
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <button className="btn primary login-submit" disabled={pending}>
              {pending ? "Please wait…" : signup ? "Create account" : "Sign in"}
              <ArrowRight size={17} />
            </button>
          </form>
          {!signup && (
            <Link className="text-btn" href="/forgot-password">
              Forgot your password?
            </Link>
          )}
          <button
            className="text-btn"
            onClick={() => {
              setSignup(!signup);
              setError("");
            }}
          >
            {signup
              ? "Already have an account? Sign in"
              : "New to AGI One? Create an account"}
          </button>
        </div>
        <footer>
          AGI One <span>© {new Date().getFullYear()}</span>
        </footer>
      </section>
    </div>
  );
}
