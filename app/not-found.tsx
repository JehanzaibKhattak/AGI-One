import Link from "next/link";
export default function NotFound() {
  return (
    <div className="error-state">
      <span className="eyebrow">404 · PAGE NOT FOUND</span>
      <h1>Let’s get you back to work.</h1>
      <p>This page doesn’t exist in your workspace.</p>
      <Link className="btn primary" href="/dashboard">
        Go to dashboard
      </Link>
    </div>
  );
}
