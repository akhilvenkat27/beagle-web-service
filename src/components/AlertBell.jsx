import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { alertsAPI } from '../services/api';

const STAFF = ['admin', 'pmo', 'dh', 'pm', 'exec', 'member'];

export default function AlertBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('new');
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [badgeCount, setBadgeCount] = useState(0);

  const refreshBadge = useCallback(async () => {
    if (!user || !STAFF.includes(user.role)) return;
    try {
      const { data } = await alertsAPI.list({ unreadOnly: 'true' });
      setBadgeCount(Array.isArray(data) ? data.filter((a) => !a.isRead).length : 0);
    } catch {
      setBadgeCount(0);
    }
  }, [user]);

  const load = useCallback(async () => {
    if (!user || !STAFF.includes(user.role)) return;
    setLoading(true);
    try {
      const unread = tab === 'new';
      const { data } = await alertsAPI.list(unread ? { unreadOnly: 'true' } : {});
      setAlerts(Array.isArray(data) ? data : []);
      await refreshBadge();
    } catch {
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, [user, tab, refreshBadge]);

  useEffect(() => {
    refreshBadge();
    const t = setInterval(refreshBadge, 30000);
    return () => clearInterval(t);
  }, [refreshBadge]);

  useEffect(() => {
    if (!open) return;
    load();
  }, [open, load, tab]);

  if (!user || !STAFF.includes(user.role)) return null;

  const dismiss = async (id) => {
    try {
      await alertsAPI.markRead(id);
      await load();
    } catch {
      /* ignore */
    }
  };

  const acceptInvite = async (id) => {
    try {
      await alertsAPI.acceptInvite(id);
      await load();
    } catch {
      /* ignore */
    }
  };

  const markAllRead = async () => {
    const unread = alerts.filter((a) => !a.isRead);
    await Promise.all(unread.map((a) => alertsAPI.markRead(a._id)));
    await load();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-ink-600 transition hover:bg-ink-100 hover:text-ink-900"
        aria-label="Notifications"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {badgeCount > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-risk-600 px-0.5 text-[10px] font-bold leading-none text-paper">
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <button type="button" className="fixed inset-0 z-[60] bg-ink-900/20" aria-label="Close" onClick={() => setOpen(false)} />
          <div className="fixed left-1/2 top-[12vh] z-[70] w-[min(28rem,calc(100vw-1.5rem))] -tranink-x-1/2 overflow-hidden rounded-2xl border border-ink-200 bg-paper shadow-[0_25px_80px_rgba(15,23,42,0.18)]">
            <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <span className="text-ink-500">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    />
                  </svg>
                </span>
                <h2 className="text-base font-semibold text-ink-900">Notifications</h2>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to="/settings/notifications"
                  className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-800"
                  title="Settings"
                  onClick={() => setOpen(false)}
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </Link>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100"
                  aria-label="Close"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 border-b border-ink-100 px-5 py-2">
              {['All', 'Tasks I own', 'Mentions', 'Team'].map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-ink-200 bg-ink-50 px-3 py-1 text-xs font-medium text-ink-500"
                >
                  {label}
                </span>
              ))}
            </div>

            <div className="flex items-center justify-between border-b border-ink-100 px-5 py-2">
              <div className="flex gap-4 text-sm">
                <button
                  type="button"
                  className={`pb-2 font-semibold ${tab === 'new' ? 'border-b-2 border-focus-600 text-ink-900' : 'text-ink-500'}`}
                  onClick={() => setTab('new')}
                >
                  New
                </button>
                <button
                  type="button"
                  className={`pb-2 font-semibold ${tab === 'cleared' ? 'border-b-2 border-focus-600 text-ink-900' : 'text-ink-500'}`}
                  onClick={() => setTab('cleared')}
                >
                  Cleared
                </button>
              </div>
              <button type="button" className="text-xs font-semibold text-focus-700 hover:underline" onClick={markAllRead}>
                Mark all read
              </button>
            </div>

            <div className="max-h-[min(24rem,50vh)] overflow-y-auto px-2 py-2">
              {loading && alerts.length === 0 ? (
                <p className="py-10 text-center text-sm text-ink-500">Loading…</p>
              ) : alerts.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-ink-100 text-ink-300">
                    <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                      />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-ink-800">No new notifications</p>
                  <p className="mx-auto mt-1 max-w-xs text-xs text-ink-500">
                    Updates on tasks and projects you are involved in will appear here.
                  </p>
                  <Link to="/settings/notifications" className="mt-4 inline-block text-sm font-semibold text-focus-700 hover:underline" onClick={() => setOpen(false)}>
                    Manage your notifications
                  </Link>
                </div>
              ) : (
                <ul className="space-y-1">
                  {alerts.map((a) => (
                    <li key={a._id} className="rounded-xl border border-ink-100 bg-ink-50/50 px-3 py-2.5 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span
                            className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                              a.severity === 'Critical' ? 'bg-risk-100 text-risk-800' : 'bg-caution-100 text-caution-900'
                            }`}
                          >
                            {a.type?.replace(/([A-Z])/g, ' $1').trim() || 'Alert'}
                          </span>
                          <p className="mt-1 leading-snug text-ink-800">{a.message}</p>
                          {a.type === 'ProjectInvite' && (
                            <p className="mt-1 text-[11px] font-semibold text-focus-700">
                              {a.data?.status === 'accepted' ? 'Invite accepted - in progress' : 'Invite pending'}
                            </p>
                          )}
                          <p className="mt-1 text-[10px] text-ink-400">
                            {a.createdAt ? new Date(a.createdAt).toLocaleString('en-IN') : ''}
                          </p>
                        </div>
                        <div className="shrink-0 space-y-1 text-right">
                          {a.type === 'ProjectInvite' && a.data?.status !== 'accepted' && (
                            <button type="button" onClick={() => acceptInvite(a._id)} className="block text-xs font-semibold text-focus-700 hover:underline">
                              Accept
                            </button>
                          )}
                          {!a.isRead && (
                            <button type="button" onClick={() => dismiss(a._id)} className="block text-xs font-semibold text-ink-500 hover:underline">
                              Clear
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {['admin', 'dh'].includes(user.role) && (
              <div className="border-t border-ink-100 bg-ink-50 px-4 py-2 text-right">
                <Link to="/admin/portfolio-finance" className="text-xs font-semibold text-focus-700 hover:underline" onClick={() => setOpen(false)}>
                  Portfolio finance →
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
