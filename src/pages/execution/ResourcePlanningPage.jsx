import { useEffect, useMemo, useRef, useState } from 'react';
import { executionAPI, projectsAPI, resourcesAPI } from '../../services/api';
import Avatar from '../../components/Avatar';
import LoadingScreen from '../../components/LoadingScreen';

function startOfWeek(d) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = (day + 6) % 7;
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function weekLabel(dt) {
  const end = new Date(dt);
  end.setDate(end.getDate() + 6);
  return `${dt.getDate()}${dt.getMonth() !== end.getMonth() ? ` ${dt.toLocaleString('en', { month: 'short' })}` : ''}-${end.getDate()}${end.getMonth() !== dt.getMonth() ? ` ${end.toLocaleString('en', { month: 'short' })}` : ''}`;
}

function monthLabel(dt) {
  return `${dt.toLocaleString('en', { month: 'short' })} '${String(dt.getFullYear()).slice(2)}`;
}

function dateKeyLocal(d) {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function weekKey(dt) {
  return dateKeyLocal(startOfWeek(dt));
}

function weekDateFromKey(key) {
  const d = new Date(`${key}T00:00:00`);
  return startOfWeek(d);
}

function weeksBetweenInclusive(startKey, endKey) {
  const out = [];
  const start = weekDateFromKey(startKey);
  const end = weekDateFromKey(endKey);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return out;
  const cur = new Date(start);
  while (cur <= end) {
    out.push(weekKey(cur));
    cur.setDate(cur.getDate() + 7);
  }
  return out;
}

/** Stable id for people rows (API may return ObjectId or string) */
function personRowId(r) {
  const x = r?.userId;
  if (x == null) return '';
  if (typeof x === 'object' && x._id != null) return String(x._id);
  return String(x);
}

function cellStyle(info, isPastWeek, hasAnyLoggedHours) {
  if (isPastWeek) {
    if ((!info || (info.assignedCount === 0 && info.plannedHours === 0)) && !hasAnyLoggedHours) {
      return { bg: '#dcfce7', text: '#166534', label: '0% (free)', textDecoration: 'none' };
    }
    return {
      bg: '#e5e7eb',
      text: '#6b7280',
      label: 'blocked',
      textDecoration: 'line-through',
    };
  }
  if (!info || (info.assignedCount === 0 && info.plannedHours === 0)) {
    return { bg: '#dcfce7', text: '#166534', label: '0% (free)', textDecoration: 'none' };
  }
  const totalHours = Number(info.loggedHours || 0) + Number(info.plannedHours || 0);
  const pct = Math.max(0, Math.min(100, Math.round((totalHours / 40) * 100)));
  if (info.loggedHours > 0 || totalHours >= 40) {
    return { bg: '#fee2e2', text: '#b91c1c', label: `${pct || 100}% (busy)`, textDecoration: 'none' };
  }
  return { bg: '#fef3c7', text: '#92400e', label: `${Math.max(10, pct)}% (assigned)`, textDecoration: 'none' };
}

export default function ResourcePlanningPage() {
  const GRID_COLUMNS = '300px 96px repeat(8, minmax(128px, 1fr))';
  const [rows, setRows] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [onlyActive, setOnlyActive] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState({ role: 'all', department: 'all', region: 'all', load: 'all' });
  const [activeTopTab, setActiveTopTab] = useState('people');
  const [viewMode, setViewMode] = useState('week');
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const todayStart = useMemo(() => startOfWeek(new Date()), []);
  const [showWork, setShowWork] = useState(false);
  const showWorkRef = useRef(showWork);
  useEffect(() => {
    showWorkRef.current = showWork;
  }, [showWork]);
  const [expandedUsers, setExpandedUsers] = useState({});
  const [hoveredCellKey, setHoveredCellKey] = useState('');
  const [editingCell, setEditingCell] = useState(null);
  const [projectCreating, setProjectCreating] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [appsState, setAppsState] = useState({
    darwinbox: true,
    timesheets: true,
    webhooks: false,
  });
  const [drawer, setDrawer] = useState({
    open: false,
    user: null,
    startWeek: '',
    endWeek: '',
    projectId: '',
    projectName: '',
    hoursPerWeek: '40',
    createNewProject: false,
    newProjectName: '',
    newClientName: '',
    newContractValue: '0',
    error: '',
  });

  const reloadGrid = async (cancelled = false) => {
    try {
      const [taskRes, projectRes, peopleRes] = await Promise.all([
        executionAPI.allTasks({}),
        projectsAPI.getAll().catch(() => ({ data: { projects: [] } })),
        resourcesAPI.people({
          startDate: weeks[0]?.toISOString(),
          endDate: weeks[weeks.length - 1]?.toISOString(),
        }),
      ]);
      if (cancelled) return;
      setTasks(Array.isArray(taskRes?.data?.tasks) ? taskRes.data.tasks : []);
      const rawProjects = Array.isArray(projectRes?.data)
        ? projectRes.data
        : Array.isArray(projectRes?.data?.projects)
          ? projectRes.data.projects
          : [];
      setProjects(rawProjects);
      const peopleRows = Array.isArray(peopleRes?.data) ? peopleRes.data : [];
      setRows(
        peopleRows.map((r) => ({
          userId: r.userId,
          name: r.name,
          role: r.role,
          seniority: r.seniority,
          department: r.department || '',
          region: r.region || '',
          weeklyCapacity: Number(r.weeklyCapacity || 40),
          openTaskCount: (r.projects || []).length,
          totalLoggedHours: (r.weeklyUtilisation || []).reduce(
            (sum, wk) => sum + (Number(wk.allocatedHours) || 0),
            0
          ),
        }))
      );
      const planRows = [];
      peopleRows.forEach((r) => {
        (r.weeklyUtilisation || []).forEach((wk) => {
          (wk.projectBreakdown || []).forEach((p) => {
            planRows.push({
              id: String(p.allocationId),
              userId: String(r.userId),
              userName: r.name,
              startWeek: wk.weekStart,
              endWeek: wk.weekStart,
              projectId: p.projectId,
              projectName: p.projectName,
              hoursPerWeek: Number(p.hours) || 0,
              allocationType: p.allocationType || 'Hard',
            });
          });
        });
      });
      setPlans(planRows);
      setExpandedUsers((prev) => {
        const idSet = new Set(peopleRows.map((row) => personRowId(row)).filter(Boolean));
        const next = { ...prev };
        let changed = false;
        Object.keys(next).forEach((k) => {
          if (!idSet.has(k)) {
            delete next[k];
            changed = true;
          }
        });
        if (showWorkRef.current) {
          peopleRows.forEach((row) => {
            const id = personRowId(row);
            if (id && !(id in next)) {
              next[id] = true;
              changed = true;
            }
          });
        }
        return changed ? next : prev;
      });
      setError('');
    } catch (e) {
      if (cancelled) return;
      setError(e.response?.data?.message || 'Could not load resource snapshot');
    } finally {
      if (!cancelled) setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        await reloadGrid(cancelled);
      } catch (e) {
        // handled in reload
      }
    };
    load();
    const onFocusRefresh = () => load();
    const onVisibleRefresh = () => {
      if (document.visibilityState === 'visible') load();
    };
    const timer = setInterval(load, 3000);
    window.addEventListener('focus', onFocusRefresh);
    document.addEventListener('visibilitychange', onVisibleRefresh);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener('focus', onFocusRefresh);
      document.removeEventListener('visibilitychange', onVisibleRefresh);
    };
  }, [weekStart, viewMode]);

  const weeks = useMemo(() => {
    const count = viewMode === 'month' ? 12 : 8;
    return Array.from({ length: count }).map((_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i * 7);
      return d;
    });
  }, [weekStart, viewMode]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (onlyActive && Number(r.openTaskCount || 0) === 0) return false;
      if (!s) return true;
      return `${r.name} ${r.role} ${r.seniority || ''}`.toLowerCase().includes(s);
    });
  }, [rows, search, onlyActive]);

  const roleOptions = useMemo(() => {
    const vals = [...new Set(rows.map((r) => String(r.role || '').trim()).filter(Boolean))];
    return ['all', ...vals];
  }, [rows]);
  const departmentOptions = useMemo(() => {
    const vals = [...new Set(rows.map((r) => String(r.department || '').trim()).filter(Boolean))];
    return ['all', ...vals];
  }, [rows]);
  const regionOptions = useMemo(() => {
    const vals = [...new Set(rows.map((r) => String(r.region || '').trim()).filter(Boolean))];
    return ['all', ...vals];
  }, [rows]);

  const plansByUserWeek = useMemo(() => {
    const map = {};
    plans.forEach((p) => {
      if (!p?.userId || !p?.startWeek || !p?.endWeek) return;
      weeksBetweenInclusive(p.startWeek, p.endWeek).forEach((wk) => {
        const k = `${String(p.userId)}:${wk}`;
        if (!map[k]) map[k] = [];
        map[k].push(p);
      });
    });
    return map;
  }, [plans]);

  const allocationMap = useMemo(() => {
    const map = {};
    tasks.forEach((t) => {
      const uid = t.assignee?._id || t.assignedTo || null;
      const date = t.dueDate ? new Date(t.dueDate) : null;
      if (!uid || !date || Number.isNaN(date.getTime())) return;
      const k = `${String(uid)}:${weekKey(date)}`;
      if (!map[k]) map[k] = { assignedCount: 0, loggedHours: 0, plannedHours: 0 };
      map[k].assignedCount += 1;
      map[k].loggedHours += Number(t.loggedHours) || 0;
    });
    Object.entries(plansByUserWeek).forEach(([k, weekPlans]) => {
      if (!map[k]) map[k] = { assignedCount: 0, loggedHours: 0, plannedHours: 0 };
      weekPlans.forEach((p) => {
        map[k].assignedCount += 1;
        map[k].plannedHours += Number(p.hoursPerWeek) || 0;
      });
    });
    return map;
  }, [tasks, plansByUserWeek]);

  const peopleRows = useMemo(() => {
    return filtered.filter((r) => {
      if (filters.role !== 'all' && String(r.role || '').toLowerCase() !== String(filters.role).toLowerCase()) {
        return false;
      }
      if (filters.department !== 'all' && String(r.department || '').toLowerCase() !== String(filters.department).toLowerCase()) {
        return false;
      }
      if (filters.region !== 'all' && String(r.region || '').toLowerCase() !== String(filters.region).toLowerCase()) {
        return false;
      }
      if (filters.load === 'all') return true;

      let hasBusy = false;
      let hasAssigned = false;
      let hasBlocked = false;
      weeks.forEach((wk) => {
        const key = `${String(r.userId)}:${weekKey(wk)}`;
        const info = allocationMap[key] || { assignedCount: 0, loggedHours: 0, plannedHours: 0 };
        const wkEnd = new Date(wk);
        wkEnd.setDate(wkEnd.getDate() + 6);
        wkEnd.setHours(23, 59, 59, 999);
        const isPastWeek = wkEnd < todayStart;
        const totalHours = Number(info.loggedHours || 0) + Number(info.plannedHours || 0);

        if (isPastWeek) {
          if (info.assignedCount > 0 || totalHours > 0 || Number(r.totalLoggedHours || 0) > 0) hasBlocked = true;
          return;
        }
        if (Number(info.loggedHours || 0) > 0 || totalHours >= 40) {
          hasBusy = true;
        } else if (info.assignedCount > 0 || Number(info.plannedHours || 0) > 0) {
          hasAssigned = true;
        }
      });

      if (filters.load === 'busy') return hasBusy;
      if (filters.load === 'assigned') return hasAssigned && !hasBusy;
      if (filters.load === 'free') return !hasBusy && !hasAssigned;
      if (filters.load === 'blocked') return hasBlocked;
      return true;
    });
  }, [filtered, filters, weeks, allocationMap, todayStart]);

  const workByUserWeek = useMemo(() => {
    const map = {};
    tasks.forEach((t) => {
      const uid = t.assignee?._id || t.assignedTo || null;
      const date = t.dueDate ? new Date(t.dueDate) : null;
      if (!uid || !date || Number.isNaN(date.getTime())) return;
      const k = `${String(uid)}:${weekKey(date)}`;
      if (!map[k]) map[k] = [];
      map[k].push({
        id: t._id,
        title: t.title || 'Work item',
        kind: 'task',
      });
    });
    plans.forEach((p) => {
      if (!p?.userId || !p?.startWeek || !p?.endWeek) return;
      weeksBetweenInclusive(p.startWeek, p.endWeek).forEach((wk) => {
        const k = `${String(p.userId)}:${wk}`;
        if (!map[k]) map[k] = [];
        map[k].push({
          id: p.id,
          title: `${p.projectName || 'Project'} (${Number(p.hoursPerWeek) || 0}h/w)`,
          kind: 'plan',
        });
      });
    });
    return map;
  }, [tasks, plans]);

  const openDrawerFor = (user, wk) => {
    const wkKey = weekKey(wk);
    const defaultProject = projects[0] || null;
    setDrawer({
      open: true,
      user,
      startWeek: wkKey,
      endWeek: wkKey,
      projectId: defaultProject?._id || '',
      projectName: defaultProject?.name || '',
      hoursPerWeek: '40',
      createNewProject: false,
      newProjectName: '',
      newClientName: '',
      newContractValue: '0',
      error: '',
    });
  };

  const closeDrawer = () => {
    setDrawer((prev) => ({ ...prev, open: false, error: '' }));
  };

  const savePlan = async () => {
    if (!drawer.user?.userId) {
      setDrawer((prev) => ({ ...prev, error: 'Choose a team member.' }));
      return;
    }
    if (!drawer.startWeek || !drawer.endWeek) {
      setDrawer((prev) => ({ ...prev, error: 'Select a date range.' }));
      return;
    }
    if (weekDateFromKey(drawer.startWeek) > weekDateFromKey(drawer.endWeek)) {
      setDrawer((prev) => ({ ...prev, error: 'End week must be after start week.' }));
      return;
    }
    const hours = Number(drawer.hoursPerWeek);
    if (!hours || hours <= 0) {
      setDrawer((prev) => ({ ...prev, error: 'Enter valid hours per week.' }));
      return;
    }
    const selectedProject = projects.find((p) => p._id === drawer.projectId);
    if (!selectedProject?._id) {
      setDrawer((prev) => ({ ...prev, error: 'Choose a project.' }));
      return;
    }
    setSavingPlan(true);
    try {
      const allWeeks = weeksBetweenInclusive(drawer.startWeek, drawer.endWeek);
      await Promise.all(
        allWeeks.map((wk) =>
          resourcesAPI.allocate({
            userId: drawer.user.userId,
            projectId: selectedProject._id,
            weekStartDate: wk,
            allocatedHours: hours,
            allocationType: 'Hard',
          })
        )
      );
      await reloadGrid(false);
      closeDrawer();
    } catch (e) {
      const apiErrors = Array.isArray(e?.response?.data?.errors) ? e.response.data.errors.join(', ') : '';
      setDrawer((prev) => ({
        ...prev,
        error: apiErrors || e?.response?.data?.message || 'Could not save allocation',
      }));
    } finally {
      setSavingPlan(false);
    }
  };

  const createProjectInline = async () => {
    const name = drawer.newProjectName.trim();
    const clientName = drawer.newClientName.trim();
    const contractValue = Number(drawer.newContractValue || 0);
    if (name.length < 2) {
      setDrawer((prev) => ({ ...prev, error: 'Project name must be at least 2 characters.' }));
      return;
    }
    if (!clientName) {
      setDrawer((prev) => ({ ...prev, error: 'Client name is required.' }));
      return;
    }
    if (Number.isNaN(contractValue) || contractValue < 0) {
      setDrawer((prev) => ({ ...prev, error: 'Contract value must be 0 or more.' }));
      return;
    }
    setProjectCreating(true);
    try {
      const start = drawer.startWeek ? weekDateFromKey(drawer.startWeek) : new Date();
      const goLive = new Date(start);
      goLive.setDate(goLive.getDate() + 28);
      const res = await projectsAPI.create({
        name,
        clientName,
        goLiveDate: goLive.toISOString(),
        contractValue,
        implementationFee: contractValue,
        notionalARR: 0,
        status: 'Draft',
        tier: 'Tier 2',
      });
      const created = res?.data;
      if (!created?._id) throw new Error('Project creation failed');
      setProjects((prev) => [created, ...prev]);
      setDrawer((prev) => ({
        ...prev,
        createNewProject: false,
        projectId: created._id,
        projectName: created.name || name,
        newProjectName: '',
        newClientName: '',
        newContractValue: '0',
        error: '',
      }));
    } catch (e) {
      const apiErrors = Array.isArray(e?.response?.data?.errors) ? e.response.data.errors.join(', ') : '';
      setDrawer((prev) => ({
        ...prev,
        error: apiErrors || e?.response?.data?.message || 'Could not create project',
      }));
    } finally {
      setProjectCreating(false);
    }
  };

  const userDrawerPlans = useMemo(() => {
    if (!drawer.user?.userId) return [];
    return plans.filter((p) => String(p.userId) === String(drawer.user.userId));
  }, [plans, drawer.user]);

  const removeAllocation = async (allocationId) => {
    try {
      await resourcesAPI.deleteAllocation(allocationId);
      await reloadGrid(false);
    } catch (e) {
      setDrawer((prev) => ({
        ...prev,
        error: e?.response?.data?.message || 'Could not remove allocation',
      }));
    }
  };

  const commitInlineHours = async () => {
    if (!editingCell) return;
    const hours = Number(editingCell.value);
    if (Number.isNaN(hours) || hours < 0) {
      setEditingCell(null);
      return;
    }
    try {
      await resourcesAPI.allocate({
        userId: editingCell.userId,
        projectId: editingCell.projectId,
        weekStartDate: editingCell.weekStart,
        allocatedHours: hours,
        allocationType: editingCell.allocationType || 'Hard',
      });
      setEditingCell(null);
      await reloadGrid(false);
    } catch (e) {
      setEditingCell(null);
      setError(e?.response?.data?.message || 'Could not update allocation hours');
    }
  };

  const projectViewRows = useMemo(() => {
    const map = new Map();
    projects.forEach((p) => {
      map.set(String(p._id), {
        id: String(p._id),
        name: p.name || 'Project',
        assignments: 0,
        plannedHours: 0,
      });
    });
    plans.forEach((p) => {
      const pid = String(p.projectId || '');
      if (!pid) return;
      const weeksCount = weeksBetweenInclusive(p.startWeek, p.endWeek).length || 1;
      if (!map.has(pid)) {
        map.set(pid, {
          id: pid,
          name: p.projectName || 'Project',
          assignments: 0,
          plannedHours: 0,
        });
      }
      const row = map.get(pid);
      row.assignments += 1;
      row.plannedHours += (Number(p.hoursPerWeek) || 0) * weeksCount;
    });
    // DB often has no ResourceAllocation rows; roll up the same task vista used on People so this tab is not all zeros.
    const taskRoll = new Map();
    tasks.forEach((t) => {
      const pid = String(t.projectId?._id || t.projectId || '');
      if (!pid) return;
      if (!taskRoll.has(pid)) taskRoll.set(pid, { assignees: new Set(), hours: 0, open: 0 });
      const ex = taskRoll.get(pid);
      ex.hours += Number(t.loggedHours) || 0;
      if (t.status !== 'Done') {
        ex.open += 1;
        const aid = t.assignee?._id || t.assignee;
        if (aid) ex.assignees.add(String(aid));
      }
    });
    taskRoll.forEach((ex, pid) => {
      if (!map.has(pid)) {
        const sample = tasks.find((t) => String(t.projectId?._id || t.projectId || '') === pid);
        map.set(pid, {
          id: pid,
          name: sample?.projectName || 'Project',
          assignments: 0,
          plannedHours: 0,
        });
      }
      const row = map.get(pid);
      const peopleSlots = ex.assignees.size || (ex.open > 0 ? 1 : 0);
      row.assignments += peopleSlots;
      row.plannedHours += ex.hours;
    });
    return [...map.values()].sort((a, b) => b.plannedHours - a.plannedHours);
  }, [projects, plans, tasks]);

  const capacityRows = useMemo(() => {
    const totalWeeks = weeks.length || 8;
    return peopleRows.map((r) => {
      let weekHours = 0;
      weeks.forEach((wk) => {
        const key = `${String(r.userId)}:${weekKey(wk)}`;
        const info = allocationMap[key] || { assignedCount: 0, loggedHours: 0, plannedHours: 0 };
        weekHours += Number(info.loggedHours || 0) + Number(info.plannedHours || 0);
      });
      const maxHours = totalWeeks * Number(r.weeklyCapacity || 40);
      const utilization = Math.max(0, Math.min(100, Math.round((weekHours / Math.max(1, maxHours)) * 100)));
      return {
        userId: r.userId,
        name: r.name,
        role: r.seniority || r.role,
        allocated: weekHours,
        maxHours,
        utilization,
      };
    });
  }, [peopleRows, allocationMap, weeks]);

  const monthGroups = useMemo(() => {
    const groups = [];
    weeks.forEach((wk, idx) => {
      const label = monthLabel(wk);
      const last = groups[groups.length - 1];
      if (last && last.label === label) {
        last.count += 1;
      } else {
        groups.push({ label, count: 1, startIdx: idx });
      }
    });
    return groups;
  }, [weeks]);

  if (loading) return <LoadingScreen title="Loading resource management" subtitle="Preparing team allocation grid..." />;

  return (
    <div style={{ background: '#fff', minHeight: '100%', padding: '18px 16px 12px' }}>
      <div style={{ maxWidth: 1540, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h1 style={{ margin: 0, fontSize: 42, lineHeight: 1.08, fontWeight: 400, letterSpacing: '-0.02em', color: '#111827' }}>Resource management</h1>
        </div>

        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 18, fontSize: 16, color: '#6b7280', borderBottom: '1px solid #eef2f7', paddingBottom: 8 }}>
          {[
            { id: 'people', label: 'People' },
            { id: 'projects', label: 'Projects' },
            { id: 'capacity', label: 'Capacity Planning' },
            { id: 'apps', label: 'Apps' },
          ].map((tab) => {
            const active = activeTopTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTopTab(tab.id)}
                style={{
                  border: 0,
                  background: 'transparent',
                  color: active ? '#111827' : '#6b7280',
                  fontWeight: active ? 600 : 500,
                  borderBottom: active ? '2px solid #111827' : '2px solid transparent',
                  paddingBottom: 7,
                  cursor: 'pointer',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {error ? (
          <div style={{ marginTop: 10, border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', borderRadius: 8, padding: '8px 10px' }}>
            {error}
          </div>
        ) : null}

        {activeTopTab === 'people' && (
          <div style={{ marginTop: 8, border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'visible', background: '#fff' }}>
          <div style={{ height: 46, borderBottom: '1px solid #e9edf4', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 10px', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <select
                value={onlyActive ? 'active' : 'all'}
                onChange={(e) => setOnlyActive(e.target.value === 'active')}
                style={{ height: 34, borderRadius: 7, border: '1px solid #e5e7eb', background: '#fff', color: '#111827', fontSize: 13, fontWeight: 600, padding: '0 10px' }}
              >
                <option value="active">All users - active projects</option>
                <option value="all">All users</option>
              </select>
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setFilterOpen((v) => !v)}
                  style={{ height: 34, borderRadius: 7, border: '1px solid #e5e7eb', background: filterOpen || filters.role !== 'all' || filters.department !== 'all' || filters.region !== 'all' || filters.load !== 'all' ? '#f8fafc' : '#fff', fontSize: 13, fontWeight: 600, padding: '0 10px' }}
                >
                  Filter
                </button>
                {filterOpen && (
                  <div style={{ position: 'absolute', top: 38, left: 0, zIndex: 40, width: 280, border: '1px solid #e5e7eb', borderRadius: 10, background: '#fff', boxShadow: '0 12px 24px rgba(15,23,42,0.08)', padding: 10 }}>
                    <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Role</div>
                    <select
                      value={filters.role}
                      onChange={(e) => setFilters((prev) => ({ ...prev, role: e.target.value }))}
                      style={{ width: '100%', height: 30, border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 12, padding: '0 8px' }}
                    >
                      {roleOptions.map((role) => (
                        <option key={role} value={role}>
                          {role === 'all' ? 'All roles' : role}
                        </option>
                      ))}
                    </select>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 8, marginBottom: 4 }}>Department</div>
                    <select
                      value={filters.department}
                      onChange={(e) => setFilters((prev) => ({ ...prev, department: e.target.value }))}
                      style={{ width: '100%', height: 30, border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 12, padding: '0 8px' }}
                    >
                      {departmentOptions.map((department) => (
                        <option key={department} value={department}>
                          {department === 'all' ? 'All departments' : department}
                        </option>
                      ))}
                    </select>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 8, marginBottom: 4 }}>Region</div>
                    <select
                      value={filters.region}
                      onChange={(e) => setFilters((prev) => ({ ...prev, region: e.target.value }))}
                      style={{ width: '100%', height: 30, border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 12, padding: '0 8px' }}
                    >
                      {regionOptions.map((region) => (
                        <option key={region} value={region}>
                          {region === 'all' ? 'All regions' : region}
                        </option>
                      ))}
                    </select>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 8, marginBottom: 4 }}>Load</div>
                    <select
                      value={filters.load}
                      onChange={(e) => setFilters((prev) => ({ ...prev, load: e.target.value }))}
                      style={{ width: '100%', height: 30, border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 12, padding: '0 8px' }}
                    >
                      <option value="all">All load types</option>
                      <option value="free">Free</option>
                      <option value="assigned">Assigned</option>
                      <option value="busy">Busy</option>
                      <option value="blocked">Blocked (past)</option>
                    </select>
                    <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setFilters({ role: 'all', department: 'all', region: 'all', load: 'all' });
                          setFilterOpen(false);
                        }}
                        style={{ border: 0, background: 'transparent', color: '#7c3aed', fontSize: 12, fontWeight: 700, padding: 0 }}
                      >
                        Reset
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterOpen(false)}
                        style={{ height: 28, borderRadius: 8, border: 0, background: '#111827', color: '#fff', fontSize: 11, fontWeight: 700, padding: '0 10px' }}
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <button
                type="button"
                title="Clear filters and search"
                onClick={() => {
                  setSearch('');
                  setFilters({ role: 'all', department: 'all', region: 'all', load: 'all' });
                }}
                style={{ border: 0, background: 'transparent', color: '#9ca3af', fontSize: 18, lineHeight: 1, padding: '0 4px', cursor: 'pointer' }}
              >
                ×
              </button>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Find availability"
                style={{ width: 260, height: 34, borderRadius: 7, border: '1px solid #e5e7eb', padding: '0 10px', fontSize: 13 }}
              />
              <button
                type="button"
                onClick={() => {
                  setShowWork((prev) => {
                    const next = !prev;
                    if (next) {
                      // Show work: expand everyone so the work sub-row is visible
                      setExpandedUsers((old) => {
                        const out = { ...old };
                        peopleRows.forEach((row) => {
                          out[personRowId(row)] = true;
                        });
                        return out;
                      });
                    } else {
                      // Hide work: collapse all row detail
                      setExpandedUsers({});
                    }
                    return next;
                  });
                }}
                style={{ height: 34, borderRadius: 7, border: '1px solid #e5e7eb', background: showWork ? '#f2ecff' : '#fff', color: showWork ? '#5b21b6' : '#111827', fontSize: 13, fontWeight: 600, padding: '0 12px' }}
              >
                Show work
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value)}
                style={{ height: 26, border: '1px solid #e5e7eb', borderRadius: 7, background: '#fff', padding: '0 8px', fontSize: 12, color: '#6b7280' }}
              >
                <option value="week">Week</option>
                <option value="month">Month</option>
              </select>
              <button type="button" onClick={() => setWeekStart((d) => new Date(d.getTime() - (viewMode === 'month' ? 28 : 7) * 86400000))} style={{ width: 26, height: 26, border: '1px solid #e5e7eb', borderRadius: 7, background: '#fff' }}>←</button>
              <button type="button" onClick={() => setWeekStart(startOfWeek(new Date()))} style={{ height: 26, border: '1px solid #e5e7eb', borderRadius: 7, background: '#fff', padding: '0 8px' }}>Today</button>
              <button type="button" onClick={() => setWeekStart((d) => new Date(d.getTime() + (viewMode === 'month' ? 28 : 7) * 86400000))} style={{ width: 26, height: 26, border: '1px solid #e5e7eb', borderRadius: 7, background: '#fff' }}>→</button>
            </div>
          </div>

          <div style={{ overflowX: 'auto', background: '#f8fafc' }}>
            <div style={{ minWidth: 1700 }}>
              <div style={{ display: 'grid', gridTemplateColumns: GRID_COLUMNS, background: '#fff', position: 'sticky', top: 0, zIndex: 11, borderBottom: '1px solid #e5e7eb' }}>
                <div style={{ padding: '8px 12px', position: 'sticky', left: 0, zIndex: 13, background: '#fff', borderBottom: '1px solid #e5e7eb', fontSize: 12, color: '#6b7280', fontWeight: 600 }}>Team members</div>
                <div style={{ padding: '8px 10px', borderLeft: '1px solid #cbd5e1', position: 'sticky', left: 300, zIndex: 13, background: '#fff', borderBottom: '1px solid #e5e7eb', fontSize: 12, color: '#6b7280', fontWeight: 600 }}>Allocated</div>
                {monthGroups.map((g) => (
                  <div
                    key={`${g.label}-${g.startIdx}`}
                    style={{
                      gridColumn: `span ${g.count}`,
                      padding: '8px 6px',
                      textAlign: 'center',
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#6b7280',
                      borderLeft: '1px solid #cbd5e1',
                      borderBottom: '1px solid #e5e7eb',
                      background: '#f8fafc',
                    }}
                  >
                    {g.label}
                  </div>
                ))}
                <div style={{ padding: '8px 12px', position: 'sticky', left: 0, zIndex: 13, background: '#fff' }} />
                <div style={{ padding: '8px 10px', borderLeft: '1px solid #cbd5e1', position: 'sticky', left: 300, zIndex: 13, background: '#fff' }} />
                {weeks.map((w, idx) => (
                  <div key={idx} style={{ padding: '8px 8px', borderLeft: '1px solid #cbd5e1', textAlign: 'center', background: '#fff' }}>
                    <div style={{ fontSize: 12, lineHeight: 1, color: '#6b7280' }}>
                      {weekKey(w) === weekKey(todayStart) ? (
                        <span style={{ background: '#f97316', color: '#fff', borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>{weekLabel(w)}</span>
                      ) : (
                        weekLabel(w)
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {peopleRows.length === 0 ? (
                <div style={{ padding: 22, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No people match current filters.</div>
              ) : (
                peopleRows.map((r) => {
                  const rowId = personRowId(r);
                  return (
                  <div key={rowId} style={{ padding: 0 }}>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: GRID_COLUMNS,
                        minHeight: 64,
                        borderBottom: '1px solid #e5e7eb',
                        background: '#fff',
                      }}
                    >
                    <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, position: 'sticky', left: 0, background: '#fff', zIndex: 8 }}>
                      <button
                        type="button"
                        aria-expanded={!!expandedUsers[rowId]}
                        aria-label={expandedUsers[rowId] ? 'Hide work' : 'Show work for this person'}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!showWork) {
                            setShowWork(true);
                            setExpandedUsers((prev) => ({ ...prev, [rowId]: true }));
                            return;
                          }
                          setExpandedUsers((prev) => {
                            const cur = prev[rowId];
                            return { ...prev, [rowId]: !cur };
                          });
                        }}
                        style={{
                          border: 0,
                          background: 'transparent',
                          color: '#9ca3af',
                          fontSize: 12,
                          cursor: 'pointer',
                          padding: 4,
                          minWidth: 28,
                          minHeight: 28,
                          lineHeight: 1,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 4,
                        }}
                      >
                        {expandedUsers[rowId] ? '▾' : '▸'}
                      </button>
                      <Avatar name={r.name} size={22} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>{r.seniority || r.role}</div>
                      </div>
                    </div>
                    <div style={{ padding: '10px 8px', borderLeft: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#6b7280', position: 'sticky', left: 300, background: '#fff', zIndex: 8 }}>
                      {Math.round((r.totalLoggedHours || 0) / Math.max(1, weeks.length))}h
                    </div>
                    {weeks.map((_, idx) => {
                      const wk = weeks[idx];
                      const key = `${String(r.userId)}:${weekKey(wk)}`;
                      const info = allocationMap[key] || { assignedCount: 0, loggedHours: 0, plannedHours: 0 };
                      const weekPlans = plansByUserWeek[key] || [];
                      const wkEnd = new Date(wk);
                      wkEnd.setDate(wkEnd.getDate() + 6);
                      wkEnd.setHours(23, 59, 59, 999);
                      const isPastWeek = wkEnd < todayStart;
                      const c = cellStyle(info, isPastWeek, Number(r.totalLoggedHours || 0) > 0);
                      const totalWeekHours = Number(info.loggedHours || 0) + Number(info.plannedHours || 0);
                      const isBusyWeek = !isPastWeek && (Number(info.loggedHours || 0) > 0 || totalWeekHours >= 40);
                      return (
                        <div
                          key={idx}
                          style={{ padding: 0, borderLeft: '1px solid #cbd5e1', borderRight: '1px solid #eef2f7' }}
                          onMouseEnter={() => setHoveredCellKey(key)}
                          onMouseLeave={() => setHoveredCellKey('')}
                        >
                          <div
                            style={{
                              height: '100%',
                              minHeight: 60,
                              background: c.bg,
                              color: c.text,
                              fontSize: 11,
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center',
                              paddingLeft: 7,
                              textDecoration: c.textDecoration,
                              borderBottom: '1px solid #d1d5db',
                              justifyContent: 'space-between',
                              paddingRight: 6,
                            }}
                            onDoubleClick={() => {
                              if (isPastWeek || weekPlans.length === 0) return;
                              const target = weekPlans[0];
                              setEditingCell({
                                key,
                                value: String(Number(target.hoursPerWeek || 0)),
                                userId: r.userId,
                                projectId: target.projectId,
                                weekStart: weekKey(wk),
                                allocationType: target.allocationType || 'Hard',
                              });
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                              {editingCell?.key === key ? (
                                <input
                                  autoFocus
                                  value={editingCell.value}
                                  onChange={(e) =>
                                    setEditingCell((prev) => ({
                                      ...prev,
                                      value: e.target.value.replace(/[^\d.]/g, ''),
                                    }))
                                  }
                                  onBlur={commitInlineHours}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') commitInlineHours();
                                    if (e.key === 'Escape') setEditingCell(null);
                                  }}
                                  style={{ width: 74, height: 22, border: '1px solid #cbd5e1', borderRadius: 6, padding: '0 6px', fontSize: 11 }}
                                />
                              ) : (
                                <span style={{ whiteSpace: 'nowrap' }}>
                                  {c.label} ({Math.round((info.loggedHours || 0) + (info.plannedHours || 0))}h)
                                </span>
                              )}
                              {weekPlans.length > 0 && (
                                <span
                                  title={weekPlans[0].projectName}
                                  style={{
                                    maxWidth: 96,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    fontSize: 10,
                                    lineHeight: '14px',
                                    borderRadius: 999,
                                    padding: '0 7px',
                                    background: '#4f46e5',
                                    color: '#fff',
                                  }}
                                >
                                  {Number(weekPlans[0].hoursPerWeek) || 0}h/w
                                </span>
                              )}
                            </div>
                            {!isPastWeek && !isBusyWeek && hoveredCellKey === key && (
                              <button
                                type="button"
                                onClick={() => openDrawerFor(r, wk)}
                                title="Add project in this week"
                                style={{
                                  border: '1px solid #c7d2fe',
                                  background: '#eef2ff',
                                  color: '#4338ca',
                                  width: 18,
                                  height: 18,
                                  lineHeight: '16px',
                                  borderRadius: 5,
                                  fontSize: 12,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  flexShrink: 0,
                                }}
                              >
                                +
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    </div>

                    {showWork && expandedUsers[rowId] && (
                      <div
                        style={{
                          marginTop: 0,
                          display: 'grid',
                          gridTemplateColumns: GRID_COLUMNS,
                          minHeight: 48,
                          borderBottom: '1px solid #e5e7eb',
                          background: '#fff',
                        }}
                      >
                        <div style={{ padding: '6px 12px', fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', position: 'sticky', left: 0, background: '#fff', zIndex: 8 }}>
                          <button
                            type="button"
                            onClick={() => openDrawerFor(r, weeks[0])}
                            style={{
                              border: 0,
                              background: 'transparent',
                              color: '#7c3aed',
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer',
                              padding: 0,
                            }}
                          >
                            Add project +
                          </button>
                        </div>
                        <div style={{ borderLeft: '1px solid #cbd5e1', position: 'sticky', left: 300, background: '#fff', zIndex: 8 }} />
                        {weeks.map((wk, idx) => {
                          const key = `${String(r.userId)}:${weekKey(wk)}`;
                          const works = workByUserWeek[key] || [];
                          return (
                            <div
                              key={idx}
                              style={{
                                borderLeft: '1px solid #cbd5e1',
                                borderRight: '1px solid #eef2f7',
                                padding: '5px 5px',
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: 4,
                                alignContent: 'flex-start',
                                minHeight: 40,
                                backgroundColor: '#fff',
                                backgroundImage:
                                  'repeating-linear-gradient(to right, rgba(203,213,225,0.35) 0px, rgba(203,213,225,0.35) 1px, transparent 1px, transparent 30px)',
                              }}
                            >
                              {works.length === 0 ? (
                                <span style={{ fontSize: 10, color: '#cbd5e1' }}>—</span>
                              ) : (
                                works.slice(0, 2).map((w) => (
                                  <span
                                    key={w.id}
                                    title={w.title}
                                    style={{
                                      maxWidth: '100%',
                                      fontSize: 10,
                                      lineHeight: '14px',
                                      padding: '0 6px',
                                      borderRadius: 999,
                                      background: w.kind === 'plan' ? '#ede9fe' : '#dbeafe',
                                      color: w.kind === 'plan' ? '#5b21b6' : '#1d4ed8',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                    }}
                                  >
                                    {w.title}
                                  </span>
                                ))
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
                })
              )}
            </div>
          </div>
        </div>
        )}

        {activeTopTab === 'projects' && (
          <div style={{ marginTop: 8, border: '1px solid #e8ecf2', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
            <div style={{ height: 44, borderBottom: '1px solid #edf1f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Projects allocation</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>
                Resource plans plus open-task assignees and logged hours (same scope as the People grid)
              </div>
            </div>
            {projectViewRows.length === 0 ? (
              <div style={{ padding: 18, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                No projects available.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: 820 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 120px 160px 1fr', background: '#f8fafc', borderBottom: '1px solid #e5e7eb', fontSize: 12, color: '#6b7280', fontWeight: 700 }}>
                    <div style={{ padding: '10px 12px' }}>Project</div>
                    <div style={{ padding: '10px 8px', borderLeft: '1px solid #e5e7eb' }}>Assignments</div>
                    <div style={{ padding: '10px 8px', borderLeft: '1px solid #e5e7eb' }}>Planned hours</div>
                    <div style={{ padding: '10px 8px', borderLeft: '1px solid #e5e7eb' }}>Load</div>
                  </div>
                  {projectViewRows.map((p) => {
                    const loadPct = Math.max(0, Math.min(100, Math.round((p.plannedHours / 320) * 100)));
                    return (
                      <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1.4fr 120px 160px 1fr', borderBottom: '1px solid #f1f5f9', fontSize: 12 }}>
                        <div style={{ padding: '10px 12px', color: '#111827', fontWeight: 600 }}>{p.name}</div>
                        <div style={{ padding: '10px 8px', borderLeft: '1px solid #f1f5f9', color: '#6b7280' }}>{p.assignments}</div>
                        <div style={{ padding: '10px 8px', borderLeft: '1px solid #f1f5f9', color: '#6b7280' }}>{Math.round(p.plannedHours)}h</div>
                        <div style={{ padding: '10px 8px', borderLeft: '1px solid #f1f5f9' }}>
                          <div style={{ height: 8, borderRadius: 999, background: '#eef2ff', overflow: 'hidden' }}>
                            <div style={{ width: `${loadPct}%`, height: '100%', background: '#6366f1' }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTopTab === 'capacity' && (
          <div style={{ marginTop: 8, border: '1px solid #e8ecf2', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
            <div style={{ height: 44, borderBottom: '1px solid #edf1f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Capacity planning</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>Utilization across visible week range</div>
            </div>
            <div style={{ padding: 12, display: 'grid', gap: 8 }}>
              {capacityRows.length === 0 ? (
                <div style={{ padding: 14, color: '#9ca3af', fontSize: 13, textAlign: 'center' }}>No users found.</div>
              ) : (
                capacityRows.map((r) => (
                  <div key={r.userId} style={{ border: '1px solid #eef2f7', borderRadius: 8, padding: 10, display: 'grid', gridTemplateColumns: '220px 1fr 92px', alignItems: 'center', gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: '#111827', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>{r.role}</div>
                    </div>
                    <div style={{ height: 10, borderRadius: 999, background: '#ecfdf5', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${r.utilization}%`,
                          height: '100%',
                          background: r.utilization >= 90 ? '#ef4444' : r.utilization >= 65 ? '#f59e0b' : '#22c55e',
                        }}
                      />
                    </div>
                    <div style={{ fontSize: 12, color: '#374151', textAlign: 'right', fontWeight: 700 }}>{r.utilization}%</div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTopTab === 'apps' && (
          <div style={{ marginTop: 8, border: '1px solid #e8ecf2', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
            <div style={{ height: 44, borderBottom: '1px solid #edf1f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Apps</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>Configure integrations used by resource management</div>
            </div>
            <div style={{ padding: 12, display: 'grid', gap: 10 }}>
              {[
                { id: 'darwinbox', name: 'Darwinbox sync', desc: 'Sync timesheet metadata and allocation tags.' },
                { id: 'timesheets', name: 'Timesheet tracker', desc: 'Use logged hours for busy/free coloring.' },
                { id: 'webhooks', name: 'Webhook intake', desc: 'Capture external staffing events and updates.' },
              ].map((app) => (
                <div key={app.id} style={{ border: '1px solid #eef2f7', borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 13, color: '#111827', fontWeight: 700 }}>{app.name}</div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>{app.desc}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setAppsState((prev) => ({
                        ...prev,
                        [app.id]: !prev[app.id],
                      }))
                    }
                    style={{
                      height: 28,
                      minWidth: 74,
                      borderRadius: 999,
                      border: '1px solid #e5e7eb',
                      background: appsState[app.id] ? '#111827' : '#fff',
                      color: appsState[app.id] ? '#fff' : '#111827',
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '0 10px',
                    }}
                  >
                    {appsState[app.id] ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTopTab === 'people' && (
          <div style={{ marginTop: 8, display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, color: '#6b7280' }}>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#dcfce7', marginRight: 4 }} /> Free</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#fef3c7', marginRight: 4 }} /> Assigned</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#fee2e2', marginRight: 4 }} /> Busy (hours logged)</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#e5e7eb', marginRight: 4 }} /> Past with work (blocked)</span>
          </div>
        )}
      </div>

      {drawer.open && drawer.user && (
        <>
          <div
            role="button"
            tabIndex={0}
            onClick={closeDrawer}
            onKeyDown={(e) => {
              if (e.key === 'Escape') closeDrawer();
            }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.38)', zIndex: 40 }}
          />
          <aside
            style={{
              position: 'fixed',
              right: 0,
              top: 0,
              bottom: 0,
              width: 360,
              maxWidth: '92vw',
              background: '#fff',
              borderLeft: '1px solid #e5e7eb',
              zIndex: 50,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ height: 64, padding: '12px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Avatar name={drawer.user.name} size={30} />
                <div>
                  <div style={{ fontSize: 14, color: '#111827', fontWeight: 700 }}>{drawer.user.name}</div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>{drawer.user.role}</div>
                </div>
              </div>
              <button type="button" onClick={closeDrawer} style={{ border: 0, background: 'transparent', fontSize: 20, lineHeight: 1, color: '#9ca3af', cursor: 'pointer' }}>
                ×
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>Dates</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <select
                  value={drawer.startWeek}
                  onChange={(e) => setDrawer((prev) => ({ ...prev, startWeek: e.target.value }))}
                  style={{ height: 34, border: '1px solid #e5e7eb', borderRadius: 8, padding: '0 8px', fontSize: 12 }}
                >
                  {weeks.map((wk, idx) => (
                    <option key={idx} value={weekKey(wk)}>
                      {weekLabel(wk)}
                    </option>
                  ))}
                </select>
                <select
                  value={drawer.endWeek}
                  onChange={(e) => setDrawer((prev) => ({ ...prev, endWeek: e.target.value }))}
                  style={{ height: 34, border: '1px solid #e5e7eb', borderRadius: 8, padding: '0 8px', fontSize: 12 }}
                >
                  {weeks.map((wk, idx) => (
                    <option key={idx} value={weekKey(wk)}>
                      {weekLabel(wk)}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>
                Total weeks:{' '}
                <strong style={{ color: '#111827' }}>
                  {Math.max(0, weeksBetweenInclusive(drawer.startWeek, drawer.endWeek).length)}
                </strong>
              </div>

              <div style={{ marginTop: 14, fontSize: 11, color: '#6b7280', marginBottom: 6 }}>Project</div>
              {!drawer.createNewProject ? (
                <>
                  <select
                    value={drawer.projectId}
                    onChange={(e) => {
                      const selectedProject = projects.find((p) => p._id === e.target.value);
                      setDrawer((prev) => ({
                        ...prev,
                        projectId: e.target.value,
                        projectName: selectedProject?.name || '',
                      }));
                    }}
                    style={{ width: '100%', height: 34, border: '1px solid #e5e7eb', borderRadius: 8, padding: '0 8px', fontSize: 12 }}
                  >
                    {projects.length === 0 ? (
                      <option value="">No projects available</option>
                    ) : (
                      projects.map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.name}
                        </option>
                      ))
                    )}
                  </select>
                  <button
                    type="button"
                    onClick={() => setDrawer((prev) => ({ ...prev, createNewProject: true, error: '' }))}
                    style={{
                      marginTop: 6,
                      border: 0,
                      background: 'transparent',
                      color: '#7c3aed',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    + New project
                  </button>
                </>
              ) : (
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, background: '#fafafa' }}>
                  <input
                    value={drawer.newProjectName}
                    onChange={(e) => setDrawer((prev) => ({ ...prev, newProjectName: e.target.value }))}
                    placeholder="Project name"
                    style={{ width: '100%', height: 32, border: '1px solid #e5e7eb', borderRadius: 8, padding: '0 8px', fontSize: 12, marginBottom: 6 }}
                  />
                  <input
                    value={drawer.newClientName}
                    onChange={(e) => setDrawer((prev) => ({ ...prev, newClientName: e.target.value }))}
                    placeholder="Client name"
                    style={{ width: '100%', height: 32, border: '1px solid #e5e7eb', borderRadius: 8, padding: '0 8px', fontSize: 12, marginBottom: 6 }}
                  />
                  <input
                    value={drawer.newContractValue}
                    onChange={(e) => setDrawer((prev) => ({ ...prev, newContractValue: e.target.value.replace(/[^\d.]/g, '') }))}
                    placeholder="Contract value"
                    style={{ width: '100%', height: 32, border: '1px solid #e5e7eb', borderRadius: 8, padding: '0 8px', fontSize: 12 }}
                  />
                  <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setDrawer((prev) => ({ ...prev, createNewProject: false, error: '' }))}
                      style={{ height: 30, borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#111827', fontSize: 11, fontWeight: 700, padding: '0 10px' }}
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={createProjectInline}
                      disabled={projectCreating}
                      style={{ height: 30, borderRadius: 8, border: 0, background: '#111827', color: '#fff', fontSize: 11, fontWeight: 700, padding: '0 10px', opacity: projectCreating ? 0.65 : 1 }}
                    >
                      {projectCreating ? 'Creating...' : 'Create project'}
                    </button>
                  </div>
                </div>
              )}

              <div style={{ marginTop: 14, fontSize: 11, color: '#6b7280', marginBottom: 6 }}>Allocation method</div>
              <div style={{ width: '100%', height: 34, border: '1px solid #e5e7eb', borderRadius: 8, padding: '0 10px', fontSize: 12, display: 'flex', alignItems: 'center', color: '#111827' }}>
                Hours per week
              </div>

              <div style={{ marginTop: 14, fontSize: 11, color: '#6b7280', marginBottom: 6 }}>Hours per week to allocate</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  value={drawer.hoursPerWeek}
                  onChange={(e) => setDrawer((prev) => ({ ...prev, hoursPerWeek: e.target.value.replace(/[^\d.]/g, '') }))}
                  style={{ flex: 1, height: 34, border: '1px solid #e5e7eb', borderRadius: 8, padding: '0 10px', fontSize: 12 }}
                  placeholder="40"
                />
                <span style={{ fontSize: 12, color: '#6b7280' }}>hours/week</span>
              </div>
              <div style={{ marginTop: 6, fontSize: 11, color: '#6b7280' }}>
                Total allocation:{' '}
                <strong style={{ color: '#111827' }}>
                  {Math.round((Number(drawer.hoursPerWeek) || 0) * weeksBetweenInclusive(drawer.startWeek, drawer.endWeek).length)}h
                </strong>
              </div>

              {drawer.error ? (
                <div style={{ marginTop: 12, border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', borderRadius: 8, padding: '8px 10px', fontSize: 12 }}>
                  {drawer.error}
                </div>
              ) : null}

              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Planned allocations</div>
                {userDrawerPlans.length === 0 ? (
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>No manually planned projects yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {userDrawerPlans.map((p) => (
                      <div key={p.id} style={{ border: '1px solid #ede9fe', background: '#faf5ff', borderRadius: 8, padding: '6px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12, color: '#4c1d95', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.projectName}</div>
                          <div style={{ fontSize: 10, color: '#6b7280' }}>
                            {weekLabel(weekDateFromKey(p.startWeek))} to {weekLabel(weekDateFromKey(p.endWeek))} - {Number(p.hoursPerWeek) || 0}h/w
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAllocation(p.id)}
                          style={{ border: 0, background: 'transparent', color: '#7c3aed', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div style={{ height: 64, borderTop: '1px solid #f3f4f6', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                onClick={closeDrawer}
                style={{ height: 36, borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', color: '#111827', fontSize: 12, fontWeight: 600, padding: '0 14px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={savePlan}
                disabled={savingPlan}
                style={{ height: 36, borderRadius: 10, border: 0, background: '#111827', color: '#fff', fontSize: 12, fontWeight: 700, padding: '0 16px', opacity: savingPlan ? 0.7 : 1 }}
              >
                {savingPlan ? 'Saving...' : 'Done'}
              </button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
