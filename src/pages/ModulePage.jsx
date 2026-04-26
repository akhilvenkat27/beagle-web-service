import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { projectsAPI, modulesAPI, workstreamsAPI, tasksAPI, aiAPI, usersAPI, financialAPI } from '../services/api';
import Modal from '../components/Modal';

const WS_PRESETS = ['Configuration', 'Data Migration', 'UAT', 'Training', 'Integration'];

const EMPTY_TASK = {
  title: '',
  owner: '',
  dueDate: '',
  status: 'Not Started',
  billable: true,
};

const MODULE_STATUSES = ['Not Started', 'In Progress', 'Completed'];

function dayVarianceDays(planned, actual) {
  if (!planned || !actual) return null;
  const p = new Date(planned).setHours(0, 0, 0, 0);
  const a = new Date(actual).setHours(0, 0, 0, 0);
  return Math.round((a - p) / 86400000);
}

function fmtShort(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function signalMatrixRefresh(projectId) {
  try {
    window.dispatchEvent(
      new CustomEvent('beagle-matrix-refresh', { detail: { projectId: String(projectId) } })
    );
  } catch {
    // ignore
  }
}

export default function ModulePage() {
  const { projectId, moduleId } = useParams();
  const { user } = useAuth();

  const [project, setProject] = useState(null);
  const [module, setModule] = useState(null);
  const [workstreams, setWorkstreams] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Workstream modal
  const [showWsModal, setShowWsModal] = useState(false);
  const [wsName, setWsName] = useState('');
  const [wsCustom, setWsCustom] = useState(false);

  // Task modal
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [activeWsId, setActiveWsId] = useState(null);
  const [parentTaskForModal, setParentTaskForModal] = useState(null);
  const [taskForm, setTaskForm] = useState(EMPTY_TASK);
  const [taskSaving, setTaskSaving] = useState(false);

  // Log hours modal
  const [showLogModal, setShowLogModal] = useState(false);
  const [logTask, setLogTask] = useState(null);
  const [hoursInput, setHoursInput] = useState('');

  // Task flags state
  const [taskFlags, setTaskFlags] = useState({});
  const [loadingFlags, setLoadingFlags] = useState(false);

  const [allModules, setAllModules] = useState([]);
  const [depStatus, setDepStatus] = useState(null);
  const [depSelection, setDepSelection] = useState([]);
  const [staff, setStaff] = useState([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState(() => new Set());
  const [bulkAssignUser, setBulkAssignUser] = useState('');
  const [bulkStatus, setBulkStatus] = useState('In Progress');
  const [bulkShift, setBulkShift] = useState('0');
  const [wsDateDrafts, setWsDateDrafts] = useState({});
  const [projectFinancial, setProjectFinancial] = useState(null);
  const [dataTick, setDataTick] = useState(0);

  const userLeadsProjectAsPm =
    user?.role === 'pm' &&
    project &&
    String(project.projectManagerId?._id || project.projectManagerId || '') === String(user?._id || '');
  const canLoadProjectFinancial =
    user?.role === 'admin' || user?.role === 'dh' || userLeadsProjectAsPm;

  const finMod = useMemo(() => {
    if (!projectFinancial?.byModule || !moduleId) return null;
    return projectFinancial.byModule.find((m) => String(m.moduleId) === String(moduleId));
  }, [projectFinancial, moduleId]);

  const fetchAll = useCallback(async () => {
    // BUG 5 FIX: Guard against undefined params before firing API calls
    if (!projectId || !moduleId || moduleId === 'undefined' || projectId === 'undefined') {
      console.error('ModulePage: projectId or moduleId is missing — skipping fetch', { projectId, moduleId });
      setLoading(false);
      return;
    }
    try {
      const [projRes, wsRes, modListRes, membersRes] = await Promise.all([
        projectsAPI.getById(projectId),
        workstreamsAPI.getByModule(moduleId),
        modulesAPI.getByProject(projectId),
        user?.role === 'admin' ? usersAPI.getAll() : Promise.resolve({ data: [] }),
      ]);
      setProject(projRes.data);
      setWorkstreams(wsRes.data);
      const modArr = Array.isArray(modListRes.data) ? modListRes.data : [];
      setAllModules(modArr);
      const found = modArr.find((m) => m._id === moduleId);
      setModule(found || null);

      if (membersRes.data && user?.role === 'admin') {
        const userList = Array.isArray(membersRes.data)
          ? membersRes.data
          : membersRes.data.users || [];
        setMembers(userList.filter((u) => u.role === 'member'));
        setStaff(userList.filter((u) => ['admin', 'member', 'dh'].includes(u.role)));
      } else {
        setStaff([]);
      }

      if (user?.role === 'admin' && moduleId) {
        try {
          const ds = await modulesAPI.getDependencyStatus(moduleId);
          setDepStatus(ds.data);
          const cur = modArr.find((m) => m._id === moduleId);
          const ids = (cur?.dependsOn || []).map((d) => (typeof d === 'object' ? d._id : d)).filter(Boolean);
          setDepSelection(ids.map(String));
        } catch {
          setDepStatus(null);
        }
      } else {
        setDepStatus(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setDataTick((t) => t + 1);
    }
  }, [projectId, moduleId, user?.role]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!projectId || !canLoadProjectFinancial) {
      setProjectFinancial(null);
      return;
    }
    financialAPI
      .getProject(projectId)
      .then(({ data }) => setProjectFinancial(data))
      .catch(() => setProjectFinancial(null));
  }, [projectId, user?.role, dataTick, canLoadProjectFinancial]);

  useEffect(() => {
    const d = {};
    (workstreams || []).forEach((ws) => {
      d[ws._id] = {
        baselinePlannedStartDate: ws.baselinePlannedStartDate
          ? String(ws.baselinePlannedStartDate).slice(0, 10)
          : '',
        baselinePlannedEndDate: ws.baselinePlannedEndDate
          ? String(ws.baselinePlannedEndDate).slice(0, 10)
          : '',
        actualStartDate: ws.actualStartDate ? String(ws.actualStartDate).slice(0, 10) : '',
        actualEndDate: ws.actualEndDate ? String(ws.actualEndDate).slice(0, 10) : '',
        leadId: ws.leadId?._id || ws.leadId || '',
        budgetHours: ws.budgetHours ?? '',
        costRate: ws.costRate ?? '',
      };
    });
    setWsDateDrafts(d);
  }, [workstreams]);

  // --- Workstream handlers ---
  const handleAddWorkstream = async (e) => {
    e.preventDefault();
    const name = wsCustom ? wsName : wsName;
    if (!name.trim()) return;
    const leadId = project?.projectManagerId?._id || project?.projectManagerId;
    if (!leadId) {
      alert('Project must have a PM to assign as workstream lead.');
      return;
    }
    await workstreamsAPI.create({ name: name.trim(), moduleId, leadId });
    setShowWsModal(false);
    setWsName('');
    setWsCustom(false);
    fetchAll();
  };

  const handleDeleteWorkstream = async (wsId) => {
    if (!window.confirm('Delete this workstream and all its tasks?')) return;
    await workstreamsAPI.delete(wsId);
    fetchAll();
  };

  // --- Task handlers ---
  const canCreateTask =
    user && (user.role === 'admin' || user.role === 'dh' || user.role === 'pm');
  /** Backend POST /api/workstreams requires admin or dh — keep UI in sync. */
  const canCreateWorkstream = user && (user.role === 'admin' || user.role === 'dh');
  const canDeleteWorkstream = user && (user.role === 'admin' || user.role === 'dh');

  const openAddTask = (wsId) => {
    if (module?.isBlocked) {
      alert('This module is blocked until all dependency modules are Completed.');
      return;
    }
    setActiveWsId(wsId);
    setParentTaskForModal(null);
    setTaskForm(EMPTY_TASK);
    setShowTaskModal(true);
  };

  const openAddSubtask = (wsId, parentTask) => {
    if (!canCreateTask) return;
    if (module?.isBlocked) {
      alert('This module is blocked until all dependency modules are Completed.');
      return;
    }
    setActiveWsId(wsId);
    setParentTaskForModal(parentTask);
    setTaskForm({ ...EMPTY_TASK, title: '' });
    setShowTaskModal(true);
  };

  const saveDependencies = async () => {
    try {
      await modulesAPI.setDependencies(moduleId, depSelection);
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save dependencies');
    }
  };

  const toggleDepModule = (mid) => {
    const id = String(mid);
    setDepSelection((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const savePeerModuleStatus = async (peerId, status) => {
    try {
      await modulesAPI.update(peerId, { status });
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update module status');
    }
  };

  const saveWorkstreamMeta = async (wsId, patch) => {
    try {
      await workstreamsAPI.update(wsId, patch);
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save workstream');
    }
  };

  const handleRequestSignOff = async (wsId) => {
    try {
      await workstreamsAPI.requestSignOff(wsId, '');
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Request failed');
    }
  };

  const handleCompleteSignOff = async (wsId) => {
    try {
      await workstreamsAPI.completeSignOff(wsId, '');
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Sign-off failed');
    }
  };

  const toggleTaskSelect = (taskId) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const runBulk = async (operation, value) => {
    const ids = [...selectedTaskIds];
    if (!ids.length) {
      alert('Select at least one task');
      return;
    }
    try {
      await tasksAPI.bulkPatch({ taskIds: ids, operation, value });
      setSelectedTaskIds(new Set());
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Bulk update failed');
    }
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    setTaskSaving(true);
    try {
      const body = {
        title: taskForm.title,
        owner: taskForm.owner,
        dueDate: taskForm.dueDate,
        status: taskForm.status,
        workstreamId: activeWsId,
        billable: taskForm.billable !== false,
      };
      if (parentTaskForModal?._id) {
        body.parentTaskId = parentTaskForModal._id;
      }
      await tasksAPI.create(body);
      setShowTaskModal(false);
      setParentTaskForModal(null);
      fetchAll();
      signalMatrixRefresh(projectId);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create task');
    } finally {
      setTaskSaving(false);
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    await tasksAPI.update(taskId, { status: newStatus });
    // Optimistic update
    setWorkstreams((prev) =>
      prev.map((ws) => ({
        ...ws,
        tasks: ws.tasks.map((t) => (t._id === taskId ? { ...t, status: newStatus } : t)),
      }))
    );
    fetchAll(); // re-fetch for stats
    signalMatrixRefresh(projectId);
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Delete this task?')) return;
    await tasksAPI.delete(taskId);
    fetchAll();
    signalMatrixRefresh(projectId);
  };

  const handleAssignTask = async (taskId, memberId) => {
    try {
      await tasksAPI.update(taskId, {
        assignedTo: memberId || null
      });
      fetchAll();
    } catch (err) {
      console.error('Assign failed:', err.response?.data || err.message);
      alert('Failed to assign task');
    }
  };

  const handleBillableChange = async (taskId, billable) => {
    try {
      await tasksAPI.update(taskId, { billable });
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update billable flag');
    }
  };

  const openLogHours = (task) => {
    setLogTask(task);
    setHoursInput('');
    setShowLogModal(true);
  };

  const handleLogHours = async (e) => {
    e.preventDefault();
    const hrs = parseFloat(hoursInput);
    if (isNaN(hrs) || hrs <= 0) return;
    await tasksAPI.logHours(logTask._id, hrs);
    setShowLogModal(false);
    fetchAll();
  };

  // Load task flags from AI
  const handleLoadTaskFlags = async () => {
    setLoadingFlags(true);
    try {
      const res = await aiAPI.getTaskFlags(moduleId);
      if (res.data.flags) {
        const flagMap = {};
        res.data.flags.forEach((flag) => {
          flagMap[flag.taskId] = flag;
        });
        setTaskFlags(flagMap);
      }
    } catch (err) {
      console.error('Failed to load task flags:', err);
    } finally {
      setLoadingFlags(false);
    }
  };

  // --- Helpers ---
  const isOverdue = (task) =>
    task.status !== 'Done' && new Date(task.dueDate) < new Date();

  const statusColor = (status) => {
    if (status === 'Done') return 'text-success-600 bg-success-50 border-success-200';
    if (status === 'In Progress') return 'text-caution-700 bg-caution-50 border-caution-200';
    return 'text-ink-500 bg-ink-50 border-ink-200';
  };

  const pmId = project?.projectManagerId?._id || project?.projectManagerId;
  const iAmPm =
    user && (user.role === 'admin' || (pmId && String(pmId) === String(user._id)));
  const isWsLead = (ws) => {
    const lid = ws.leadId?._id || ws.leadId;
    return user && lid && String(lid) === String(user._id);
  };
  const canRequestSignOff = (ws) =>
    user && (user.role === 'admin' || user.role === 'dh' || isWsLead(ws));

  if (loading) return <div className="p-6 text-sm text-ink-400">Loading...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto pb-28">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-ink-400 mb-5">
        <Link to="/projects" className="hover:text-link-500 transition-colors">Projects</Link>
        <span>/</span>
        <Link to={`/projects/${projectId}`} className="hover:text-link-500 transition-colors truncate max-w-xs">
          {project?.name}
        </Link>
        <span>/</span>
        <span className="text-ink-700 font-medium">{module?.name}</span>
      </nav>

      {/* Module header */}
      <div className="bg-paper border border-ink-200 rounded-lg p-5 mb-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-ink-900">{module?.name}</h1>
            <p className="text-sm text-ink-400 mt-0.5">{project?.clientName}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleLoadTaskFlags}
              disabled={loadingFlags}
              className="text-sm bg-accent-100 hover:bg-accent-200 text-accent-700 font-medium px-3 py-1.5 rounded-md transition-colors disabled:opacity-50"
            >
              {loadingFlags ? 'Scanning...' : '🚩 Flag At-Risk Tasks'}
            </button>
            {canCreateWorkstream ? (
              <button
                onClick={() => { setWsName(''); setWsCustom(false); setShowWsModal(true); }}
                className="text-sm bg-link-600 hover:bg-link-700 text-paper font-medium px-3 py-1.5 rounded-md transition-colors"
              >
                + Add Workstream
              </button>
            ) : null}
          </div>
        </div>

        {/* Module stats */}
        {module && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-ink-100 text-sm">
            <div>
              <p className="text-xs text-ink-400">Budget</p>
              <p className="font-semibold text-ink-800 mt-0.5">{module.budgetHours}h</p>
            </div>
            <div>
              <p className="text-xs text-ink-400">Logged</p>
              <p className="font-semibold text-ink-800 mt-0.5">{module.stats.loggedHours}h</p>
            </div>
            <div>
              <p className="text-xs text-ink-400">Remaining</p>
              <p className={`font-semibold mt-0.5 ${module.stats.remainingHours === 0 && module.budgetHours > 0 ? 'text-risk-500' : 'text-ink-800'}`}>
                {module.stats.remainingHours}h
              </p>
            </div>
            <div>
              <p className="text-xs text-ink-400">Progress</p>
              <p className="font-semibold text-ink-800 mt-0.5">{module.stats.progress}%</p>
            </div>
          </div>
        )}
      </div>

      {module?.isBlocked && (depStatus?.blockingModules?.length > 0 || module.blockingModules?.length > 0) && (
        <div className="mb-4 rounded-lg border border-risk-200 bg-risk-50 px-4 py-3 text-sm text-risk-800">
          <strong>⚠ Blocked</strong> — waiting for:{' '}
          {(depStatus?.blockingModules || module.blockingModules || [])
            .map((b) => `${b.name} (${b.progress ?? 0}% complete)`)
            .join(', ')}
        </div>
      )}

      {user?.role === 'admin' && (
        <div className="bg-paper border border-ink-200 rounded-lg p-5 mb-6">
          <h2 className="text-sm font-semibold text-ink-800 mb-3">Dependencies</h2>
          <p className="text-xs text-ink-500 mb-3">
            Tasks cannot be created in this module until every selected upstream module is marked{' '}
            <strong>Completed</strong>.
          </p>
          <div className="space-y-2 max-h-48 overflow-y-auto mb-3">
            {allModules
              .filter((m) => m._id !== moduleId)
              .map((m) => (
                <label key={m._id} className="flex items-center gap-2 text-sm text-ink-700">
                  <input
                    type="checkbox"
                    checked={depSelection.includes(String(m._id))}
                    onChange={() => toggleDepModule(m._id)}
                  />
                  <span className="flex-1">{m.name}</span>
                  <select
                    value={m.status || 'Not Started'}
                    onChange={(e) => savePeerModuleStatus(m._id, e.target.value)}
                    className="text-xs border border-ink-200 rounded px-2 py-1"
                  >
                    {MODULE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
          </div>
          <button
            type="button"
            onClick={saveDependencies}
            className="text-sm bg-link-600 hover:bg-link-700 text-paper font-medium px-3 py-1.5 rounded-md"
          >
            Save dependency links
          </button>
        </div>
      )}

      {/* Workstreams */}
      {workstreams.length === 0 ? (
        <div className="border border-dashed border-ink-300 rounded-lg p-12 text-center text-ink-400 text-sm">
          No workstreams yet. Add one to start tracking tasks.
        </div>
      ) : (
        <div className="space-y-4">
          {workstreams.map((ws) => {
            const overdueCount = ws.tasks.filter(isOverdue).length;
            const doneCount = ws.tasks.filter((t) => t.status === 'Done').length;

            const draft = wsDateDrafts[ws._id] || {};
            const finWs = finMod?.byWorkstream?.find((b) => String(b.workstreamId) === String(ws._id));
            const vStart = dayVarianceDays(
              draft.baselinePlannedStartDate || ws.baselinePlannedStartDate,
              draft.actualStartDate || ws.actualStartDate
            );
            const vEnd = dayVarianceDays(
              draft.baselinePlannedEndDate || ws.baselinePlannedEndDate,
              draft.actualEndDate || ws.actualEndDate
            );

            return (
              <div key={ws._id} className="bg-paper border border-ink-200 rounded-lg overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-ink-50 border-b border-ink-200">
                  <div className="flex flex-wrap items-center gap-3 min-w-0">
                    <h3 className="font-semibold text-sm text-ink-800 shrink-0">{ws.name}</h3>
                    <span className="text-xs text-ink-500 shrink-0">Lead</span>
                    {user?.role === 'admin' ? (
                      <select
                        className="text-xs border border-ink-300 rounded px-2 py-1 max-w-[10rem]"
                        value={draft.leadId || ''}
                        onChange={(e) =>
                          setWsDateDrafts((prev) => ({
                            ...prev,
                            [ws._id]: { ...draft, leadId: e.target.value },
                          }))
                        }
                      >
                        <option value="">—</option>
                        {staff.map((u) => (
                          <option key={u._id} value={u._id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-ink-700 truncate max-w-[8rem]">
                        {ws.leadId?.name || '—'}
                      </span>
                    )}
                    {user?.role === 'admin' && (
                      <button
                        type="button"
                        onClick={() =>
                          saveWorkstreamMeta(ws._id, {
                            leadId: draft.leadId || null,
                          })
                        }
                        className="text-xs text-link-600 hover:underline"
                      >
                        Save lead
                      </button>
                    )}
                    <span className="text-xs text-ink-400">
                      {doneCount}/{ws.tasks.length} done
                    </span>
                    {overdueCount > 0 && (
                      <span className="text-xs font-medium bg-risk-100 text-risk-600 px-2 py-0.5 rounded-full">
                        ⚠ {overdueCount} overdue
                      </span>
                    )}
                    {ws.signOffStatus === 'Signed Off' && (
                      <span className="text-xs font-semibold text-success-700 flex items-center gap-0.5">
                        ✓ Signed off
                      </span>
                    )}
                    {ws.signOffStatus === 'Requested' && (
                      <span className="text-xs font-medium text-caution-700">Sign-off requested</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {canRequestSignOff(ws) && ws.signOffStatus === 'Pending' && (
                      <button
                        type="button"
                        onClick={() => handleRequestSignOff(ws._id)}
                        className="text-xs bg-caution-100 hover:bg-caution-200 text-caution-900 font-medium px-2 py-1 rounded"
                      >
                        Mark complete + request sign-off
                      </button>
                    )}
                    {iAmPm && ws.signOffStatus === 'Requested' && (
                      <button
                        type="button"
                        onClick={() => handleCompleteSignOff(ws._id)}
                        className="text-xs bg-success-600 hover:bg-success-700 text-paper font-medium px-2 py-1 rounded"
                      >
                        Approve sign-off
                      </button>
                    )}
                    {canCreateTask && (
                      <button
                        type="button"
                        onClick={() => openAddTask(ws._id)}
                        disabled={module?.isBlocked}
                        className="text-xs text-link-600 hover:text-link-800 font-medium transition-colors disabled:text-ink-300"
                      >
                        + Add Task
                      </button>
                    )}
                    {canDeleteWorkstream && (
                      <button
                        type="button"
                        onClick={() => handleDeleteWorkstream(ws._id)}
                        className="text-xs text-ink-300 hover:text-risk-500 transition-colors"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                {user?.role !== 'admin' && (
                  <div className="px-5 py-3 border-b border-ink-100 bg-paper text-xs text-ink-600">
                    <span className="font-semibold text-ink-500 uppercase mr-2">Baseline</span>
                    Start {fmtShort(ws.baselinePlannedStartDate)} → {fmtShort(ws.actualStartDate)}
                    <span className={vStart != null && vStart > 0 ? ' text-risk-600 font-medium' : ''}>
                      {vStart == null ? '' : ` (${vStart > 0 ? '+' : ''}${vStart}d)`}
                    </span>
                    <span className="mx-2 text-ink-300">|</span>
                    End {fmtShort(ws.baselinePlannedEndDate)} → {fmtShort(ws.actualEndDate)}
                    <span className={vEnd != null && vEnd > 0 ? ' text-risk-600 font-medium' : ''}>
                      {vEnd == null ? '' : ` (${vEnd > 0 ? '+' : ''}${vEnd}d)`}
                    </span>
                  </div>
                )}

                {user?.role === 'admin' && (
                  <div className="px-5 py-3 border-b border-ink-100 bg-paper">
                    <p className="text-xs font-semibold text-ink-500 uppercase mb-2">Planned / actual / variance</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left border border-ink-100 rounded">
                        <thead>
                          <tr className="bg-ink-50 text-ink-500">
                            <th className="px-2 py-1" />
                            <th className="px-2 py-1">Planned</th>
                            <th className="px-2 py-1">Actual</th>
                            <th className="px-2 py-1">Variance</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="px-2 py-1 font-medium text-ink-600">Start</td>
                            <td className="px-2 py-1">
                              <input
                                type="date"
                                className="border border-ink-200 rounded px-1 py-0.5 w-full min-w-[7rem]"
                                value={draft.baselinePlannedStartDate || ''}
                                onChange={(e) =>
                                  setWsDateDrafts((prev) => ({
                                    ...prev,
                                    [ws._id]: { ...draft, baselinePlannedStartDate: e.target.value },
                                  }))
                                }
                              />
                            </td>
                            <td className="px-2 py-1">
                              <input
                                type="date"
                                className="border border-ink-200 rounded px-1 py-0.5 w-full min-w-[7rem]"
                                value={draft.actualStartDate || ''}
                                onChange={(e) =>
                                  setWsDateDrafts((prev) => ({
                                    ...prev,
                                    [ws._id]: { ...draft, actualStartDate: e.target.value },
                                  }))
                                }
                              />
                            </td>
                            <td className={`px-2 py-1 ${vStart != null && vStart > 0 ? 'text-risk-600 font-medium' : 'text-ink-600'}`}>
                              {vStart == null ? '—' : `${vStart > 0 ? '+' : ''}${vStart} days`}
                            </td>
                          </tr>
                          <tr>
                            <td className="px-2 py-1 font-medium text-ink-600">End</td>
                            <td className="px-2 py-1">
                              <input
                                type="date"
                                className="border border-ink-200 rounded px-1 py-0.5 w-full min-w-[7rem]"
                                value={draft.baselinePlannedEndDate || ''}
                                onChange={(e) =>
                                  setWsDateDrafts((prev) => ({
                                    ...prev,
                                    [ws._id]: { ...draft, baselinePlannedEndDate: e.target.value },
                                  }))
                                }
                              />
                            </td>
                            <td className="px-2 py-1">
                              <input
                                type="date"
                                className="border border-ink-200 rounded px-1 py-0.5 w-full min-w-[7rem]"
                                value={draft.actualEndDate || ''}
                                onChange={(e) =>
                                  setWsDateDrafts((prev) => ({
                                    ...prev,
                                    [ws._id]: { ...draft, actualEndDate: e.target.value },
                                  }))
                                }
                              />
                            </td>
                            <td className={`px-2 py-1 ${vEnd != null && vEnd > 0 ? 'text-risk-600 font-medium' : 'text-ink-600'}`}>
                              {vEnd == null ? '—' : `${vEnd > 0 ? '+' : ''}${vEnd} days`}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        saveWorkstreamMeta(ws._id, {
                          baselinePlannedStartDate: draft.baselinePlannedStartDate || null,
                          baselinePlannedEndDate: draft.baselinePlannedEndDate || null,
                          actualStartDate: draft.actualStartDate || null,
                          actualEndDate: draft.actualEndDate || null,
                        })
                      }
                      className="mt-2 text-xs text-link-600 hover:underline"
                    >
                      Save dates
                    </button>
                  </div>
                )}

                {(user?.role === 'admin' || user?.role === 'dh') && (
                  <div className="px-5 py-2 border-b border-ink-100 bg-paper flex flex-wrap items-end gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-ink-500 uppercase">
                        WS budget (h)
                      </label>
                      <input
                        type="number"
                        min="0"
                        className="mt-0.5 w-24 border border-ink-200 rounded px-2 py-1 text-xs"
                        value={draft.budgetHours ?? ''}
                        onChange={(e) =>
                          setWsDateDrafts((prev) => ({
                            ...prev,
                            [ws._id]: { ...draft, budgetHours: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-ink-500 uppercase">
                        Cost rate (₹/h)
                      </label>
                      <input
                        type="number"
                        min="0"
                        className="mt-0.5 w-28 border border-ink-200 rounded px-2 py-1 text-xs"
                        value={draft.costRate ?? ''}
                        onChange={(e) =>
                          setWsDateDrafts((prev) => ({
                            ...prev,
                            [ws._id]: { ...draft, costRate: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        saveWorkstreamMeta(ws._id, {
                          budgetHours: Number(draft.budgetHours) || 0,
                          costRate: Number(draft.costRate) || 0,
                        })
                      }
                      className="text-xs bg-ink-700 hover:bg-ink-800 text-paper font-medium px-2 py-1 rounded"
                    >
                      Save budget
                    </button>
                  </div>
                )}

                {(user?.role === 'admin' || user?.role === 'dh') && finWs != null && (
                  <div className="px-5 py-2.5 border-b border-caution-100 bg-caution-50/60">
                    <div className="flex flex-wrap justify-between gap-2 text-xs text-ink-700">
                      <span className="font-semibold text-caution-900">Workstream cost burn</span>
                      <span>
                        {finWs.burnPercent}% of budget hours ·{' '}
                        {Number(finWs.costConsumed || 0).toLocaleString('en-IN')} ₹ cost vs{' '}
                        {Number(finWs.budgetValue || 0).toLocaleString('en-IN')} ₹ budget value
                      </span>
                    </div>
                    <div className="h-1.5 bg-caution-200/80 rounded-full mt-1.5 overflow-hidden">
                      <div
                        className="h-full bg-caution-600 rounded-full transition-all"
                        style={{ width: `${Math.min(100, Number(finWs.burnPercent) || 0)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Tasks table */}
                {ws.tasks.length === 0 ? (
                  <div className="px-5 py-5 text-sm text-ink-400">
                    No tasks yet.{' '}
                    {canCreateTask && (
                      <button
                        onClick={() => openAddTask(ws._id)}
                        className="text-link-500 hover:underline"
                      >
                        Add the first task →
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-ink-100">
                          {user?.role === 'admin' && (
                            <th className="w-8 px-2 py-2.5 text-xs font-medium text-ink-400 uppercase">
                              <input
                                type="checkbox"
                                aria-label="Select all in workstream"
                                checked={
                                  ws.tasks.length > 0 &&
                                  ws.tasks.every((t) => selectedTaskIds.has(t._id))
                                }
                                onChange={(e) => {
                                  setSelectedTaskIds((prev) => {
                                    const next = new Set(prev);
                                    if (e.target.checked) {
                                      ws.tasks.forEach((t) => next.add(t._id));
                                    } else {
                                      ws.tasks.forEach((t) => next.delete(t._id));
                                    }
                                    return next;
                                  });
                                }}
                              />
                            </th>
                          )}
                          <th className="text-left px-5 py-2.5 text-xs font-medium text-ink-400 uppercase tracking-wide w-2/5">
                            Task
                          </th>
                          <th className="text-left px-3 py-2.5 text-xs font-medium text-ink-400 uppercase tracking-wide">
                            Owner
                          </th>
                          {user?.role === 'admin' && (
                            <th className="text-left px-3 py-2.5 text-xs font-medium text-ink-400 uppercase tracking-wide">
                              Assigned To
                            </th>
                          )}
                          <th className="text-left px-3 py-2.5 text-xs font-medium text-ink-400 uppercase tracking-wide">
                            Due
                          </th>
                          <th className="text-left px-3 py-2.5 text-xs font-medium text-ink-400 uppercase tracking-wide">
                            Status
                          </th>
                          {(user?.role === 'admin' || user?.role === 'dh') && (
                            <th className="text-center px-2 py-2.5 text-xs font-medium text-ink-400 uppercase tracking-wide w-20">
                              Billable
                            </th>
                          )}
                          <th className="text-right px-3 py-2.5 text-xs font-medium text-ink-400 uppercase tracking-wide">
                            Hours
                          </th>
                          <th className="px-3 py-2.5 w-8" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink-50">
                        {ws.tasks.map((task) => {
                          const overdue = isOverdue(task);
                          const isSub = Boolean(task.parentTaskId);
                          return (
                            <tr
                              key={task._id}
                              className={`group/row transition-colors ${overdue || task.riskLevel === 'At Risk' ? 'bg-risk-50/40' : 'hover:bg-ink-50/60'}`}
                            >
                              {user?.role === 'admin' && (
                                <td className="px-2 py-3">
                                  <input
                                    type="checkbox"
                                    checked={selectedTaskIds.has(task._id)}
                                    onChange={() => toggleTaskSelect(task._id)}
                                  />
                                </td>
                              )}
                              {/* Title */}
                              <td className={`py-3 pr-2 pl-2 ${isSub ? 'pl-8' : 'pl-5'}`}>
                                <div className="flex items-center flex-wrap gap-2">
                                  {isSub && (
                                    <span className="text-ink-300 text-xs shrink-0" aria-hidden>
                                      └
                                    </span>
                                  )}
                                  {taskFlags[task._id] && (
                                    <span
                                      className={`text-lg ${taskFlags[task._id].flag === 'overdue' ? 'text-risk-600' :
                                        taskFlags[task._id].flag === 'at_risk' ? 'text-caution-600' :
                                          taskFlags[task._id].flag === 'stalled' ? 'text-risk-500' :
                                            'text-caution-600'
                                        }`}
                                      title={taskFlags[task._id].suggestion}
                                    >
                                      🚩
                                    </span>
                                  )}
                                  <span className={overdue ? 'text-risk-700 font-medium' : 'text-ink-800'}>
                                    {task.title}
                                  </span>
                                  {task.riskLevel === 'At Risk' && (
                                    <span className="text-xs font-semibold text-risk-600 bg-risk-100 border border-risk-200 px-1.5 py-0.5 rounded">
                                      At risk
                                    </span>
                                  )}
                                  {overdue && (
                                    <span className="text-xs text-risk-400 font-medium shrink-0">
                                      overdue
                                    </span>
                                  )}
                                  {canCreateTask && (
                                    <button
                                      type="button"
                                      onClick={() => openAddSubtask(ws._id, task)}
                                      className="text-xs text-link-600 hover:underline opacity-0 group-hover/row:opacity-100"
                                    >
                                      + Subtask
                                    </button>
                                  )}
                                </div>
                                {taskFlags[task._id] && (
                                  <p className="text-xs text-ink-500 mt-1">{taskFlags[task._id].suggestion}</p>
                                )}
                              </td>

                              {/* Owner */}
                              <td className="px-3 py-3 text-ink-500 whitespace-nowrap">
                                {task.owner}
                              </td>

                              {/* Assigned To (Admin only) - Show name if assigned, dropdown if not */}
                              {user?.role === 'admin' && (
                                <td className="px-3 py-3">
                                  {task.assignedTo && typeof task.assignedTo === 'object' && task.assignedTo.name ? (
                                    <span className="text-sm font-medium text-ink-700 block py-1">
                                      {task.assignedTo.name}
                                    </span>
                                  ) : (
                                    <select
                                      value=""
                                      onChange={(e) => handleAssignTask(task._id, e.target.value || null)}
                                      className="text-xs border border-ink-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-link-400 cursor-pointer text-ink-500"
                                    >
                                      <option value="">Assign now</option>
                                      {members.map((member) => (
                                        <option key={member._id} value={member._id}>
                                          {member.name}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                </td>
                              )}

                              {/* Due date */}
                              <td className="px-3 py-3 whitespace-nowrap">
                                <span className={`text-xs ${overdue ? 'text-risk-500 font-medium' : 'text-ink-500'}`}>
                                  {new Date(task.dueDate).toLocaleDateString('en-IN', {
                                    day: 'numeric', month: 'short',
                                  })}
                                </span>
                              </td>

                              {/* Status dropdown */}
                              <td className="px-3 py-3">
                                <select
                                  value={task.status}
                                  onChange={(e) => handleStatusChange(task._id, e.target.value)}
                                  className={`text-xs border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-link-400 cursor-pointer ${statusColor(task.status)}`}
                                >
                                  <option>Not Started</option>
                                  <option>In Progress</option>
                                  <option>Done</option>
                                </select>
                              </td>

                              {(user?.role === 'admin' || user?.role === 'dh') && (
                                <td className="px-2 py-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={task.billable !== false}
                                    onChange={(e) => handleBillableChange(task._id, e.target.checked)}
                                    title="Billable for margin / cost split"
                                    className="rounded border-ink-300"
                                  />
                                </td>
                              )}

                              {/* Logged hours + log button */}
                              <td className="px-3 py-3 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => openLogHours(task)}
                                    className="text-xs text-link-500 hover:text-link-700 font-medium opacity-0 group-hover/row:opacity-100 transition-opacity"
                                  >
                                    +log
                                  </button>
                                  <span className="font-medium text-ink-700">{task.loggedHours}h</span>
                                </div>
                              </td>

                              {/* Delete */}
                              <td className="px-3 py-3 text-center">
                                <button
                                  onClick={() => handleDeleteTask(task._id)}
                                  className="text-ink-200 hover:text-risk-400 transition-colors opacity-0 group-hover/row:opacity-100 text-xs"
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {user?.role === 'admin' && selectedTaskIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-ink-900 text-paper px-4 py-3 flex flex-wrap items-center gap-3 justify-center shadow-lg z-40 border-t border-ink-700">
          <span className="text-sm font-medium">Bulk actions ({selectedTaskIds.size} tasks)</span>
          <select
            className="text-xs text-ink-900 rounded px-2 py-1.5 border-0"
            value={bulkAssignUser}
            onChange={(e) => setBulkAssignUser(e.target.value)}
          >
            <option value="">Assign to…</option>
            {members.map((m) => (
              <option key={m._id} value={m._id}>
                {m.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="text-xs bg-link-500 hover:bg-link-400 px-2 py-1.5 rounded"
            onClick={() => bulkAssignUser && runBulk('assign', bulkAssignUser)}
          >
            Apply assign
          </button>
          <input
            type="number"
            className="w-16 text-xs text-ink-900 rounded px-2 py-1.5"
            value={bulkShift}
            onChange={(e) => setBulkShift(e.target.value)}
            placeholder="days"
          />
          <button
            type="button"
            className="text-xs bg-link-500 hover:bg-link-400 px-2 py-1.5 rounded"
            onClick={() => runBulk('date-shift', Number(bulkShift) || 0)}
          >
            Shift dates
          </button>
          <select
            className="text-xs text-ink-900 rounded px-2 py-1.5 border-0"
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value)}
          >
            <option>Not Started</option>
            <option>In Progress</option>
            <option>Done</option>
          </select>
          <button
            type="button"
            className="text-xs bg-link-500 hover:bg-link-400 px-2 py-1.5 rounded"
            onClick={() => runBulk('status', bulkStatus)}
          >
            Set status
          </button>
          <button
            type="button"
            className="text-xs text-ink-400 hover:text-paper ml-2"
            onClick={() => setSelectedTaskIds(new Set())}
          >
            Clear
          </button>
        </div>
      )}

      {/* ─── Add Workstream Modal ─── */}
      {showWsModal && (
        <Modal title="Add Workstream" onClose={() => setShowWsModal(false)}>
          <form onSubmit={handleAddWorkstream} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1.5">Workstream</label>
              {!wsCustom ? (
                <select
                  className="w-full border border-ink-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-link-500"
                  value={wsName}
                  onChange={(e) => {
                    if (e.target.value === '__custom__') {
                      setWsCustom(true);
                      setWsName('');
                    } else {
                      setWsName(e.target.value);
                    }
                  }}
                  required
                >
                  <option value="">Select a workstream…</option>
                  {WS_PRESETS.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                  <option value="__custom__">Custom name…</option>
                </select>
              ) : (
                <div className="flex gap-2">
                  <input
                    autoFocus
                    required
                    placeholder="Enter workstream name"
                    className="flex-1 border border-ink-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-link-500"
                    value={wsName}
                    onChange={(e) => setWsName(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => { setWsCustom(false); setWsName(''); }}
                    className="text-xs text-ink-400 hover:text-ink-600 px-2"
                  >
                    ← back
                  </button>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowWsModal(false)} className="px-4 py-2 text-sm text-ink-500">
                Cancel
              </button>
              <button type="submit" className="bg-link-600 text-paper text-sm font-medium px-5 py-2 rounded-md">
                Add
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ─── Add Task Modal ─── */}
      {showTaskModal && (
        <Modal
          title={parentTaskForModal ? 'Add subtask' : 'Add task'}
          onClose={() => {
            setShowTaskModal(false);
            setParentTaskForModal(null);
          }}
        >
          <form onSubmit={handleAddTask} className="space-y-4">
            {parentTaskForModal && (
              <p className="text-xs text-ink-500 bg-ink-50 border border-ink-100 rounded-md px-3 py-2">
                Under: <span className="font-medium text-ink-800">{parentTaskForModal.title}</span>
              </p>
            )}
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1.5">Title *</label>
              <input
                required
                placeholder="e.g. Configure leave policies"
                className="w-full border border-ink-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-link-500"
                value={taskForm.title}
                onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1.5">Owner *</label>
              <input
                required
                placeholder="e.g. Rahul Sharma"
                className="w-full border border-ink-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-link-500"
                value={taskForm.owner}
                onChange={(e) => setTaskForm({ ...taskForm, owner: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1.5">Due Date *</label>
                <input
                  type="date"
                  required
                  className="w-full border border-ink-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-link-500"
                  value={taskForm.dueDate}
                  onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1.5">Status</label>
                <select
                  className="w-full border border-ink-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-link-500"
                  value={taskForm.status}
                  onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value })}
                >
                  <option>Not Started</option>
                  <option>In Progress</option>
                  <option>Done</option>
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink-700 cursor-pointer">
              <input
                type="checkbox"
                checked={taskForm.billable !== false}
                onChange={(e) => setTaskForm({ ...taskForm, billable: e.target.checked })}
                className="rounded border-ink-300"
              />
              Billable (default on)
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowTaskModal(false)} className="px-4 py-2 text-sm text-ink-500">
                Cancel
              </button>
              <button
                type="submit"
                disabled={taskSaving}
                className="bg-link-600 text-paper text-sm font-medium px-5 py-2 rounded-md disabled:opacity-50"
              >
                {taskSaving ? 'Adding…' : parentTaskForModal ? 'Add subtask' : 'Add task'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ─── Log Hours Modal ─── */}
      {showLogModal && logTask && (
        <Modal
          title={`Log Hours`}
          onClose={() => setShowLogModal(false)}
        >
          <form onSubmit={handleLogHours} className="space-y-4">
            <div className="p-3 bg-ink-50 rounded-md border border-ink-100">
              <p className="text-sm font-medium text-ink-800">{logTask.title}</p>
              <p className="text-xs text-ink-400 mt-0.5">
                Currently logged: <strong>{logTask.loggedHours}h</strong>
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1.5">Hours to Add</label>
              <input
                autoFocus
                type="number"
                required
                min="0.5"
                step="0.5"
                placeholder="e.g. 2.5"
                className="w-full border border-ink-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-link-500"
                value={hoursInput}
                onChange={(e) => setHoursInput(e.target.value)}
              />
              <p className="text-xs text-ink-400 mt-1">
                New total will be: <strong>{(logTask.loggedHours + (parseFloat(hoursInput) || 0)).toFixed(1)}h</strong>
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowLogModal(false)} className="px-4 py-2 text-sm text-ink-500">
                Cancel
              </button>
              <button
                type="submit"
                className="bg-link-600 text-paper text-sm font-medium px-5 py-2 rounded-md"
              >
                Log Hours
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
