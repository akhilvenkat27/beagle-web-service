import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePeriodicRefresh } from '../../hooks/usePeriodicRefresh';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { tasksAPI } from '../../services/api';
import SectionCard from '../../components/SectionCard';
import StatusIcon from '../../components/StatusIcon';
import LoadingScreen from '../../components/LoadingScreen';

function listFor(tasks, mode) {
  const now = Date.now();
  if (mode === 'incomplete') return tasks.filter((t) => t.status !== 'Done');
  if (mode === 'nextWeek')
    return tasks.filter((t) => {
      if (!t.dueDate || t.status === 'Done') return false;
      const delta = new Date(t.dueDate).getTime() - now;
      return delta > 0 && delta <= 7 * 86400000;
    });
  return tasks;
}

export default function MemberDashboard() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [personal, setPersonal] = useState(['Add a personal task', 'Add some personal task :)']);

  useEffect(() => {
    const key = `personalTasks:${user?._id || user?.email || 'member'}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setPersonal(arr);
      } catch {
        // ignore invalid cache
      }
    }
  }, [user?._id, user?.email]);

  const savePersonal = (next) => {
    setPersonal(next);
    const key = `personalTasks:${user?._id || user?.email || 'member'}`;
    localStorage.setItem(key, JSON.stringify(next));
  };

  const loadTasks = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setErr('');
    try {
      const { data } = await tasksAPI.getMyTasks();
      setTasks(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e.response?.data?.message || 'Failed to load tasks');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks(false);
  }, [loadTasks]);

  usePeriodicRefresh(() => loadTasks(true), 20000);

  const approvals = useMemo(() => listFor(tasks, 'incomplete').slice(0, 3), [tasks]);
  const assigned = useMemo(() => listFor(tasks, 'incomplete').slice(0, 8), [tasks]);
  const dueNext = useMemo(() => listFor(tasks, 'nextWeek').slice(0, 6), [tasks]);

  return (
    <div style={{ background: '#fff', minHeight: '100%', padding: 24 }}>
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: '#111827' }}>
              <span style={{ fontWeight: 400 }}>Good morning, </span>
              {user?.name || 'member'}
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
              View: Incomplete tasks · Group by: Default
            </p>
          </div>
          <Link to="/execution/all-tasks" style={{ background: '#111827', color: '#fff', borderRadius: 6, padding: '8px 16px', fontSize: 13, fontWeight: 500 }}>
            New task +
          </Link>
        </div>

        {err && (
          <div style={{ marginBottom: 12, border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', borderRadius: 8, padding: '10px 12px' }}>
            {err}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1.45fr 1fr', gap: 16 }}>
          <div style={{ display: 'grid', gap: 12 }}>
            <SectionCard title="Approvals" count={approvals.length}>
              {loading ? (
                <LoadingScreen fullHeight={false} compact title="Loading approvals" subtitle="Fetching your pending items..." />
              ) : approvals.length === 0 ? (
                <p style={{ margin: 0, padding: 16, color: '#9ca3af', fontSize: 13 }}>No approvals pending</p>
              ) : (
                approvals.map((t) => (
                  <div key={t._id} style={{ height: 44, borderBottom: '1px solid var(--border-light)', display: 'grid', gridTemplateColumns: '28px 1fr 1fr', alignItems: 'center', padding: '0 12px' }}>
                    <StatusIcon status={t.status === 'Done' ? 'done' : 'todo'} />
                    <span style={{ fontSize: 13, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</span>
                    <span style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {t.projectName || 'Project'} &gt; {t.moduleName || 'Module'}
                    </span>
                  </div>
                ))
              )}
            </SectionCard>

            <SectionCard title="Recently assigned" count={assigned.length}>
              {assigned.length === 0 ? (
                <p style={{ margin: 0, padding: 16, color: '#9ca3af', fontSize: 13 }}>No assigned tasks</p>
              ) : (
                assigned.map((t) => (
                  <div key={t._id} style={{ height: 44, borderBottom: '1px solid var(--border-light)', display: 'grid', gridTemplateColumns: '28px 1fr 1fr', alignItems: 'center', padding: '0 12px' }}>
                    <StatusIcon status={t.status === 'Done' ? 'done' : t.status === 'In Progress' ? 'inprogress' : 'todo'} />
                    <span style={{ fontSize: 13, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</span>
                    <span style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {t.projectName || 'Project'} &gt; {t.moduleName || 'Module'}
                    </span>
                  </div>
                ))
              )}
            </SectionCard>

            <SectionCard title="Due next week" count={dueNext.length}>
              {dueNext.length === 0 ? (
                <p style={{ margin: 0, padding: 16, color: '#9ca3af', fontSize: 13 }}>No tasks due in next week</p>
              ) : (
                dueNext.map((t) => (
                  <div key={t._id} style={{ height: 44, borderBottom: '1px solid var(--border-light)', display: 'grid', gridTemplateColumns: '28px 1fr 1fr', alignItems: 'center', padding: '0 12px' }}>
                    <StatusIcon status={t.status === 'Done' ? 'done' : 'todo'} />
                    <span style={{ fontSize: 13, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</span>
                    <span style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {t.dueDate ? new Date(t.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'}
                    </span>
                  </div>
                ))
              )}
            </SectionCard>
          </div>

          <div style={{ border: '1px solid var(--border-default)', borderRadius: 8, background: '#fff', padding: 16, height: 'fit-content' }}>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#111827' }}>Personal tasks</h2>
            <ul style={{ margin: '10px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
              {personal.map((p, idx) => (
                <li key={`${p}-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    style={{ width: 14, height: 14, accentColor: 'var(--checkbox-checked)' }}
                  />
                  <span style={{ fontSize: 13, color: '#374151' }}>{p}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => {
                const val = window.prompt('Add personal task');
                if (!val || !val.trim()) return;
                savePersonal([...personal, val.trim()]);
              }}
              style={{ marginTop: 10, border: 0, background: 'none', color: 'var(--color-primary)', fontSize: 13, cursor: 'pointer' }}
            >
              + Add a personal task
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
