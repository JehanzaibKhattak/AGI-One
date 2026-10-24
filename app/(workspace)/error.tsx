"use client";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="error-state">
      <h1>Something interrupted this page</h1>
      <p>
        Your records are stored in your workspace. Try loading the page again.
      </p>
      <button className="btn primary" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
