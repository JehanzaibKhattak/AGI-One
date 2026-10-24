"use client";
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
                const result = signup
                  ? await authClient.signUp.email({
                      name: String(values.get("name")).trim(),
                      email,
                      password,
                    })
                  : await authClient.signIn.email({ email, password });
                if (result.error)
                  throw new Error(result.error.message || "Unable to sign in.");
                const next = new URLSearchParams(window.location.search).get(
                  "next",
                );
                router.replace(
                  next?.startsWith("/onboarding?")
                    ? next
                    : signup
                      ? "/onboarding"
                      : "/dashboard",
                );
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
