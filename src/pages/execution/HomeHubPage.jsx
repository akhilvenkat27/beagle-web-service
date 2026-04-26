import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePeriodicRefresh } from '../../hooks/usePeriodicRefresh';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { crAPI, executionAPI, intakeAPI, projectsAPI } from '../../services/api';
import Avatar from '../../components/Avatar';
import StatusIcon from '../../components/StatusIcon';
import LoadingScreen from '../../components/LoadingScreen';

const DEFAULT_CHECKLIST = [
  { id: 'margin-narrative', label: 'Review margin narrative with DH', done: false },
  { id: 'darwinbox-sync', label: 'Confirm Darwinbox tag sync on activation', done: false },
];

export default function HomeHubPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [pendingCr, setPendingCr] = useState([]);
  const [pendingHubspot, setPendingHubspot] = useState([]);
  const [hubspotBusyId, setHubspotBusyId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checklist, setChecklist] = useState(DEFAULT_CHECKLIST);

  const loadHub = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [{ data: proj }, { data: ex }, hubspotRes] = await Promise.all([
          projectsAPI.getAll(),
          executionAPI.allTasks({}).catch(() => ({ data: { tasks: [] } })),
          user?.role === 'admin'
            ? intakeAPI.getPendingDeals().catch(() => ({ data: [] }))
            : Promise.resolve({ data: [] }),
        ]);
        setProjects(Array.isArray(proj) ? proj : []);
        setTasks(Array.isArray(ex?.tasks) ? ex.tasks : []);
        setPendingHubspot(Array.isArray(hubspotRes?.data) ? hubspotRes.data : []);

        const first = (Array.isArray(proj) ? proj : [])[0];
        if (first?._id && ['admin', 'pmo', 'dh', 'pm', 'exec', 'member'].includes(user?.role)) {
          const { data: crs } = await crAPI.list(first._id).catch(() => ({ data: [] }));
          setPendingCr((Array.isArray(crs) ? crs : []).filter((c) => c.status === 'Pending Approval'));
        } else {
          setPendingCr([]);
        }
      } catch {
        if (!silent) {
          setProjects([]);
          setTasks([]);
          setPendingHubspot([]);
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [user?.role]
  );

  useEffect(() => {
    loadHub(false);
  }, [loadHub]);

  usePeriodicRefresh(() => loadHub(true), 20000);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const now = Date.now();
  const weekMs = 7 * 86400000;
  const recent = tasks.filter((t) => t.status !== 'Done').slice(0, 8);
  const dueSoon = tasks.filter(
    (t) => t.status !== 'Done' && t.dueDate && new Date(t.dueDate).getTime() - now < weekMs && new Date(t.dueDate).getTime() >= now
  );
  const approvals = pendingCr.slice(0, 3);

  const firstProjectId = projects[0]?._id;
  const canOpenProjects = ['admin', 'pmo', 'dh', 'pm', 'exec'].includes(user?.role);
  const canOpenProjectDetail = canOpenProjects;
  const taskLinkFor = (task) => (canOpenProjectDetail && task?.projectId ? `/projects/${task.projectId}` : '/execution/all-tasks');

  const openHubspotIntake = (deal) => {
    navigate('/projects/create', {
      state: {
        hubspotPrefill: {
          name: `${deal.clientName} implementation`,
          clientName: deal.clientName,
          goLiveDate: deal.goLiveDate?.slice(0, 10) || '',
          contractValue: String(deal.contractValue ?? ''),
          notionalARR: String(deal.notionalARR ?? ''),
          hubspotDealId: deal.dealId,
          scopedModules: deal.scopedModules || [],
          implementationScope: deal.implementationScope || '',
          accountOwner: deal.accountOwner || '',
        },
      },
    });
  };

  const rejectHubspotDeal = async (deal) => {
    if (!window.confirm(`Reject HubSpot deal ${deal.dealId}?`)) return;
    setHubspotBusyId(deal.dealId);
    try {
      await intakeAPI.rejectPendingDeal(deal.dealId);
      await loadHub(true);
    } catch (e) {
      window.alert(e?.response?.data?.message || 'Could not reject HubSpot deal');
    } finally {
      setHubspotBusyId(null);
    }
  };

  useEffect(() => {
    const userKey = user?._id || user?.email;
    if (!userKey) return;
    try {
      const raw = localStorage.getItem(`homeChecklist:${userKey}`);
      if (!raw) {
        setChecklist(DEFAULT_CHECKLIST);
        return;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        setChecklist(DEFAULT_CHECKLIST);
        return;
      }
      const merged = DEFAULT_CHECKLIST.map((seed) => {
        const hit = parsed.find((x) => x.id === seed.id);
        return hit ? { ...seed, done: !!hit.done } : seed;
      });
      setChecklist(merged);
    } catch {
      setChecklist(DEFAULT_CHECKLIST);
    }
  }, [user?._id, user?.email]);

  useEffect(() => {
    const userKey = user?._id || user?.email;
    if (!userKey) return;
    localStorage.setItem(`homeChecklist:${userKey}`, JSON.stringify(checklist));
  }, [checklist, user?._id, user?.email]);

  const toggleChecklist = (id) => {
    setChecklist((prev) => prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item)));
  };

  const SunGlyph = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="4.2" stroke="#111827" strokeWidth="1.7" />
      <path d="M12 2.7v3M12 18.3v3M2.7 12h3M18.3 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M18.5 5.5l-2.1 2.1M7.6 16.4l-2.1 2.1" stroke="#111827" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );

  if (loading) return <LoadingScreen title="Loading your home hub" subtitle="Preparing approvals, tasks, and personal checklist..." />;

  return (
    <div style={{ background: '#ffffff', minHeight: '100%', padding: 16 }}>
      <div style={{ maxWidth: 1360, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottom: '1px solid #eceff3', paddingBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SunGlyph />
            <h1 style={{ margin: 0, fontSize: 31, fontWeight: 400, color: '#111827', letterSpacing: '-0.01em' }}>
              {greeting}, <span style={{ fontWeight: 600 }}>{user?.name || 'there'}!</span>
            </h1>
          </div>
          <Link
            to="/execution/all-tasks"
            style={{
              borderRadius: 8,
              background: '#000000',
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              padding: '6px 12px',
            }}
          >
            {user?.role === 'member' ? 'View all tasks →' : 'New task +'}
          </Link>
        </div>

        <div style={{ marginTop: 10, display: 'flex', gap: 14, fontSize: 13, color: '#4b5563' }}>
          <span>
            View: <strong style={{ color: '#111827' }}>Incomplete tasks</strong>
          </span>
          <span>
            Group by: <strong style={{ color: '#111827' }}>Default</strong>
          </span>
        </div>

        <div style={{ marginTop: 12, display: 'grid', gap: 14, gridTemplateColumns: '1.45fr 1fr', alignItems: 'start' }}>
          <div style={{ display: 'grid', gap: 12 }}>
            {user?.role === 'admin' && (
              <section style={{ border: '1px solid #fed7aa', borderRadius: 4, background: '#fff7ed', overflow: 'hidden' }}>
                <header style={{ height: 38, borderBottom: '1px solid #ffedd5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px' }}>
                  <strong style={{ fontSize: 13, color: '#9a3412' }}>Pending HubSpot projects</strong>
                  <Link to="/admin/intake" style={{ fontSize: 11, color: '#c2410c', fontWeight: 700 }}>
                    View all
                  </Link>
                </header>
                <div style={{ padding: '4px 0' }}>
                  {pendingHubspot.length === 0 ? (
                    <p style={{ margin: 0, padding: '14px 12px', color: '#9ca3af', fontSize: 12 }}>
                      No pending HubSpot deals.
                    </p>
                  ) : (
                    pendingHubspot.slice(0, 5).map((deal) => (
                      <div
                        key={deal.dealId}
                        style={{
                          minHeight: 54,
                          padding: '8px 12px',
                          display: 'grid',
                          gridTemplateColumns: '1fr auto',
                          gap: 10,
                          alignItems: 'center',
                          borderBottom: '1px solid #ffedd5',
                          background: '#fff',
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {deal.clientName}
                          </p>
                          <p style={{ margin: '2px 0 0', fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {deal.dealId} · Contract {Number(deal.contractValue || 0).toLocaleString()} · ARR {Number(deal.notionalARR || 0).toLocaleString()}
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => openHubspotIntake(deal)}
                            style={{ border: 0, borderRadius: 6, background: '#111827', color: '#fff', padding: '6px 9px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                          >
                            Intake
                          </button>
                          <button
                            type="button"
                            disabled={hubspotBusyId === deal.dealId}
                            onClick={() => rejectHubspotDeal(deal)}
                            style={{ border: '1px solid #fecaca', borderRadius: 6, background: '#fff', color: '#b91c1c', padding: '6px 9px', fontSize: 11, fontWeight: 700, cursor: 'pointer', opacity: hubspotBusyId === deal.dealId ? 0.6 : 1 }}
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            )}

            <section style={{ border: '1px solid #edf0f4', borderRadius: 4, background: '#fff', overflow: 'hidden' }}>
              <header style={{ height: 38, borderBottom: '1px solid #f1f3f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px' }}>
                <strong style={{ fontSize: 13 }}>Approvals</strong>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>▾</span>
              </header>
              <div style={{ padding: '4px 0' }}>
                {approvals.length === 0 ? (
                  <p style={{ margin: 0, padding: '14px 12px', color: '#9ca3af', fontSize: 12 }}>No pending approvals.</p>
                ) : (
                  approvals.map((c) => (
                    <div key={c._id} style={{ minHeight: 44, padding: '7px 12px', display: 'grid', gridTemplateColumns: '24px 1fr auto', alignItems: 'center', gap: 8, borderBottom: '1px solid #f3f4f7', background: '#fffde9' }}>
                      <Avatar name={c.requestedByName || 'A'} size={20} />
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title}</p>
                        <p style={{ margin: 0, fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {c.moduleName || 'Module'} &gt; {c.workstreamName || 'Review'}
                        </p>
                      </div>
                      {firstProjectId ? (
                        <Link to={`/governance/change-requests/${firstProjectId}`} style={{ fontSize: 11, color: 'var(--color-primary)', fontWeight: 600 }}>
                          Open
                        </Link>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </section>

            <section style={{ border: '1px solid #edf0f4', borderRadius: 4, background: '#fff', overflow: 'hidden' }}>
              <header style={{ height: 38, borderBottom: '1px solid #f1f3f6', display: 'flex', alignItems: 'space-between', justifyContent: 'space-between', padding: '0 12px' }}>
                <strong style={{ fontSize: 13 }}>Recently assigned</strong>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>▾</span>
              </header>
              <div style={{ maxHeight: 172, overflowY: 'auto' }}>
                {recent.length === 0 ? (
                  <p style={{ margin: 0, padding: '14px 12px', color: '#9ca3af', fontSize: 12 }}>No assigned tasks.</p>
                ) : (
                  recent.map((t) => (
                    <Link
                      key={t._id}
                      to={taskLinkFor(t)}
                      style={{
                        height: 42,
                        display: 'grid',
                        gridTemplateColumns: '18px 1fr auto',
                        alignItems: 'center',
                        gap: 8,
                        padding: '0 12px',
                        borderBottom: '1px solid #f3f4f7',
                        cursor: 'pointer',
                      }}
                    >
                      <StatusIcon status={t.status === 'Done' ? 'done' : t.status === 'In Progress' ? 'inprogress' : 'todo'} />
                      <span style={{ fontSize: 13, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {t.title}
                      </span>
                      <span style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap', maxWidth: 210, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {t.projectName || 'Project'} &gt; {t.moduleName || 'Module'}
                      </span>
                    </Link>
                  ))
                )}
              </div>
              <footer style={{ height: 28, borderTop: '1px solid #f1f3f6', padding: '0 12px', display: 'flex', alignItems: 'center', fontSize: 11, color: '#9ca3af' }}>
                {recent.length} tasks
              </footer>
            </section>

            <section style={{ border: '1px solid #edf0f4', borderRadius: 4, background: '#fff', overflow: 'hidden' }}>
              <header style={{ height: 38, borderBottom: '1px solid #f1f3f6', display: 'flex', alignItems: 'space-between', justifyContent: 'space-between', padding: '0 12px' }}>
                <strong style={{ fontSize: 13 }}>Due next week</strong>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>▾</span>
              </header>
              <div style={{ maxHeight: 156, overflowY: 'auto' }}>
                {dueSoon.length === 0 ? (
                  <p style={{ margin: 0, padding: '14px 12px', color: '#9ca3af', fontSize: 12 }}>No tasks due next week.</p>
                ) : (
                  dueSoon.slice(0, 8).map((t) => (
                    <Link
                      key={t._id}
                      to={taskLinkFor(t)}
                      style={{
                        height: 42,
                        display: 'grid',
                        gridTemplateColumns: '18px 1fr auto',
                        alignItems: 'center',
                        gap: 8,
                        padding: '0 12px',
                        borderBottom: '1px solid #f3f4f7',
                        cursor: 'pointer',
                      }}
                    >
                      <StatusIcon status={t.status === 'Done' ? 'done' : t.status === 'In Progress' ? 'inprogress' : 'todo'} />
                      <span style={{ fontSize: 13, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</span>
                      <span style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap', maxWidth: 210, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {t.projectName || 'Project'} &gt; {t.moduleName || 'Module'}
                      </span>
                    </Link>
                  ))
                )}
              </div>
              <footer style={{ height: 28, borderTop: '1px solid #f1f3f6', padding: '0 12px', display: 'flex', alignItems: 'center', fontSize: 11, color: '#9ca3af' }}>
                {dueSoon.length} tasks
              </footer>
            </section>
          </div>

          <aside style={{ border: '1px solid #edf0f4', borderRadius: 4, background: '#fff', padding: 12 }}>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#111827', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: '#d946ef', fontSize: 12 }}>◫</span>
              Personal tasks
            </h2>
            <ul style={{ margin: '10px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
              {checklist.map((item) => (
                <li key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() => toggleChecklist(item.id)}
                    style={{ width: 14, height: 14, accentColor: 'var(--checkbox-checked)' }}
                  />
                  <span style={{ fontSize: 13, color: item.done ? '#9ca3af' : '#374151', textDecoration: item.done ? 'line-through' : 'none' }}>
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </div>
    </div>
  );
}
