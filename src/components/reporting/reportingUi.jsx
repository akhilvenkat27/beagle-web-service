import LoadingScreen from '../LoadingScreen';
import { healthLabel, ON_TRACK, AT_RISK, CAUTION } from '../../constants/healthRag';

/** Shared layout + tokens for Module 7 reporting / dashboards (matches login aesthetic). */

export function PageShell({ children, wide = false }) {
  return (
    <div className="min-h-full bg-gradient-to-b from-ink-100 via-ink-50 to-paper">
      <div className={`mx-auto px-5 py-8 sm:px-6 lg:px-8 ${wide ? 'max-w-7xl' : 'max-w-6xl'}`}>{children}</div>
    </div>
  );
}

export function PageHeader({ eyebrow, title, subtitle, action }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-3xl">
        {eyebrow && (
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-focus-600">{eyebrow}</p>
        )}
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink-900 sm:text-[1.75rem]">{title}</h1>
        {subtitle && (
          <p className="mt-2 text-sm leading-relaxed text-ink-600 sm:text-[0.9375rem]">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Card({ children, className = '' }) {
  return (
    <div
      className={`rounded-2xl border border-ink-200 bg-paper p-5 shadow-[0_10px_35px_rgba(15,23,42,0.06)] ${className}`}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children }) {
  return <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-500">{children}</h2>;
}

export function StatCard({ label, value, hint }) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-ink-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
    </Card>
  );
}

export function deliveryHealthPillClass(health) {
  if (health === AT_RISK) return 'bg-risk-50 text-risk-800 ring-1 ring-inset ring-risk-100';
  if (health === ON_TRACK) return 'bg-success-50 text-success-900 ring-1 ring-inset ring-success-100';
  if (health === CAUTION) return 'bg-caution-50 text-caution-900 ring-1 ring-inset ring-caution-100';
  return 'bg-ink-50 text-ink-800 ring-1 ring-inset ring-ink-100';
}

export function DeliveryHealthBadge({ value }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${deliveryHealthPillClass(
        value
      )}`}
    >
      {healthLabel(value)}
    </span>
  );
}

export function LoadingState({ label }) {
  return <LoadingScreen title={label || 'Loading data'} subtitle="Fetching latest dashboard insights..." />;
}

export function EmptyRow({ children }) {
  return <p className="py-6 text-center text-sm text-ink-400">{children}</p>;
}

export const inputClass =
  'w-full rounded-lg border border-ink-300 bg-paper px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:border-focus-500 focus:outline-none focus:ring-2 focus:ring-focus-500/30';

export const selectClass = inputClass;

export const btnPrimary =
  'inline-flex items-center justify-center rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-paper shadow-sm transition hover:bg-ink-950 disabled:cursor-not-allowed disabled:opacity-50';

export const btnSecondary =
  'inline-flex items-center justify-center rounded-lg border border-ink-300 bg-paper px-3 py-2 text-sm font-medium text-ink-700 shadow-sm transition hover:bg-ink-50';

export const linkClass = 'text-sm font-medium text-focus-700 hover:text-focus-900';
