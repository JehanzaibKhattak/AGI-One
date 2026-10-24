export default function Loading() {
  return (
    <div role="status" aria-label="Loading workspace">
      <div className="skeleton skeleton-title" />
      <div className="stats-grid">
        {[0, 1, 2, 3].map((i) => (
          <div className="skeleton skeleton-card" key={i} />
        ))}
      </div>
      <div className="skeleton skeleton-table" />
      <span className="sr-only">Loading your workspace…</span>
    </div>
  );
}
