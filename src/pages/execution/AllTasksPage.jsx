import { useCallback, useEffect, useMemo, useState } from 'react';
import { executionAPI } from '../../services/api';
import Avatar from '../../components/Avatar';
import Button from '../../components/Button';
import DataTable from '../../components/DataTable';
import PageHeader from '../../components/PageHeader';
import PillTag from '../../components/PillTag';
import StatusIcon from '../../components/StatusIcon';

const VIEWS = [
  { id: 'all', label: 'Everything' },
  { id: 'mine', label: 'Assigned to me' },
  { id: 'created', label: 'Created by me' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'unassigned', label: 'Unassigned' },
  { id: 'nodue', label: 'No due date' },
  { id: 'atrisk', label: 'At risk' },
  { id: 'blocked', label: 'Blocked' },
  { id: 'milestones', label: 'Milestones' },
];

/** Maps sidebar view → GET /execution/all-tasks?view= (server applies RBAC + slice). */
function viewToApi(view) {
  if (!view || view === 'all') return undefined;
  const supported = new Set([
    'mine',
    'created',
    'overdue',
    'atrisk',
    'unassigned',
    'nodue',
    'in_progress',
    'done',
    'blocked',
    'milestones',
  ]);
  return supported.has(view) ? view : undefined;
}

export default function AllTasksPage() {
  const [tasks, setTasks] = useState([]);
  const [view, setView] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const loadTasks = useCallback(
    async (isBackground = false) => {
      const apiView = viewToApi(view);
      const params = { _t: Date.now() };
      if (apiView) params.view = apiView;
      if (!isBackground) setLoading(true);
      setError('');
      try {
        const { data } = await executionAPI.allTasks(params);
        setTasks(Array.isArray(data?.tasks) ? data.tasks : []);
        setLastSyncedAt(Date.now());
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load tasks');
      } finally {
        if (!isBackground) setLoading(false);
      }
    },
    [view]
  );

  useEffect(() => {
    loadTasks(false);
  }, [loadTasks]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      loadTasks(true);
    }, 15000);
    const onFocus = () => loadTasks(true);
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadTasks(true);
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [loadTasks]);

  const rows = useMemo(() => {
    let r = tasks;
    const q = filterText.trim().toLowerCase();
    if (q) {
      r = r.filter(
        (t) =>
          (t.projectName || '').toLowerCase().includes(q) ||
          (t.clientName || '').toLowerCase().includes(q) ||
          (t.title || '').toLowerCase().includes(q) ||
          (t.moduleName || '').toLowerCase().includes(q) ||
          (t.workstreamName || '').toLowerCase().includes(q) ||
          (t.assignee?.name || '').toLowerCase().includes(q)
      );
    }
    if (filterStatus !== 'all') {
      r = r.filter((t) => t.status === filterStatus);
    }
    return r;
  }, [tasks, filterText, filterStatus]);

  const hasActiveFilters = filterText.trim().length > 0 || filterStatus !== 'all';

  return (
    <div style={{ minHeight: '100%', background: '#fff' }}>
      <PageHeader
        title="All tasks"
        actions={
          <>
            <Button variant="secondary" type="button" onClick={() => loadTasks(false)}>
              Refresh
            </Button>
            <Button variant="secondary" type="button" onClick={() => setFilterOpen((o) => !o)}>
              Filter{hasActiveFilters ? ' ·' : ''}
            </Button>
            <Button variant="secondary" type="button">
              ◧
            </Button>
            <Button variant="secondary" type="button">
              ☰
            </Button>
          </>
        }
      />

      {filterOpen ? (
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-default)',
            background: '#f9fafb',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            alignItems: 'flex-end',
          }}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#374151' }}>
            Search project / task / assignee
            <input
              type="search"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Type to filter…"
              style={{
                minWidth: 220,
                height: 34,
                borderRadius: 6,
                border: '1px solid #e5e7eb',
                padding: '0 10px',
                fontSize: 13,
              }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#374151' }}>
            Task status
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{
                height: 34,
                borderRadius: 6,
                border: '1px solid #e5e7eb',
                padding: '0 8px',
                fontSize: 13,
                minWidth: 140,
                background: '#fff',
              }}
            >
              <option value="all">All statuses</option>
              <option value="Not Started">Not Started</option>
              <option value="In Progress">In Progress</option>
              <option value="Done">Done</option>
            </select>
          </label>
          <Button
            variant="ghost"
            type="button"
            onClick={() => {
              setFilterText('');
              setFilterStatus('all');
            }}
          >
            Clear filters
          </Button>
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', minHeight: 'calc(100% - 72px)' }}>
        <aside style={{ borderRight: '1px solid var(--border-default)', background: '#fff', padding: 8 }}>
          {VIEWS.map((v) => {
            const active = v.id === view;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setView(v.id)}
                style={{
                  width: '100%',
                  height: 30,
                  textAlign: 'left',
                  border: 0,
                  borderRadius: 6,
                  fontSize: 13,
                  padding: '0 10px',
                  marginBottom: 2,
                  cursor: 'pointer',
                  background: active ? 'var(--color-primary-light)' : 'transparent',
                  color: active ? 'var(--color-primary)' : '#374151',
                  fontWeight: active ? 500 : 400,
                }}
              >
                {v.label}
              </button>
            );
          })}
          <div style={{ marginTop: 16, padding: '0 10px', fontSize: 11, color: '#9ca3af', textTransform: 'uppercase' }}>
            My saved views
          </div>
        </aside>

        <section style={{ padding: 0 }}>
          {error ? (
            <div style={{ padding: 16, color: '#b91c1c' }}>{error}</div>
          ) : (
            <DataTable
              columns={[
                { key: 'task', label: 'Task', width: 360 },
                { key: 'project', label: 'Project', width: 180 },
                { key: 'phase', label: 'Project phase', width: 170 },
                { key: 'assignee', label: 'Assignee', width: 160 },
                { key: 'priority', label: 'Priority', width: 110 },
                { key: 'start', label: 'Due Date', width: 120 },
              ]}
              rows={rows}
              empty={loading ? 'Loading tasks…' : 'No tasks'}
              renderRow={(t) => {
                const status =
                  t.status === 'Done'
                    ? 'done'
                    : t.isOverdue
                    ? 'blocked'
                    : t.status === 'In Progress'
                    ? 'inprogress'
                    : 'todo';
                const phaseColor =
                  (t.deliveryPhase || '').toLowerCase().includes('kick') ? 'accent' : 'neutral';
                const rowBg = t.status === 'Done' ? '#fffbeb' : '#fff';
                return (
                  <tr key={t._id} style={{ background: rowBg }}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <StatusIcon status={status} />
                        <span>{t.title}</span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--color-primary)' }}>{t.projectName || '—'}</td>
                    <td>
                      <PillTag label={t.deliveryPhase || '—'} color={phaseColor} />
                    </td>
                    <td>
                      {t.assignee ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Avatar name={t.assignee.name} size={24} />
                          <span>{t.assignee.name}</span>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>—</td>
                    <td>
                      {t.dueDate
                        ? new Date(t.dueDate).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                          })
                        : '—'}
                    </td>
                  </tr>
                );
              }}
            />
          )}
          <div style={{ padding: '6px 16px', fontSize: 12, color: '#6b7280' }}>
            {rows.length} tasks
            {lastSyncedAt ? ` · synced ${new Date(lastSyncedAt).toLocaleTimeString()}` : ''}
          </div>
        </section>
      </div>
    </div>
  );
}
