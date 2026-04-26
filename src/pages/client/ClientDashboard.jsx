import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePeriodicRefresh } from '../../hooks/usePeriodicRefresh';
import { useAuth } from '../../context/AuthContext';
import { commentsAPI, modulesAPI, projectsAPI, workstreamsAPI } from '../../services/api';
import PageHeader from '../../components/PageHeader';
import StatusIcon from '../../components/StatusIcon';
import PillTag from '../../components/PillTag';
import DataTable from '../../components/DataTable';
import Button from '../../components/Button';
import ClientPortalEngagement from '../../components/ClientPortalEngagement';
import LoadingScreen from '../../components/LoadingScreen';

function formatDate(date, opts) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', opts || { day: '2-digit', month: 'short' });
}

export default function ClientDashboard() {
  const { user, logout } = useAuth();
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [modules, setModules] = useState([]);
  const [activeModule, setActiveModule] = useState(null);
  const [workstreams, setWorkstreams] = useState([]);
  const [activeTask, setActiveTask] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentCounts, setCommentCounts] = useState({});
  const [viewedCommentCounts, setViewedCommentCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [moduleLoading, setModuleLoading] = useState(false);
  const [workstreamLoading, setWorkstreamLoading] = useState(false);
  const [error, setError] = useState('');
  const [moduleError, setModuleError] = useState('');
  const [workstreamError, setWorkstreamError] = useState('');
  const commentInputRef = useRef(null);
  const workstreamRequestRef = useRef(0);

  const allTasks = useMemo(
    () => workstreams.flatMap((w) => (Array.isArray(w.tasks) ? w.tasks.map((t) => ({ ...t, workstream: w.name })) : [])),
    [workstreams]
  );

  const fetchCommentCountsForTasks = async (taskIds) => {
    const ids = Array.from(new Set(taskIds.filter(Boolean)));
    if (!ids.length) return;
    const counts = {};
    await Promise.all(
      ids.map(async (taskId) => {
        try {
          const { data } = await commentsAPI.getByTask(taskId);
          counts[taskId] = Array.isArray(data) ? data.length : 0;
        } catch {
          counts[taskId] = 0;
        }
      })
    );
    setCommentCounts((prev) => ({ ...prev, ...counts }));
  };

  const loadProjects = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      const { data } = await projectsAPI.getMy();
      const rows = Array.isArray(data) ? data : [];
      setProjects(rows);
      setActiveProject((prev) => {
        if (prev && rows.some((p) => String(p._id) === String(prev._id))) {
          return rows.find((p) => String(p._id) === String(prev._id)) || rows[0] || null;
        }
        return rows[0] || null;
      });
    } catch (e) {
      if (!silent) {
        setError(
          e.response?.status === 401 ? 'Session expired. Please sign in again.' : 'Failed to load projects'
        );
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects(false);
  }, [loadProjects]);

  usePeriodicRefresh(() => loadProjects(true), 25000);

  useEffect(() => {
    if (!activeProject?._id) return;
    setModuleLoading(true);
    setModuleError('');
    modulesAPI
      .getByProject(activeProject._id)
      .then(({ data }) => {
        const rows = Array.isArray(data) ? data : [];
        setModules(rows);
        setActiveModule(rows[0] || null);
      })
      .catch((e) => {
        setModules([]);
        setActiveModule(null);
        setWorkstreams([]);
        setModuleError(
          e.response?.status === 403
            ? 'You do not have access to this project modules.'
            : 'Could not load modules. Please retry.'
        );
      })
      .finally(() => setModuleLoading(false));
  }, [activeProject?._id]);

  const loadWorkstreamsForModule = useCallback(async (moduleId, { silent } = {}) => {
    const requestId = workstreamRequestRef.current + 1;
    workstreamRequestRef.current = requestId;
    if (!moduleId) {
      setWorkstreams([]);
      setWorkstreamError('');
      return;
    }
    if (!silent) {
      setWorkstreams([]);
      setActiveTask(null);
      setWorkstreamError('');
      setWorkstreamLoading(true);
    }
    try {
      const { data } = await workstreamsAPI.getByModule(moduleId);
      if (requestId !== workstreamRequestRef.current) return;
      const rows = Array.isArray(data) ? data : [];
      setWorkstreams(rows);
      setWorkstreamError('');
      await fetchCommentCountsForTasks(rows.flatMap((w) => (w.tasks || []).map((t) => t._id)));
    } catch (e) {
      if (requestId !== workstreamRequestRef.current) return;
      if (silent) return;
      setWorkstreams([]);
      setWorkstreamError(
        e.response?.status === 403
          ? 'You do not have access to workstreams for this module.'
          : 'Could not load tasks. Please retry.'
      );
    } finally {
      if (!silent && requestId === workstreamRequestRef.current) setWorkstreamLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!activeModule?._id) {
      setWorkstreams([]);
      setWorkstreamError('');
      return;
    }
    loadWorkstreamsForModule(activeModule._id, { silent: false });
  }, [activeModule?._id, loadWorkstreamsForModule]);

  usePeriodicRefresh(() => {
    if (activeModule?._id) loadWorkstreamsForModule(activeModule._id, { silent: true });
  }, 25000);

  const selectModule = (module) => {
    if (!module?._id || String(activeModule?._id) === String(module._id)) return;
    setActiveModule(module);
    setActiveTask(null);
    setComments([]);
    setWorkstreams([]);
    setWorkstreamError('');
  };

  useEffect(() => {
    if (!activeTask?._id) {
      setComments([]);
      return;
    }
    commentsAPI
      .getByTask(activeTask._id)
      .then(({ data }) => {
        const rows = Array.isArray(data) ? data : [];
        setComments(rows);
        const c = rows.length;
        setCommentCounts((prev) => ({ ...prev, [activeTask._id]: c }));
        setViewedCommentCounts((prev) => ({ ...prev, [activeTask._id]: c }));
      })
      .catch(() => setComments([]));
  }, [activeTask?._id]);

  useEffect(() => {
    if (!allTasks.length) return undefined;
    const timer = setInterval(() => {
      fetchCommentCountsForTasks(allTasks.map((t) => t._id));
    }, 7000);
    return () => clearInterval(timer);
  }, [allTasks]);

  const addComment = async (e) => {
    e?.preventDefault();
    if (!activeTask?._id || !commentText.trim()) return;
    setCommentLoading(true);
    try {
      await commentsAPI.add(activeTask._id, commentText.trim());
      setCommentText('');
      const { data } = await commentsAPI.getByTask(activeTask._id);
      const rows = Array.isArray(data) ? data : [];
      setComments(rows);
      setCommentCounts((prev) => ({ ...prev, [activeTask._id]: rows.length }));
      setViewedCommentCounts((prev) => ({ ...prev, [activeTask._id]: rows.length }));
      setTimeout(() => commentInputRef.current?.focus(), 50);
    } finally {
      setCommentLoading(false);
    }
  };

  if (loading) return <LoadingScreen title="Loading your projects" subtitle="Preparing client portal updates and tasks..." />;

  return (
    <div style={{ background: '#fff', minHeight: '100%', padding: 24 }}>
      <div style={{ maxWidth: 1300, margin: '0 auto' }}>
        <PageHeader
          title="Client portal"
          subtitle="Track rollout progress, view modules and collaborate with implementation team."
          actions={
            <>
              <span style={{ fontSize: 12, color: '#6b7280' }}>{user?.name}</span>
              <Button variant="ghost" onClick={logout}>Sign out</Button>
            </>
          }
        />

        {error ? (
          <div style={{ marginBottom: 12, border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', borderRadius: 8, padding: '10px 12px' }}>
            {error}
          </div>
        ) : null}

        {!projects.length ? (
          <div style={{ border: '1px dashed var(--border-default)', borderRadius: 8, padding: 24, color: '#6b7280', textAlign: 'center' }}>
            No projects assigned yet.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {projects.map((p) => (
                <button
                  key={p._id}
                  onClick={() => {
                    setActiveProject(p);
                    setActiveTask(null);
                  }}
                  style={{
                    borderRadius: 6,
                    border: activeProject?._id === p._id ? '1px solid #5B4ED4' : '1px solid var(--border-default)',
                    background: activeProject?._id === p._id ? '#EEE9FF' : '#fff',
                    color: activeProject?._id === p._id ? '#4f46e5' : '#374151',
                    fontSize: 12,
                    fontWeight: 500,
                    padding: '6px 10px',
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>

            {activeProject ? (
              <div style={{ border: '1px solid var(--border-default)', borderRadius: 8, marginBottom: 14, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 18, color: '#111827' }}>{activeProject.name}</h2>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>
                      Go-live: {formatDate(activeProject.goLiveDate, { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                  <PillTag
                    label={activeProject.status || 'Active'}
                    color={activeProject.status === 'Completed' ? 'success' : activeProject.status === 'Active' ? 'accent' : 'neutral'}
                  />
                </div>
                <div style={{ marginTop: 10, fontSize: 12, color: '#6b7280' }}>
                  Progress: <strong style={{ color: '#111827' }}>{activeProject.stats?.progress || 0}%</strong> · Tasks done:{' '}
                  <strong style={{ color: '#111827' }}>
                    {activeProject.stats?.completedTasks || 0}/{activeProject.stats?.totalTasks || 0}
                  </strong>
                </div>
                <div style={{ marginTop: 10, height: 8, borderRadius: 999, background: '#eef2ff', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${activeProject.stats?.progress || 0}%`, background: '#5B4ED4' }} />
                </div>
              </div>
            ) : null}

            {activeProject ? <ClientPortalEngagement projectId={activeProject._id} /> : null}

            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 14, marginTop: 14 }}>
              <aside style={{ border: '1px solid var(--border-default)', borderRadius: 8, overflow: 'hidden', height: 'fit-content' }}>
                <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', borderBottom: '1px solid var(--border-light)' }}>
                  <strong style={{ fontSize: 13 }}>Modules</strong>
                  <span style={{ color: '#9ca3af', fontSize: 12 }}>{modules.length}</span>
                </div>
                {moduleLoading ? <LoadingScreen fullHeight={false} compact title="Loading modules" subtitle="Fetching module progress..." /> : null}
                {moduleError ? <p style={{ margin: 0, padding: 12, color: '#b45309', fontSize: 12 }}>{moduleError}</p> : null}
                {!moduleLoading && !moduleError && modules.length === 0 ? (
                  <p style={{ margin: 0, padding: 12, color: '#9ca3af', fontSize: 12 }}>No modules configured yet.</p>
                ) : null}
                {modules.map((m) => (
                  <button
                    key={m._id}
                    onClick={() => selectModule(m)}
                    style={{
                      width: '100%',
                      height: 44,
                      border: 0,
                      borderTop: '1px solid var(--border-light)',
                      textAlign: 'left',
                      padding: '0 12px',
                      background: activeModule?._id === m._id ? '#f5f3ff' : '#fff',
                      fontSize: 12,
                      color: activeModule?._id === m._id ? '#4f46e5' : '#374151',
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{m.name}</span>
                    <span>{m.stats?.progress || 0}%</span>
                  </button>
                ))}
              </aside>

              <section>
                <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 15, color: '#111827' }}>
                      Tasks for {activeModule?.name || 'selected module'}
                    </h3>
                    <p style={{ margin: '3px 0 0', fontSize: 12, color: '#6b7280' }}>
                      {workstreamLoading ? 'Loading module tasks…' : `${allTasks.length} tasks loaded`}
                    </p>
                  </div>
                  {activeModule ? <PillTag label={`${activeModule.stats?.progress || 0}% complete`} color="neutral" /> : null}
                </div>
                {workstreamError ? (
                  <p style={{ margin: '0 0 10px', padding: '10px 12px', borderRadius: 8, border: '1px solid #fed7aa', background: '#fffbeb', color: '#b45309', fontSize: 12 }}>
                    {workstreamError}
                  </p>
                ) : null}
                <DataTable
                  columns={[
                    { key: 'task', label: 'TASK', width: '1fr' },
                    { key: 'workstream', label: 'WORKSTREAM', width: '190px' },
                    { key: 'due', label: 'DUE DATE', width: '120px' },
                    { key: 'status', label: 'STATUS', width: '130px' },
                    { key: 'comments', label: 'COMMENTS', width: '100px' },
                  ]}
                  rows={allTasks}
                  empty={workstreamLoading ? 'Loading tasks for selected module…' : 'No tasks for this module.'}
                  renderRow={(t) => {
                    const unread = Math.max((commentCounts[t._id] || 0) - (viewedCommentCounts[t._id] || 0), 0);
                    return (
                      <tr key={t._id} onClick={() => setActiveTask(t)} style={{ background: activeTask?._id === t._id ? '#faf5ff' : '#fff', cursor: 'pointer' }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <StatusIcon status={t.status === 'Done' ? 'done' : t.status === 'In Progress' ? 'inprogress' : 'todo'} />
                            <span style={{ fontSize: 13, color: t.status === 'Done' ? '#9ca3af' : '#111827', textDecoration: t.status === 'Done' ? 'line-through' : 'none' }}>
                              {t.title}
                            </span>
                          </div>
                        </td>
                        <td style={{ fontSize: 12, color: '#6b7280' }}>{t.workstream || '—'}</td>
                        <td style={{ fontSize: 12, color: '#6b7280' }}>{formatDate(t.dueDate)}</td>
                        <td><PillTag label={t.status || 'Not Started'} color={t.status === 'Done' ? 'success' : t.status === 'In Progress' ? 'caution' : 'neutral'} /></td>
                        <td style={{ fontSize: 12 }}>
                          {(commentCounts[t._id] || 0)}
                          {unread > 0 ? <span style={{ marginLeft: 6, color: '#4f46e5' }}>+{unread}</span> : null}
                        </td>
                      </tr>
                    );
                  }}
                />

                {activeTask ? (
                  <div style={{ marginTop: 12, border: '1px solid var(--border-default)', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ height: 44, padding: '0 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)' }}>
                      <strong style={{ fontSize: 13 }}>Comments · {activeTask.title}</strong>
                      <button onClick={() => setActiveTask(null)} style={{ border: 0, background: 'transparent', color: '#6b7280', cursor: 'pointer' }}>Close</button>
                    </div>
                    <div style={{ maxHeight: 280, overflowY: 'auto', padding: 12, display: 'grid', gap: 10 }}>
                      {comments.length === 0 ? <p style={{ margin: 0, color: '#9ca3af', fontSize: 12 }}>No comments yet.</p> : null}
                      {comments.map((c) => (
                        <div key={c._id} style={{ border: '1px solid var(--border-light)', borderRadius: 6, padding: 10 }}>
                          <div style={{ fontSize: 11, color: '#6b7280' }}>
                            {c.userId?.name || 'Unknown'} · {formatDate(c.createdAt, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#111827' }}>{c.text}</p>
                        </div>
                      ))}
                    </div>
                    <form onSubmit={addComment} style={{ borderTop: '1px solid var(--border-light)', padding: 10, display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                      <input
                        ref={commentInputRef}
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Add a comment"
                        style={{ border: '1px solid var(--border-default)', borderRadius: 6, fontSize: 13, padding: '8px 10px' }}
                      />
                      <Button type="submit" disabled={commentLoading || !commentText.trim()}>{commentLoading ? 'Sending...' : 'Send'}</Button>
                    </form>
                  </div>
                ) : null}
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
