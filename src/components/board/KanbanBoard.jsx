/**
 * Reusable Rocketlane-style Kanban board primitives.
 *
 * Layout:
 *   <KanbanBoard> ── horizontal-scrolling row of columns
 *     <KanbanColumn> ── one stack: header (status, title, dates, progress) + card list
 *       <KanbanCard> ── compact card with optional checkbox, title, footer slot
 *
 * The components are presentational only. Pass ready-shaped data in via props.
 */

const STATUS_ICON = {
  done: { glyph: '✓', wrapper: 'bg-success-500 text-white', ring: '' },
  in_progress: { glyph: '◐', wrapper: 'bg-paper border-2 border-link-500 text-link-500', ring: '' },
  blocked: { glyph: '⚠', wrapper: 'bg-risk-100 text-risk-600 border border-risk-300', ring: '' },
  todo: { glyph: '', wrapper: 'bg-paper border-2 border-ink-200', ring: '' },
  pending: { glyph: '', wrapper: 'bg-paper border-2 border-ink-200', ring: '' },
};

export function StatusDot({ status = 'todo', size = 'md', onClick, title }) {
  const cfg = STATUS_ICON[status] || STATUS_ICON.todo;
  const sz = size === 'sm' ? 'w-4 h-4 text-[10px]' : 'w-5 h-5 text-[11px]';
  const cls = `inline-flex items-center justify-center rounded-full ${sz} ${cfg.wrapper} shrink-0 ${onClick ? 'cursor-pointer hover:scale-110 transition-transform' : ''}`;
  return (
    <span
      className={cls}
      onClick={onClick}
      title={title || status}
      role={onClick ? 'button' : undefined}
      aria-label={title || status}
    >
      {cfg.glyph}
    </span>
  );
}

/** Thin progress bar; safe when total = 0. */
export function ProgressBar({ value = 0, color = 'success', height = 4 }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const tone =
    color === 'risk'
      ? 'bg-risk-500'
      : color === 'caution'
        ? 'bg-caution-500'
        : color === 'link'
          ? 'bg-link-500'
          : 'bg-success-500';
  return (
    <div className="bg-ink-100 rounded-full overflow-hidden" style={{ height }}>
      <div className={`${tone} h-full rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/**
 * Single column.
 *
 * Props:
 *   icon            ReactNode (e.g. <StatusDot ... />) shown left of title
 *   title           string
 *   subtitle        string|ReactNode (e.g. date range)
 *   accent          'success' | 'caution' | 'risk' | 'link' (drives the top accent bar)
 *   progress        0..100
 *   progressTone    'success' | 'risk' | 'caution' | 'link'
 *   actions         ReactNode (right-aligned action buttons in header)
 *   footer          ReactNode (small section at bottom of column, e.g. + Add card)
 *   children        Card list
 *   emptyMessage    string shown when no children
 *   onTitleClick    optional click handler on the header title
 */
export function KanbanColumn({
  icon,
  title,
  subtitle,
  accent = 'link',
  progress,
  progressTone = 'success',
  actions,
  footer,
  emptyMessage,
  onTitleClick,
  children,
}) {
  const accentBar =
    accent === 'success'
      ? 'bg-success-500'
      : accent === 'risk'
        ? 'bg-risk-500'
        : accent === 'caution'
          ? 'bg-caution-500'
          : 'bg-link-500';

  const cardCount = Array.isArray(children) ? children.filter(Boolean).length : children ? 1 : 0;

  return (
    <div className="flex flex-col bg-paper border border-ink-100 rounded-lg shadow-sm shrink-0 w-72 max-h-[calc(100vh-220px)]">
      <div className={`h-1 rounded-t-lg ${accentBar}`} />
      <div className="px-3 pt-2.5 pb-2 border-b border-ink-100">
        <div className="flex items-start gap-2 min-w-0">
          {icon ? <span className="mt-0.5">{icon}</span> : null}
          <button
            type="button"
            onClick={onTitleClick}
            className={`flex-1 text-left text-[13px] font-semibold text-ink-800 leading-snug truncate ${onTitleClick ? 'hover:text-link-600' : 'cursor-default'}`}
            disabled={!onTitleClick}
          >
            {title}
          </button>
          {actions ? <div className="flex items-center gap-1 shrink-0">{actions}</div> : null}
        </div>
        {subtitle ? (
          <div className="mt-1 text-[11px] text-ink-500 leading-snug truncate">{subtitle}</div>
        ) : null}
        {typeof progress === 'number' ? (
          <div className="mt-1.5">
            <ProgressBar value={progress} color={progressTone} />
          </div>
        ) : null}
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2 min-h-[80px]">
        {cardCount === 0 ? (
          <div className="text-[11px] text-ink-300 italic text-center py-6">
            {emptyMessage || 'No items yet'}
          </div>
        ) : (
          children
        )}
      </div>
      {footer ? <div className="border-t border-ink-100 px-2 py-1.5">{footer}</div> : null}
    </div>
  );
}

/**
 * Single card inside a column.
 *
 * Props:
 *   leadingIcon  ReactNode (status dot, etc.)
 *   title        string
 *   subtitle     ReactNode (e.g. due date, hour pill)
 *   tags         ReactNode[] small badges shown below title
 *   footer       ReactNode (avatars, hour count, etc.)
 *   accent       'risk' | 'caution' | undefined — colored left edge for at-risk items
 *   onClick      open / drill-in
 *   actions      hover-only icon buttons in top-right
 */
export function KanbanCard({
  leadingIcon,
  title,
  subtitle,
  tags,
  footer,
  accent,
  onClick,
  actions,
}) {
  const edge =
    accent === 'risk'
      ? 'border-l-2 border-l-risk-500'
      : accent === 'caution'
        ? 'border-l-2 border-l-caution-500'
        : '';
  return (
    <div
      onClick={onClick}
      className={`group/card relative bg-paper border border-ink-100 rounded-md px-2.5 py-2 text-[12px] hover:shadow-md hover:border-link-200 transition-all ${edge} ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-start gap-2">
        {leadingIcon ? <span className="mt-0.5">{leadingIcon}</span> : null}
        <div className="flex-1 min-w-0">
          <p className="m-0 font-medium text-ink-800 leading-snug break-words">{title}</p>
          {subtitle ? (
            <div className="mt-0.5 text-[11px] text-ink-500 leading-snug">{subtitle}</div>
          ) : null}
          {tags && tags.length ? (
            <div className="mt-1 flex flex-wrap gap-1">{tags}</div>
          ) : null}
        </div>
        {actions ? (
          <div className="opacity-0 group-hover/card:opacity-100 transition-opacity shrink-0 -mr-1 -mt-1">
            {actions}
          </div>
        ) : null}
      </div>
      {footer ? <div className="mt-1.5 pt-1.5 border-t border-ink-50">{footer}</div> : null}
    </div>
  );
}

/** Container that arranges columns horizontally with overflow scroll. */
export default function KanbanBoard({ children, className = '' }) {
  return (
    <div className={`overflow-x-auto pb-2 ${className}`}>
      <div className="flex gap-3 min-w-max">{children}</div>
    </div>
  );
}
