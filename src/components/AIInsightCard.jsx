/**
 * Lazy-load wrapper for AI features (Module 5) — run analysis on button click only.
 */
export default function AIInsightCard({
  title,
  description,
  onRun,
  loading,
  disabled,
  children,
  adminOnly,
  isAdmin,
}) {
  if (adminOnly && !isAdmin) return null;

  return (
    <div className="border border-accent-100 rounded-lg p-4 bg-paper/80">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <div>
          <h4 className="text-sm font-semibold text-ink-900">{title}</h4>
          {description && <p className="text-xs text-ink-500 mt-0.5">{description}</p>}
        </div>
        <button
          type="button"
          onClick={onRun}
          disabled={disabled || loading}
          className="text-xs font-medium bg-accent-700 text-paper px-2.5 py-1 rounded-md hover:bg-accent-800 disabled:opacity-50 shrink-0"
        >
          {loading ? 'Running…' : 'Run analysis'}
        </button>
      </div>
      {children}
    </div>
  );
}
