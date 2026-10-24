"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Eye,
  EyeOff,
  ShieldCheck,
  Boxes,
  Wrench,
  ChartNoAxesCombined,
} from "lucide-react";
const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
  persona: z.string(),
});
export default function Login() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [show, setShow] = useState(false);
  const form = useForm({
    defaultValues: {
      email: "admin@amss.pk",
      password: "admin123",
      persona: "Super Admin",
    },
  });
  return (
    <div className="login-page">
      <section className="login-brand-panel">
        <div className="brand">
          <span className="brand-icon">
            a<span>m</span>
          </span>
          <span className="brand-name">
            AMSS <b>One</b>
            <small>Business Operations</small>
          </span>
        </div>
        <div className="login-story">
          <span className="eyebrow">AM SALES & SERVICES</span>
          <h1>
            One workspace.
            <br />A healthier business.
          </h1>
          <p>
            Connect your customers, equipment, and people. Bring every part of
            your business together.
          </p>
          <div className="login-feature-grid">
            <span>
              <ChartNoAxesCombined size={19} />
              Sales & relationships
            </span>
            <span>
              <Boxes size={19} />
              Inventory & procurement
            </span>
            <span>
              <Wrench size={19} />
              Equipment & service
            </span>
            <span>
              <ShieldCheck size={19} />
              Finance & oversight
            </span>
          </div>
        </div>
        <span className="login-caption">
          Built for the people behind better healthcare.
        </span>
        <div className="login-grid-art" aria-hidden="true">
          <div />
          <div />
          <div />
        </div>
      </section>
      <section className="login-form-panel">
        <div className="login-form">
          <span className="login-welcome">WELCOME TO YOUR WORKSPACE</span>
          <h2>Good to have you back.</h2>
          <p>Sign in to AMSS One to keep things moving.</p>
          <form
            onSubmit={form.handleSubmit(async (values) => {
              setError("");
              const result = loginSchema.safeParse(values);
              if (!result.success) {
                setError("Enter a valid email and password.");
                return;
              }
              if (
                values.email.toLowerCase() !== "admin@amss.pk" ||
                values.password !== "admin123"
              ) {
                setError("Use the demo email and password shown below.");
                return;
              }
              sessionStorage.setItem(
                "amss-session",
                JSON.stringify({ name: "Admin", role: values.persona }),
              );
              router.push("/dashboard");
            })}
          >
            <label className="field">
              <span>Email address</span>
              <input
                type="email"
                autoComplete="username"
                {...form.register("email")}
                required
              />
            </label>
            <label className="field">
              <span>Password</span>
              <div className="password-input">
                <input
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  {...form.register("password")}
                  required
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
            </label>
            <label className="field">
              <span>Explore as</span>
              <select {...form.register("persona")}>
                {[
                  "Super Admin",
                  "Director",
                  "Sales Manager",
                  "Finance Manager",
                  "Service Manager",
                ].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <Button
              type="submit"
              className="btn primary login-submit"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting
                ? "Opening workspace…"
                : "Sign in to workspace"}
              <ArrowRight size={17} />
            </Button>
          </form>
          <div className="demo-credentials">
            <ShieldCheck size={19} />
            <div>
              <strong>You’re exploring a demo workspace</strong>
              <p>
                admin@amss.pk <span>·</span> admin123
              </p>
              <small>
                Fictional records. Changes stay in this browser. Personas are
                previews with the same demo access.
              </small>
            </div>
          </div>
        </div>
        <footer>
          AM Sales & Services <span>© 2026 · Pakistan</span>
        </footer>
      </section>
    </div>
  );
}
