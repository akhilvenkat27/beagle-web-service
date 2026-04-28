import { useEffect, useMemo, useRef, useState } from 'react';
import Avatar from './Avatar';

/**
 * Searchable member picker / combobox.
 *
 * Behavior:
 * - Compact display button shows the current selection (avatar + name) or a
 *   placeholder. Clicking opens a popover with a search input + filtered list.
 * - Typing filters by name / email / role / and any custom subtitle string.
 * - Picking a member calls onChange({ user, freeText: null }).
 * - "Use placeholder text" submits whatever is currently typed (free-form
 *   role label) via onChange({ user: null, freeText: <string> }).
 *
 * Props:
 *   value:             { userId?: string, label?: string }
 *   options:           Array of any user-like objects
 *   getOptionId?:      (option) => string   default: (o) => o._id || o.userId
 *   getOptionName?:    (option) => string   default: (o) => o.name || o.email
 *   getOptionSubtitle?:(option) => string   default: role + email
 *   allowFreeText?:    boolean — show "Use as placeholder" footer (default true)
 *   onChange:          ({ user, freeText }) => void
 *   onClear?:          () => void
 *   disabled?:         boolean
 *   placeholder?:      string ("Unassigned" by default)
 *   compact?:          boolean — render the in-table compact pill
 *   align?:            'left' | 'right'  (popover alignment, default 'left')
 *   width?:            number — popover width in px (default 288)
 */
export default function MemberPicker({
  value,
  options = [],
  getOptionId,
  getOptionName,
  getOptionSubtitle,
  allowFreeText = true,
  onChange,
  onClear,
  disabled = false,
  placeholder = 'Unassigned',
  compact = false,
  align = 'left',
  loading = false,
  className = '',
  width = 288,
}) {
  const idOf = getOptionId || ((o) => o?._id || o?.userId || '');
  const nameOf = getOptionName || ((o) => o?.name || o?.email || 'Unnamed');
  const subtitleOf =
    getOptionSubtitle ||
    ((o) => {
      const role = o?.role || '';
      const email = o?.email || '';
      if (role && email) return `${role} · ${email}`;
      return role || email || '—';
    });
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  // Close on outside click.
  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Focus search when opened.
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
    if (!open) setQuery('');
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((u) => {
      const name = String(nameOf(u) || '').toLowerCase();
      const subtitle = String(subtitleOf(u) || '').toLowerCase();
      const email = String(u?.email || '').toLowerCase();
      const role = String(u?.role || '').toLowerCase();
      return (
        name.includes(q) ||
        email.includes(q) ||
        role.includes(q) ||
        subtitle.includes(q)
      );
    });
  }, [options, query, nameOf, subtitleOf]);

  const displayName = value?.label?.trim() || '';
  const hasUser = !!value?.userId;

  const button = compact ? (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) setOpen((v) => !v);
      }}
      className={`flex items-center gap-1.5 text-left text-[12px] truncate w-full px-1 py-0.5 rounded-md ${
        disabled ? 'text-ink-400 cursor-not-allowed' : 'text-ink-700 hover:bg-ink-50'
      }`}
      title={displayName || placeholder}
    >
      {hasUser ? <Avatar name={displayName} size={18} /> : null}
      <span className="truncate">{displayName || <span className="text-ink-400">{placeholder}</span>}</span>
    </button>
  ) : (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) setOpen((v) => !v);
      }}
      className={`flex items-center gap-2 w-full border border-ink-200 rounded-md px-2 py-1.5 text-[13px] bg-paper text-left ${
        disabled ? 'text-ink-400 cursor-not-allowed' : 'hover:bg-ink-50'
      }`}
    >
      {hasUser ? <Avatar name={displayName} size={20} /> : null}
      <span className="flex-1 truncate">
        {displayName || <span className="text-ink-400">{placeholder}</span>}
      </span>
      <span className="text-ink-400 text-[10px]">▾</span>
    </button>
  );

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      {button}
      {open && !disabled ? (
        <div
          className={`absolute z-30 mt-1 max-w-[80vw] bg-paper border border-ink-200 rounded-md shadow-lg ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
          style={{ width }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-2 border-b border-ink-100">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setOpen(false);
                if (e.key === 'Enter' && filtered.length > 0) {
                  onChange?.({ user: filtered[0], freeText: null });
                  setOpen(false);
                }
              }}
              placeholder="Search by name, email, or role"
              className="w-full border border-ink-200 rounded-md px-2 py-1.5 text-[13px] outline-none focus:border-focus-400"
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {loading ? (
              <div className="px-3 py-3 text-[12px] text-ink-400">Loading members…</div>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-3 text-[12px] text-ink-400">
                No members match “{query}”.{' '}
                {allowFreeText && query.trim() ? (
                  <button
                    type="button"
                    onClick={() => {
                      onChange?.({ user: null, freeText: query.trim() });
                      setOpen(false);
                    }}
                    className="text-focus-700 underline"
                  >
                    Use as placeholder
                  </button>
                ) : null}
              </div>
            ) : (
              filtered.map((u) => {
                const optId = idOf(u);
                const selected = String(value?.userId) === String(optId);
                const optName = nameOf(u);
                const subtitle = subtitleOf(u);
                return (
                  <button
                    key={optId || optName}
                    type="button"
                    onClick={() => {
                      onChange?.({ user: u, freeText: null });
                      setOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-ink-50 ${
                      selected ? 'bg-focus-50' : ''
                    }`}
                  >
                    <Avatar name={optName} size={24} />
                    <span className="flex-1 min-w-0">
                      <span className="block truncate text-ink-800">{optName}</span>
                      <span className="block truncate text-[11px] text-ink-500">{subtitle}</span>
                    </span>
                    {selected ? <span className="text-focus-700 text-[12px]">✓</span> : null}
                  </button>
                );
              })
            )}
          </div>
          <div className="border-t border-ink-100 p-2 flex items-center justify-between gap-2">
            {allowFreeText && query.trim() ? (
              <button
                type="button"
                onClick={() => {
                  onChange?.({ user: null, freeText: query.trim() });
                  setOpen(false);
                }}
                className="text-[12px] text-focus-700 hover:underline"
              >
                Use “{query.trim()}” as placeholder
              </button>
            ) : (
              <span className="text-[11px] text-ink-400">
                {allowFreeText ? 'Pick a member or type a role placeholder.' : 'Type to search members.'}
              </span>
            )}
            {hasUser || displayName ? (
              <button
                type="button"
                onClick={() => {
                  if (onClear) onClear();
                  else onChange?.({ user: null, freeText: '' });
                  setOpen(false);
                }}
                className="text-[12px] text-ink-500 hover:text-red-600"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
