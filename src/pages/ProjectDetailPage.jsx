import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { projectsAPI, modulesAPI, workstreamsAPI, aiAPI, usersAPI, financialAPI, darwinboxAPI, reviewsAPI, governanceAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import CommandCentre from '../components/CommandCentre';
import AuditTrailPage from './admin/AuditTrailPage';
import AIInsightCard from '../components/AIInsightCard';
import ClientSentimentPanel from '../components/ClientSentimentPanel';
import RAIDLog from '../components/RAIDLog';
import LoadingScreen from '../components/LoadingScreen';
import ModuleStatusMatrix from '../components/ModuleStatusMatrix';
import KanbanBoard, { KanbanColumn, KanbanCard, StatusDot } from '../components/board/KanbanBoard';

const PROJECT_REGIONS = ['India', 'SEA', 'MEA', 'Americas', 'Other'];

const VIEW_PREF_KEY = 'beagle.projectModulesView';

function fmtShortDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

/** Map module/workstream status string → board accent + StatusDot prop. */
function deriveStatusTone(stats, signOffStatus) {
  if (signOffStatus === 'Signed Off') return { dot: 'done', accent: 'success', tone: 'success' };
  if (stats?.overdueTasks > 0) return { dot: 'blocked', accent: 'risk', tone: 'risk' };
  if ((stats?.progress ?? 0) >= 100) return { dot: 'done', accent: 'success', tone: 'success' };
  if ((stats?.progress ?? 0) > 0) return { dot: 'in_progress', accent: 'link', tone: 'link' };
  return { dot: 'todo', accent: 'link', tone: 'success' };
}

function formatINR(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(n));
}

function formatRelativeTime(iso) {
  if (!iso) return null;
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

const EMPTY_MODULE = { name: '', budgetHours: '' };

const EMPTY_CLONE_FORM = {
  sourceProjectId: '',
  name: '',
  clientName: '',
  goLiveDate: '',
  contractValue: '',
  implementationFee: '',
  region: 'India',
  notionalARR: '0',
  tier: 'Tier 2',
  sharePointUrl: '',
  accountPlaybookUrl: '',
  csResourceName: '',
};

export default function ProjectDetailPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  /** Roles that see Module 5 AI panel (matches expanded backend staff guard). */
  const isPmTeam =
    isAdmin ||
    user?.role === 'dh' ||
    user?.role === 'member' ||
    user?.role === 'pm' ||
    user?.role === 'pmo' ||
    user?.role === 'exec';
  /** Financial AI cards — backend: admin, pmo, dh, pm. */
  const isFinanceAi = isAdmin || user?.role === 'dh' || user?.role === 'pm' || user?.role === 'pmo';
  const canViewModuleDeliveryStatus = ['admin', 'pmo', 'dh', 'pm', 'exec'].includes(user?.role);
  /** Backend POST /api/modules requires admin or dh — keep UI in sync. */
  const canCreateModule = isAdmin || user?.role === 'dh';
  const canDeleteModule = isAdmin || user?.role === 'dh';

  const [project, setProject] = useState(null);
  const [allProjects, setAllProjects] = useState([]);
  const [staffUsers, setStaffUsers] = useState([]);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [moduleView, setModuleView] = useState(() => {
    try {
      return localStorage.getItem(VIEW_PREF_KEY) || 'board';
    } catch {
      return 'board';
    }
  });
  const [moduleWorkstreams, setModuleWorkstreams] = useState({}); // moduleId -> { loading, error, items }
  const [showModuleModal, setShowModuleModal] = useState(false);
  const [moduleForm, setModuleForm] = useState(EMPTY_MODULE);
  const [saving, setSaving] = useState(false);
  const [adminForm, setAdminForm] = useState({
    sharePointUrl: '',
    deliveryHeadId: '',
    projectManagerId: '',
    contractValue: '',
    implementationFee: '',
    region: 'India',
    notionalARR: '',
    tier: 'Tier 2',
    accountPlaybookUrl: '',
    csResourceName: '',
  });
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneForm, setCloneForm] = useState(EMPTY_CLONE_FORM);
  const [savingClone, setSavingClone] = useState(false);

  // AI Insights state
  const [riskData, setRiskData] = useState(null);
  const [loadingRisk, setLoadingRisk] = useState(false);
  
  // Chat state
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [detailTab, setDetailTab] = useState('overview');
  const [financial, setFinancial] = useState(null);
  const [darwinboxSyncing, setDarwinboxSyncing] = useState(false);
  const [nonSubmitters, setNonSubmitters] = useState([]);
  const [onLeaveSubmitters, setOnLeaveSubmitters] = useState([]);

  const [pmScore, setPmScore] = useState(null);
  const [pmScoreLoading, setPmScoreLoading] = useState(false);
  const [marginForecast, setMarginForecast] = useState(null);
  const [marginForecastLoading, setMarginForecastLoading] = useState(false);
  const [overload, setOverload] = useState(null);
  const [overloadLoading, setOverloadLoading] = useState(false);
  const [escalation, setEscalation] = useState(null);
  const [escalationLoading, setEscalationLoading] = useState(false);
  const [scopeEmail, setScopeEmail] = useState('');
  const [scopeResult, setScopeResult] = useState(null);
  const [scopeLoading, setScopeLoading] = useState(false);
  const [showScopeCrModal, setShowScopeCrModal] = useState(false);
  const [narrativeAud, setNarrativeAud] = useState('pm');
  const [narrativeData, setNarrativeData] = useState(null);
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [narrativeApproving, setNarrativeApproving] = useState(false);
  const [govReviews, setGovReviews] = useState([]);
  const [govCompliance, setGovCompliance] = useState(null);
  const [govLoading, setGovLoading] = useState(false);

  const pmOwnsProject =
    user?.role === 'pm' &&
    project &&
    String(project.projectManagerId?._id || project.projectManagerId || '') === String(user?._id || '');
  /** Financials, governance tab, timesheets/Darwinbox — PM only on projects they manage (matches API). */
  const canOpsData = isAdmin || user?.role === 'dh' || pmOwnsProject;

  const fetchAll = useCallback(async () => {
    try {
      const [projRes, modRes] = await Promise.all([
        projectsAPI.getById(projectId),
        modulesAPI.getByProject(projectId),
      ]);
      setProject(projRes.data);
      setModules(modRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Persist board/list preference
  useEffect(() => {
    try {
      localStorage.setItem(VIEW_PREF_KEY, moduleView);
    } catch { /* ignore */ }
  }, [moduleView]);

  // Fetch workstreams per module when the board view is active so each
  // column can show workstream cards (mirrors the Rocketlane phase board).
  useEffect(() => {
    if (moduleView !== 'board' || !modules.length) return;
    let cancelled = false;
    const idsToLoad = modules
      .map((m) => m._id)
      .filter((id) => !moduleWorkstreams[id] || moduleWorkstreams[id].stale);
    if (idsToLoad.length === 0) return;

    setModuleWorkstreams((prev) => {
      const next = { ...prev };
      idsToLoad.forEach((id) => { next[id] = { loading: true, error: null, items: prev[id]?.items || [] }; });
      return next;
    });

    Promise.all(
      idsToLoad.map((id) =>
        workstreamsAPI
          .getByModule(id)
          .then((r) => ({ id, items: r.data || [], error: null }))
          .catch((e) => ({ id, items: [], error: e?.response?.data?.message || 'Failed to load workstreams' }))
      )
    ).then((results) => {
      if (cancelled) return;
      setModuleWorkstreams((prev) => {
        const next = { ...prev };
        results.forEach((r) => { next[r.id] = { loading: false, error: r.error, items: r.items }; });
        return next;
      });
    });

    return () => { cancelled = true; };
  }, [moduleView, modules]);

  useEffect(() => {
    if (!projectId || !canOpsData) {
      setFinancial(null);
      return;
    }
    financialAPI
      .getProject(projectId)
      .then(({ data }) => setFinancial(data))
      .catch(() => setFinancial(null));
  }, [projectId, canOpsData]);

  const loadGovernanceData = useCallback(async () => {
    if (!projectId || !canOpsData) return;
    setGovLoading(true);
    try {
      const [revRes, compRes] = await Promise.all([
        reviewsAPI.list(projectId),
        governanceAPI.compliance(projectId),
      ]);
      setGovReviews(Array.isArray(revRes.data) ? revRes.data : []);
      setGovCompliance(compRes.data);
    } catch {
      setGovReviews([]);
      setGovCompliance(null);
    } finally {
      setGovLoading(false);
    }
  }, [projectId, canOpsData]);

  useEffect(() => {
    if (detailTab !== 'governance' || !canOpsData) return;
    loadGovernanceData();
  }, [detailTab, canOpsData, loadGovernanceData]);

  useEffect(() => {
    if (!projectId || !canOpsData || detailTab !== 'timesheets') return;
    darwinboxAPI
      .getNonSubmitters(projectId)
      .then(({ data: d }) => {
        setNonSubmitters(Array.isArray(d?.nonSubmitters) ? d.nonSubmitters : []);
        setOnLeaveSubmitters(Array.isArray(d?.onLeave) ? d.onLeave : []);
      })
      .catch(() => {
        setNonSubmitters([]);
        setOnLeaveSubmitters([]);
      });
  }, [projectId, canOpsData, detailTab, project?.lastSyncAt]);

  const handleDarwinboxSync = async () => {
    if (!projectId || !canOpsData) return;
    setDarwinboxSyncing(true);
    try {
      await darwinboxAPI.sync(projectId);
      await fetchAll();
      if (canOpsData) {
        try {
          const fin = await financialAPI.getProject(projectId);
          setFinancial(fin.data);
        } catch {
          /* ignore */
        }
      }
    } catch (e) {
      alert(e.response?.data?.message || 'Darwinbox sync failed');
    } finally {
      setDarwinboxSyncing(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    usersAPI
      .getAll()
      .then(({ data }) => setStaffUsers(Array.isArray(data) ? data : []))
      .catch(() => setStaffUsers([]));
    projectsAPI
      .getAll()
      .then(({ data }) => setAllProjects(Array.isArray(data) ? data : []))
      .catch(() => setAllProjects([]));
  }, [isAdmin]);

  useEffect(() => {
    if (!project) return;
    setAdminForm({
      sharePointUrl: project.sharePointUrl || '',
      deliveryHeadId: project.deliveryHeadId?._id || project.deliveryHeadId || '',
      projectManagerId: project.projectManagerId?._id || project.projectManagerId || '',
      contractValue: String(project.contractValue ?? ''),
      implementationFee: String(
        project.implementationFee != null && project.implementationFee !== ''
          ? project.implementationFee
          : project.contractValue ?? ''
      ),
      region: project.region || 'India',
      notionalARR: String(project.notionalARR ?? 0),
      tier: project.tier || 'Tier 2',
      accountPlaybookUrl: project.accountPlaybookUrl || '',
      csResourceName: project.csResourceName || '',
    });
  }, [project]);

  const deliveryHeadOptions = staffUsers.filter((u) => u.role === 'admin' || u.role === 'dh');
  const pmOptions = staffUsers.filter((u) => u.role === 'admin' || u.role === 'member');

  const handleStatusChange = async (e) => {
    const newStatus = e.target.value;
    const prev = project.status;
    setProject((p) => ({ ...p, status: newStatus }));
    try {
      const { data } = await projectsAPI.update(projectId, { status: newStatus });
      setProject(data);
    } catch (err) {
      setProject((p) => ({ ...p, status: prev }));
      alert(err.response?.data?.message || 'Failed to update status');
    }
  };

  const handleSaveAdminFields = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    setSavingAdmin(true);
    try {
      const payload = {
        sharePointUrl: adminForm.sharePointUrl,
        deliveryHeadId: adminForm.deliveryHeadId || null,
        projectManagerId: adminForm.projectManagerId || null,
        tier: adminForm.tier,
        accountPlaybookUrl: adminForm.accountPlaybookUrl,
        csResourceName: adminForm.csResourceName,
        region: adminForm.region,
      };
      if (!project.baselineLocked) {
        payload.contractValue = Number(adminForm.contractValue);
        payload.notionalARR = Number(adminForm.notionalARR) || 0;
        payload.implementationFee = Number(adminForm.implementationFee) || 0;
      }
      const { data } = await projectsAPI.update(projectId, payload);
      setProject(data);
      if (canOpsData) {
        try {
          const fin = await financialAPI.getProject(projectId);
          setFinancial(fin.data);
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save');
    } finally {
      setSavingAdmin(false);
    }
  };

  const openCloneModal = () => {
    const firstOther =
      allProjects.find((p) => p._id !== projectId) || allProjects[0] || null;
    setCloneForm({
      ...EMPTY_CLONE_FORM,
      sourceProjectId: firstOther?._id || '',
      name: `${project?.name || 'Project'} (copy)`,
      clientName: project?.clientName || '',
      implementationFee: String(
        project?.implementationFee != null && project?.implementationFee !== ''
          ? project.implementationFee
          : project?.contractValue ?? ''
      ),
      region: project?.region || 'India',
    });
    setShowCloneModal(true);
  };

  const handleCloneSubmit = async (e) => {
    e.preventDefault();
    if (!cloneForm.sourceProjectId || !cloneForm.name.trim()) {
      alert('Select a source project and enter a name.');
      return;
    }
    setSavingClone(true);
    try {
      const { data } = await projectsAPI.clone(cloneForm.sourceProjectId, {
        name: cloneForm.name.trim(),
        clientName: cloneForm.clientName.trim(),
        goLiveDate: cloneForm.goLiveDate,
        contractValue: Number(cloneForm.contractValue),
        implementationFee:
          cloneForm.implementationFee !== ''
            ? Number(cloneForm.implementationFee)
            : Number(cloneForm.contractValue),
        region: cloneForm.region || 'India',
        notionalARR: Number(cloneForm.notionalARR) || 0,
        tier: cloneForm.tier,
        sharePointUrl: cloneForm.sharePointUrl,
        accountPlaybookUrl: cloneForm.accountPlaybookUrl,
        csResourceName: cloneForm.csResourceName,
        status: 'Draft',
      });
      setShowCloneModal(false);
      setCloneForm(EMPTY_CLONE_FORM);
      navigate(`/projects/${data._id}`);
    } catch (err) {
      alert(err.response?.data?.message || 'Clone failed');
    } finally {
      setSavingClone(false);
    }
  };

  const handleAddModule = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await modulesAPI.create({
        name: moduleForm.name,
        budgetHours: Number(moduleForm.budgetHours),
        projectId,
      });
      setShowModuleModal(false);
      setModuleForm(EMPTY_MODULE);
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add module');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteModule = async (e, moduleId) => {
    e.stopPropagation();
    if (!window.confirm('Delete this module and all its workstreams and tasks?')) return;
    await modulesAPI.delete(moduleId);
    fetchAll();
  };

  // Fetch AI Risk Analysis
  const handleRefreshRisk = async () => {
    setLoadingRisk(true);
    try {
      const res = await aiAPI.getProjectRisk(projectId);
      setRiskData(res.data);
    } catch (err) {
      console.error('Failed to load risk analysis:', err);
      setRiskData({ error: 'Failed to load AI analysis' });
    } finally {
      setLoadingRisk(false);
    }
  };

  // Handle chat question
  const handleAskQuestion = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = chatInput;
    setChatInput('');
    setChatHistory([...chatHistory, { role: 'user', text: userMsg }]);
    setChatLoading(true);

    try {
      const res = await aiAPI.askQuestion(projectId, userMsg);
      setChatHistory((prev) => [...prev, { role: 'ai', text: res.data.answer }]);
    } catch (err) {
      console.error('Chat error:', err);
      setChatHistory((prev) => [...prev, { role: 'ai', text: 'Failed to get response. Please try again.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  const loadPmScore = async () => {
    setPmScoreLoading(true);
    try {
      const { data } = await aiAPI.getPmScore(projectId);
      setPmScore(data);
    } catch {
      setPmScore(null);
    } finally {
      setPmScoreLoading(false);
    }
  };

  const loadMarginForecast = async () => {
    setMarginForecastLoading(true);
    try {
      const { data } = await aiAPI.getMarginForecast(projectId);
      setMarginForecast(data);
    } catch {
      setMarginForecast(null);
    } finally {
      setMarginForecastLoading(false);
    }
  };

  const loadResourceOverload = async () => {
    setOverloadLoading(true);
    try {
      const { data } = await aiAPI.getResourceOverload(projectId);
      setOverload(data);
    } catch {
      setOverload(null);
    } finally {
      setOverloadLoading(false);
    }
  };

  const loadEscalationRisk = async () => {
    setEscalationLoading(true);
    try {
      const { data } = await aiAPI.getEscalationRisk(projectId);
      setEscalation(data);
    } catch {
      setEscalation(null);
    } finally {
      setEscalationLoading(false);
    }
  };

  const runScopeCheck = async () => {
    if (!scopeEmail.trim()) return;
    setScopeLoading(true);
    try {
      const { data } = await aiAPI.postScopeCheck(projectId, scopeEmail.trim());
      setScopeResult(data);
    } catch {
      setScopeResult({ scopeCreepDetected: false, error: true });
    } finally {
      setScopeLoading(false);
    }
  };

  const loadNarrative = async () => {
    setNarrativeLoading(true);
    try {
      const { data } = await aiAPI.getNarrative(projectId, narrativeAud);
      setNarrativeData(data);
      await fetchAll();
    } catch {
      setNarrativeData(null);
    } finally {
      setNarrativeLoading(false);
    }
  };

  const handleApproveClientNarrative = async () => {
    setNarrativeApproving(true);
    try {
      await aiAPI.approveNarrative(projectId);
      await fetchAll();
    } catch (e) {
      alert(e.response?.data?.error || 'Approve failed');
    } finally {
      setNarrativeApproving(false);
    }
  };

  if (loading) return <LoadingScreen title="Loading project workspace" subtitle="Pulling modules, tasks, and AI insights..." />;
  if (!project) return <div className="p-4 text-sm text-risk-500">Project not found.</div>;

  // Aggregate stats
  const totalBudget = modules.reduce((s, m) => s + m.budgetHours, 0);
  const totalLogged = modules.reduce((s, m) => s + m.stats.loggedHours, 0);
  const totalTasks = modules.reduce((s, m) => s + m.stats.totalTasks, 0);
  const completedTasks = modules.reduce((s, m) => s + m.stats.completedTasks, 0);
  const overallProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-ink-400 mb-4">
        <Link to="/projects" className="hover:text-link-500 transition-colors">Projects</Link>
        <span>/</span>
        <span className="text-ink-700 font-medium truncate max-w-xs">{project.name}</span>
      </nav>

      {/* Project header card */}
      <div className="bg-paper border border-ink-200 rounded-md p-5 mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-ink-900">{project.name}</h1>
              {project.baselineLocked && (
                <span className="text-xs font-semibold uppercase tracking-wide bg-success-100 text-success-800 px-2 py-0.5 rounded">
                  Baseline locked
                </span>
              )}
              <span className="text-xs text-ink-500 bg-ink-100 px-2 py-0.5 rounded">
                {project.tier || 'Tier 2'}
              </span>
            </div>
            <p className="text-ink-500 mt-1 text-sm">{project.clientName}</p>
            {project.hubspotDealId && (
              <p className="text-xs text-ink-400 mt-1">HubSpot deal: {project.hubspotDealId}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {isAdmin && (
              <button
                type="button"
                onClick={openCloneModal}
                className="text-xs border border-ink-300 hover:bg-ink-50 text-ink-700 font-medium px-3 py-1.5 rounded-md transition-colors"
              >
                Clone structure
              </button>
            )}
            <select
              value={project.status}
              onChange={handleStatusChange}
              disabled={!isAdmin}
              className="border border-ink-300 rounded-md px-3 py-1.5 text-xs text-ink-700 focus:outline-none focus:ring-2 focus:ring-link-500 shrink-0 disabled:bg-ink-100 disabled:text-ink-500"
            >
              <option>Draft</option>
              <option>Active</option>
              <option>Completed</option>
            </select>
          </div>
        </div>

        {canOpsData && (
          <div className="mt-4 pt-4 border-t border-ink-100 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            {project.darwinboxTagsPushedAt ? (
              <span className="font-medium text-success-700">Darwinbox tags synced ✓</span>
            ) : (
              <span className="text-ink-500">
                Darwinbox tags: push runs when the project becomes Active
              </span>
            )}
            <span className="text-ink-300 hidden sm:inline">|</span>
            <span className="text-ink-700">
              Last Darwinbox sync:{' '}
              {project.lastSyncAt
                ? `${formatRelativeTime(project.lastSyncAt)} · ${project.lastSyncRecords ?? 0} records synced`
                : 'never · 0 records synced'}
            </span>
            <button
              type="button"
              onClick={handleDarwinboxSync}
              disabled={darwinboxSyncing}
              className="text-sm font-medium text-paper bg-ink-800 hover:bg-ink-900 disabled:opacity-50 rounded-md px-3 py-1.5"
            >
              {darwinboxSyncing ? 'Syncing…' : 'Sync now'}
            </button>
          </div>
        )}

        {/* Key info */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-5 pt-5 border-t border-ink-100">
          <div>
            <p className="text-xs text-ink-400 uppercase tracking-wide">Go-Live Date</p>
            <p className="font-semibold text-ink-800 mt-1">
              {new Date(project.goLiveDate).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
            </p>
          </div>
          <div>
            <p className="text-xs text-ink-400 uppercase tracking-wide">Region</p>
            <p className="font-semibold text-ink-800 mt-1">{project.region || 'India'}</p>
          </div>
          <div>
            <p className="text-xs text-ink-400 uppercase tracking-wide">Contract value</p>
            <p className="font-semibold text-ink-800 mt-1">
              {formatINR(project.contractValue)}
            </p>
          </div>
          <div>
            <p className="text-xs text-ink-400 uppercase tracking-wide">Implementation fee (SOW)</p>
            <p className="font-semibold text-ink-800 mt-1">
              {formatINR(
                Number(project.implementationFee) > 0
                  ? project.implementationFee
                  : project.contractValue
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-ink-400 uppercase tracking-wide">Notional ARR</p>
            <p className="font-semibold text-ink-800 mt-1">
              {formatINR(project.notionalARR ?? 0)}
            </p>
          </div>
          <div>
            <p className="text-xs text-ink-400 uppercase tracking-wide">Hour Burn</p>
            <p className="font-semibold text-ink-800 mt-1">
              {totalLogged}h <span className="text-ink-400 font-normal">/ {totalBudget}h</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-ink-400 uppercase tracking-wide">Completion</p>
            <p className="font-semibold text-ink-800 mt-1">{overallProgress}%</p>
          </div>
        </div>

        {/* Overall progress bar */}
        {totalTasks > 0 && (
          <div className="mt-4">
            <div className="h-2 bg-ink-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-link-500 rounded-full transition-all duration-700"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
            <p className="text-xs text-ink-400 mt-1">
              {completedTasks} of {totalTasks} tasks completed
            </p>
          </div>
        )}
      </div>

      {canOpsData && financial && (
        <div className="bg-paper border border-ink-200 rounded-lg p-6 mb-6">
          <h2 className="text-base font-semibold text-ink-800 mb-3">Financial summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-ink-500 uppercase">Margin</p>
              <p className="font-semibold text-ink-900 mt-0.5">
                {financial.marginPercent}% ({formatINR(financial.marginAmount)})
              </p>
            </div>
            <div>
              <p className="text-xs text-ink-500 uppercase">Cost vs fee</p>
              <p className="font-semibold text-ink-900 mt-0.5">
                {formatINR(financial.totalCost)} / {formatINR(financial.implementationFee)}
              </p>
            </div>
            <div>
              <p className="text-xs text-ink-500 uppercase">EAC variance</p>
              <p className="font-semibold text-ink-900 mt-0.5">
                {formatINR(financial.eac)} ({formatINR(financial.eacVariance)} vs contract)
              </p>
            </div>
            <div>
              <p className="text-xs text-ink-500 uppercase">Burn / runway</p>
              <p className="font-semibold text-ink-900 mt-0.5">
                {financial.burnRate}
                {financial.weeksToThreshold != null && (
                  <span className="block text-xs font-normal text-ink-500 mt-0.5">
                    Weeks to margin threshold: {financial.weeksToThreshold}
                  </span>
                )}
              </p>
            </div>
          </div>
          <p className="text-sm text-ink-700 mt-4 pt-4 border-t border-ink-100">
            <span className="font-medium text-success-800">Billable:</span>{' '}
            {formatINR(financial.billableCost)} ({financial.billabilityPercent}%){' '}
            <span className="text-ink-400 mx-1">|</span>{' '}
            <span className="font-medium text-ink-600">Non-billable:</span>{' '}
            {formatINR(financial.nonBillableCost)} (
            {Math.round((100 - financial.billabilityPercent) * 10) / 10}%)
          </p>
        </div>
      )}

      {isPmTeam && (
        <div className="flex gap-0 mb-4 border-b border-ink-200 overflow-x-auto">
          <button
            type="button"
            onClick={() => setDetailTab('overview')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              detailTab === 'overview'
                ? 'border-focus-600 text-focus-700'
                : 'border-transparent text-ink-500 hover:text-ink-700'
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setDetailTab('timesheets')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              detailTab === 'timesheets'
                ? 'border-focus-600 text-focus-700'
                : 'border-transparent text-ink-500 hover:text-ink-700'
            }`}
          >
            Timesheets
          </button>
          <button
            type="button"
            onClick={() => setDetailTab('raid')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              detailTab === 'raid'
                ? 'border-focus-600 text-focus-700'
                : 'border-transparent text-ink-500 hover:text-ink-700'
            }`}
          >
            RAID log
          </button>
          {canOpsData && (
            <button
              type="button"
              onClick={() => setDetailTab('governance')}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                detailTab === 'governance'
                  ? 'border-focus-600 text-focus-700'
                  : 'border-transparent text-ink-500 hover:text-ink-700'
              }`}
            >
              Governance
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={() => setDetailTab('audit')}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                detailTab === 'audit'
                  ? 'border-focus-600 text-focus-700'
                  : 'border-transparent text-ink-500 hover:text-ink-700'
              }`}
            >
              Audit trail
            </button>
          )}
        </div>
      )}

      {isAdmin && detailTab === 'audit' ? (
        <AuditTrailPage projectId={projectId} embedded />
      ) : canOpsData && detailTab === 'governance' ? (
        <div className="space-y-6 mb-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-ink-800">Governance</h2>
            <div className="flex flex-wrap gap-2">
              <Link
                to={`/governance/change-requests/${projectId}`}
                className="text-sm font-medium text-link-600 hover:underline"
              >
                Open change requests →
              </Link>
              <button
                type="button"
                onClick={loadGovernanceData}
                disabled={govLoading}
                className="text-xs border border-ink-300 rounded-md px-2 py-1 hover:bg-ink-50 disabled:opacity-50"
              >
                {govLoading ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
          </div>

          {govCompliance && (
            <div className="bg-paper border border-ink-200 rounded-lg p-5">
              <h3 className="text-sm font-semibold text-ink-900 mb-3">Policy compliance</h3>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-3xl font-bold text-ink-900">{govCompliance.overallScore}</span>
                <span className="text-sm text-ink-500">/ 100 overall</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                {Object.entries(govCompliance.metrics || {}).map(([k, v]) => (
                  <div key={k} className="bg-ink-50 rounded p-2">
                    <p className="text-ink-500 capitalize">{k.replace(/([A-Z])/g, ' $1').trim()}</p>
                    <p className="text-lg font-semibold text-ink-900">{v}</p>
                  </div>
                ))}
              </div>
              {govCompliance.violations?.length > 0 && (
                <ul className="mt-3 text-xs text-caution-900 list-disc pl-4 space-y-1">
                  {govCompliance.violations.map((v, i) => (
                    <li key={i}>{v}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="bg-paper border border-ink-200 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-ink-900 mb-2">Tier 1 review cadence</h3>
            <p className="text-xs text-ink-500 mb-3">
              Upcoming / overdue sessions (auto-scheduled for Tier 1 projects).
            </p>
            {govLoading && !govReviews.length ? (
              <p className="text-sm text-ink-500">Loading…</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-ink-500 border-b">
                    <tr>
                      <th className="py-2 pr-2">Scheduled</th>
                      <th className="py-2 pr-2">Status</th>
                      <th className="py-2 pr-2">Checklist</th>
                      <th className="py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {govReviews.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-4 text-ink-500">
                          No review sessions (non–Tier 1 or not yet scheduled).
                        </td>
                      </tr>
                    ) : (
                      govReviews.map((r) => (
                        <tr key={r._id}>
                          <td className="py-2 pr-2">
                            {new Date(r.scheduledDate).toLocaleDateString('en-IN')}
                          </td>
                          <td className="py-2 pr-2">
                            <span
                              className={`text-xs font-semibold px-1.5 rounded ${
                                r.status === 'Completed'
                                  ? 'bg-success-100 text-success-900'
                                  : r.status === 'Missed'
                                    ? 'bg-risk-100 text-risk-800'
                                    : 'bg-caution-50 text-caution-900'
                              }`}
                            >
                              {r.status}
                            </span>
                          </td>
                          <td className="py-2 pr-2 text-xs text-ink-600">
                            {(r.checklist || []).filter((c) => c.completed).length} /{' '}
                            {(r.checklist || []).length} done
                          </td>
                          <td className="py-2">
                            {r.status === 'Upcoming' && (
                              <button
                                type="button"
                                className="text-xs text-link-600 hover:underline"
                                onClick={async () => {
                                  const checklist = (r.checklist || []).map((c) => ({
                                    ...c,
                                    completed: true,
                                  }));
                                  try {
                                    await reviewsAPI.complete(r._id, { checklist, notes: 'Marked complete from project governance tab.' });
                                    loadGovernanceData();
                                  } catch (e) {
                                    alert(e.response?.data?.error || 'Complete failed');
                                  }
                                }}
                              >
                                Mark complete
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : isPmTeam && detailTab === 'raid' ? (
        <div className="mb-8">
          <RAIDLog projectId={projectId} />
        </div>
      ) : canOpsData && detailTab === 'timesheets' ? (
        <div className="space-y-6 mb-8">
          <div className="bg-paper border border-ink-200 rounded-lg p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="text-base font-semibold text-ink-800">Darwinbox (mock) — non-submission</h2>
              <button
                type="button"
                onClick={handleDarwinboxSync}
                disabled={darwinboxSyncing}
                className="text-sm font-medium bg-ink-800 text-paper rounded-md px-3 py-1.5 hover:bg-ink-900 disabled:opacity-50"
              >
                {darwinboxSyncing ? 'Syncing…' : 'Sync now'}
              </button>
            </div>
            <p className="text-xs text-ink-500 mb-4">
              Mock integration (Module 3). Non-submitters exclude people currently on approved leave; those on leave
              appear below with an On leave tag.
            </p>
            <div className="overflow-x-auto border border-ink-100 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-ink-50 text-left text-xs text-ink-500 uppercase">
                  <tr>
                    <th className="px-3 py-2">Employee</th>
                    <th className="px-3 py-2">Module</th>
                    <th className="px-3 py-2">Workstream</th>
                    <th className="px-3 py-2">Last submission</th>
                    <th className="px-3 py-2">Days overdue</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {nonSubmitters.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-ink-500">
                        No active non-submitters (mock).
                      </td>
                    </tr>
                  ) : (
                    nonSubmitters.map((r) => (
                      <tr key={`${r.employeeId}-${r.module}-${r.workstream}`}>
                        <td className="px-3 py-2 font-medium text-ink-900">
                          {r.name}{' '}
                          <span className="text-xs font-normal text-ink-500">({r.employeeId})</span>
                        </td>
                        <td className="px-3 py-2 text-ink-700">{r.module}</td>
                        <td className="px-3 py-2 text-ink-700">{r.workstream}</td>
                        <td className="px-3 py-2 text-ink-600">{r.lastSubmission || '—'}</td>
                        <td className="px-3 py-2 text-ink-600">{r.daysOverdue}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {onLeaveSubmitters.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-ink-700 mb-2">On leave (excluded from overdue list)</h3>
                <ul className="text-sm text-ink-600 space-y-1">
                  {onLeaveSubmitters.map((r) => (
                    <li key={`leave-${r.employeeId}`}>
                      <span className="font-medium text-ink-800">{r.name}</span>{' '}
                      <span className="text-xs bg-accent-100 text-accent-800 px-1.5 py-0.5 rounded">On leave</span>
                      <span className="text-ink-400 mx-1">·</span>
                      {r.module} / {r.workstream}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
      {(isAdmin || user?.role === 'dh') && <CommandCentre projectId={projectId} />}

      {/* Admin: SharePoint, staffing, financials (FR-M1-07, FR-M1-08, FR-M1-10) */}
      {isAdmin && (
        <div className="bg-paper border border-ink-200 rounded-lg p-6 mb-6">
          <h2 className="text-base font-semibold text-ink-800 mb-4">Delivery setup</h2>
          <form onSubmit={handleSaveAdminFields} className="space-y-4 max-w-2xl">
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1.5">SharePoint</label>
              <input
                type="url"
                placeholder="https://..."
                className="w-full border border-ink-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-link-500 focus:border-transparent"
                value={adminForm.sharePointUrl}
                onChange={(e) => setAdminForm((f) => ({ ...f, sharePointUrl: e.target.value }))}
              />
              {adminForm.sharePointUrl?.startsWith('https://') && (
                <a
                  href={adminForm.sharePointUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-link-600 hover:underline mt-1 inline-block"
                >
                  Open SharePoint →
                </a>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1.5">
                  Delivery Head <span className="text-risk-500">*</span>
                </label>
                <select
                  className="w-full border border-ink-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-link-500 focus:border-transparent"
                  value={adminForm.deliveryHeadId}
                  onChange={(e) =>
                    setAdminForm((f) => ({ ...f, deliveryHeadId: e.target.value }))
                  }
                >
                  <option value="">Select…</option>
                  {deliveryHeadOptions.map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.name} ({u.role})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-ink-400 mt-1">Required before setting status to Active.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1.5">
                  Project Manager <span className="text-risk-500">*</span>
                </label>
                <select
                  className="w-full border border-ink-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-link-500 focus:border-transparent"
                  value={adminForm.projectManagerId}
                  onChange={(e) =>
                    setAdminForm((f) => ({ ...f, projectManagerId: e.target.value }))
                  }
                >
                  <option value="">Select…</option>
                  {pmOptions.map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.name} ({u.role})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-ink-400 mt-1">Required before setting status to Active.</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1.5">Project tier</label>
              <select
                className="w-full border border-ink-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-link-500 focus:border-transparent"
                value={adminForm.tier}
                onChange={(e) => setAdminForm((f) => ({ ...f, tier: e.target.value }))}
              >
                <option>Tier 1</option>
                <option>Tier 2</option>
                <option>Tier 3</option>
              </select>
            </div>

            {adminForm.tier === 'Tier 1' && (
              <div className="space-y-3 border border-caution-100 bg-caution-50/40 rounded-md p-3">
                <div>
                  <label className="block text-xs font-medium text-ink-600 mb-1.5">
                    Account playbook URL <span className="text-risk-500">*</span>
                  </label>
                  <input
                    type="url"
                    className="w-full border border-ink-300 rounded-md px-3 py-2 text-sm"
                    value={adminForm.accountPlaybookUrl}
                    onChange={(e) =>
                      setAdminForm((f) => ({ ...f, accountPlaybookUrl: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-600 mb-1.5">
                    CS resource name <span className="text-risk-500">*</span>
                  </label>
                  <input
                    className="w-full border border-ink-300 rounded-md px-3 py-2 text-sm"
                    value={adminForm.csResourceName}
                    onChange={(e) =>
                      setAdminForm((f) => ({ ...f, csResourceName: e.target.value }))
                    }
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1.5">Region</label>
                <select
                  className="w-full border border-ink-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-link-500 focus:border-transparent"
                  value={adminForm.region}
                  onChange={(e) => setAdminForm((f) => ({ ...f, region: e.target.value }))}
                >
                  {PROJECT_REGIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1.5">
                  Implementation fee (SOW, INR){' '}
                  {project.baselineLocked && (
                    <span className="text-ink-400 font-normal">(locked)</span>
                  )}
                </label>
                <input
                  type="number"
                  min="0"
                  disabled={project.baselineLocked}
                  className="w-full border border-ink-300 rounded-md px-3 py-2 text-sm disabled:bg-ink-100"
                  value={adminForm.implementationFee}
                  onChange={(e) =>
                    setAdminForm((f) => ({ ...f, implementationFee: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1.5">
                  Contract value (INR){' '}
                  {project.baselineLocked && (
                    <span className="text-ink-400 font-normal">(locked)</span>
                  )}
                </label>
                <input
                  type="number"
                  min="0"
                  disabled={project.baselineLocked}
                  className="w-full border border-ink-300 rounded-md px-3 py-2 text-sm disabled:bg-ink-100"
                  value={adminForm.contractValue}
                  onChange={(e) =>
                    setAdminForm((f) => ({ ...f, contractValue: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1.5">
                  Notional ARR (INR){' '}
                  {project.baselineLocked && (
                    <span className="text-ink-400 font-normal">(locked)</span>
                  )}
                </label>
                <input
                  type="number"
                  min="0"
                  disabled={project.baselineLocked}
                  className="w-full border border-ink-300 rounded-md px-3 py-2 text-sm disabled:bg-ink-100"
                  value={adminForm.notionalARR}
                  onChange={(e) =>
                    setAdminForm((f) => ({ ...f, notionalARR: e.target.value }))
                  }
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingAdmin}
              className="bg-link-600 hover:bg-link-700 text-paper text-sm font-medium px-4 py-2 rounded-md disabled:opacity-50"
            >
              {savingAdmin ? 'Saving…' : 'Save delivery setup'}
            </button>
          </form>
        </div>
      )}

      {/* AI Insights Panel (Module 5) — lazy-load each analysis on demand */}
      {isPmTeam && (
        <div className="bg-gradient-to-br from-accent-50 to-link-50 border border-accent-200 rounded-lg p-6 mb-6 space-y-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg" aria-hidden>
                ✨
              </span>
              <div>
                <h3 className="font-semibold text-ink-900">AI Insights</h3>
                <p className="text-[11px] text-ink-500">
                  Uses Groq when <code className="rounded bg-paper/80 px-1">GROQ_API_KEY</code> is set;
                  otherwise UDIP rule-based summaries from your live data.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRefreshRisk}
              disabled={loadingRisk}
              className="shrink-0 self-start text-sm bg-paper border border-accent-200 hover:bg-accent-50 text-ink-700 px-3 py-1.5 rounded-md transition-colors disabled:opacity-50 sm:self-center"
            >
              {loadingRisk ? 'Analyzing...' : 'Refresh risk'}
            </button>
          </div>

          {loadingRisk && !riskData && (
            <div className="text-sm text-ink-500">Click Refresh risk to load project risk.</div>
          )}

          {riskData && !riskData.error && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div
                  className={`px-3 py-1.5 rounded-full font-bold text-paper text-sm ${
                    riskData.riskLevel === 'Critical'
                      ? 'bg-risk-600'
                      : riskData.riskLevel === 'High'
                        ? 'bg-caution-600'
                        : riskData.riskLevel === 'Medium'
                          ? 'bg-caution-600'
                          : 'bg-success-600'
                  }`}
                >
                  {riskData.riskScore}/100 - {riskData.riskLevel}
                </div>
                <span className="text-xs text-ink-600">Risk score</span>
              </div>
              {riskData.topRisks && riskData.topRisks.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-ink-700 mb-2">Top risks</p>
                  <ul className="space-y-1">
                    {riskData.topRisks.map((risk, idx) => (
                      <li key={idx} className="text-sm text-ink-600 flex gap-2">
                        <span className="text-risk-500">•</span>
                        <span>{risk}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {riskData.recommendation && (
                <div className="bg-paper bg-opacity-70 rounded p-3 border-l-4 border-link-500">
                  <p className="text-xs font-semibold text-ink-700 mb-1">Recommendation</p>
                  <p className="text-sm text-ink-600">{riskData.recommendation}</p>
                </div>
              )}
            </div>
          )}
          {riskData?.error && <div className="text-sm text-risk-600">{riskData.error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-accent-100">
            <AIInsightCard
              title="PM discipline score"
              description="Owners, overdue, sign-offs, audit cadence (admin)."
              onRun={loadPmScore}
              loading={pmScoreLoading}
              adminOnly
              isAdmin={isAdmin}
            >
              {pmScore && (
                <div className="text-sm space-y-1 mt-2">
                  <p className="font-bold text-ink-900">
                    {pmScore.disciplineScore}/100 — Grade {pmScore.grade}
                  </p>
                  <p className="text-xs text-ink-600">{pmScore.summary}</p>
                  {pmScore.positives?.length > 0 && (
                    <p className="text-xs text-success-700">+ {pmScore.positives.join('; ')}</p>
                  )}
                  {pmScore.improvements?.length > 0 && (
                    <p className="text-xs text-caution-800">△ {pmScore.improvements.join('; ')}</p>
                  )}
                </div>
              )}
            </AIInsightCard>

            {isFinanceAi && (
              <AIInsightCard
                title="Margin forecast"
                description="AI + financials; warns if margin may breach threshold."
                onRun={loadMarginForecast}
                loading={marginForecastLoading}
              >
                {marginForecast && (
                  <div className="mt-2 space-y-2">
                    {(marginForecast.projectedMargin ?? 100) < 20 && (
                      <div
                        className={`text-xs font-semibold px-2 py-1 rounded ${
                          (marginForecast.projectedMargin ?? 0) < 10
                            ? 'bg-risk-100 text-risk-800'
                            : 'bg-caution-100 text-caution-900'
                        }`}
                      >
                        Projected margin {marginForecast.projectedMargin}% is below 20% — review burn.
                      </div>
                    )}
                    <p className="text-xs text-ink-700">
                      Current {marginForecast.currentMargin}% → projected {marginForecast.projectedMargin}% ·{' '}
                      {marginForecast.severity} severity
                    </p>
                    <p className="text-xs text-ink-600">{marginForecast.recommendation}</p>
                  </div>
                )}
              </AIInsightCard>
            )}

            {isFinanceAi && (
              <AIInsightCard
                title="Resource overload"
                description="Assigned task load vs nominal capacity."
                onRun={loadResourceOverload}
                loading={overloadLoading}
              >
                {overload && (
                  <ul className="mt-2 text-xs space-y-1">
                    {(overload.overloadedResources || []).map((r, i) => (
                      <li key={i} className="flex flex-wrap gap-1 items-center">
                        <span className="font-medium text-ink-800">{r.name}</span>
                        <span className="text-risk-700 font-semibold bg-risk-50 px-1 rounded">
                          {r.overloadPercent}% overload
                        </span>
                        <span className="text-ink-500">
                          {r.assignedTasks} tasks · ~{r.estimatedHours}h / {r.availableHours}h
                        </span>
                      </li>
                    ))}
                    {!overload.overloadedResources?.length && (
                      <li className="text-ink-500">No overloaded resources detected.</li>
                    )}
                    <li className="text-ink-600 pt-1">{overload.recommendation}</li>
                  </ul>
                )}
              </AIInsightCard>
            )}

            <AIInsightCard
              title="Escalation probability"
              description="Sentiment history, silence, delays composite."
              onRun={loadEscalationRisk}
              loading={escalationLoading}
            >
              {escalation && (
                <div className="mt-2 text-xs space-y-1 text-ink-700">
                  <p className="font-semibold">
                    {escalation.escalationProbability}% — {escalation.riskLevel} · ~{escalation.daysUntilEscalation}{' '}
                    days
                  </p>
                  <ul className="list-disc pl-4">
                    {(escalation.triggerSignals || []).map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                  <p className="text-ink-600">{(escalation.suggestedActions || []).join(' · ')}</p>
                </div>
              )}
            </AIInsightCard>
          </div>

          <div className="border-t border-accent-100 pt-4 space-y-3">
            <p className="text-xs font-semibold text-ink-700">Client sentiment</p>
            <ClientSentimentPanel projectId={projectId} hideNumericScore={user?.role === 'client'} />
          </div>

          <div className="border-t border-accent-100 pt-4 space-y-2">
            <p className="text-xs font-semibold text-ink-700">Scope creep check</p>
            <textarea
              className="w-full text-sm border border-ink-200 rounded-md px-2 py-1.5 min-h-[72px]"
              value={scopeEmail}
              onChange={(e) => setScopeEmail(e.target.value)}
              placeholder="Paste client email to compare to current modules…"
            />
            <button
              type="button"
              onClick={runScopeCheck}
              disabled={scopeLoading || !scopeEmail.trim()}
              className="text-xs bg-ink-800 text-paper px-3 py-1 rounded-md disabled:opacity-50"
            >
              {scopeLoading ? 'Analyzing…' : 'Run scope check'}
            </button>
            {scopeResult?.scopeCreepDetected && (
              <div className="text-xs bg-caution-50 border border-caution-200 rounded p-2 space-y-1">
                <p className="font-semibold text-caution-900">
                  Scope creep likely ({scopeResult.confidence}% confidence)
                </p>
                <p className="text-ink-700">{scopeResult.creepDescription}</p>
                <button
                  type="button"
                  onClick={() => setShowScopeCrModal(true)}
                  className="text-focus-700 font-medium hover:underline"
                >
                  Review draft CR →
                </button>
              </div>
            )}
            {scopeResult?.error && <p className="text-xs text-risk-600">Scope check failed.</p>}
          </div>

          <div className="border-t border-accent-100 pt-4 space-y-2">
            <p className="text-xs font-semibold text-ink-700">Audience narrative</p>
            <div className="flex flex-wrap gap-1">
              {['pm', 'dh', 'client', 'exec'].map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => {
                    setNarrativeAud(a);
                    setNarrativeData(null);
                  }}
                  className={`text-xs px-2 py-0.5 rounded ${
                    narrativeAud === a ? 'bg-accent-700 text-paper' : 'bg-paper border border-ink-200'
                  }`}
                >
                  {a.toUpperCase()}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={loadNarrative}
              disabled={narrativeLoading}
              className="text-xs bg-accent-700 text-paper px-3 py-1 rounded-md disabled:opacity-50"
            >
              {narrativeLoading ? 'Generating…' : 'Generate narrative'}
            </button>
            {narrativeAud === 'client' && narrativeData && (
              <p className="text-xs text-caution-800">
                {project?.clientNarrativeApprovedAt
                  ? 'Approved for client view.'
                  : 'Pending PM approval before sharing with client.'}
              </p>
            )}
            {narrativeAud === 'client' && narrativeData && !project?.clientNarrativeApprovedAt && (
              <button
                type="button"
                onClick={handleApproveClientNarrative}
                disabled={narrativeApproving}
                className="text-xs border border-success-700 text-success-800 px-2 py-1 rounded-md"
              >
                {narrativeApproving ? 'Saving…' : 'Approve for client'}
              </button>
            )}
            {narrativeData?.narrative && (
              <div className="text-sm text-ink-800 bg-paper/90 rounded p-3 border border-ink-100 whitespace-pre-wrap">
                {narrativeData.narrative}
              </div>
            )}
          </div>
        </div>
      )}

      {showScopeCrModal && scopeResult?.draftCR && (
        <Modal title="Draft change request" onClose={() => setShowScopeCrModal(false)}>
          <div className="space-y-2 text-sm max-w-lg">
            <p className="font-semibold">{scopeResult.draftCR.title}</p>
            <p className="text-ink-600 whitespace-pre-wrap">{scopeResult.draftCR.description}</p>
            <p className="text-xs text-ink-500">
              Est. impact: {scopeResult.draftCR.estimatedImpactHours}h / {scopeResult.draftCR.estimatedImpactDays}{' '}
              days
            </p>
            <p className="text-xs text-ink-500">
              Full CR workflow is not wired in this build — copy this draft into your CR tool or Intake.
            </p>
            <button
              type="button"
              className="text-sm bg-link-600 text-paper px-3 py-1.5 rounded-md"
              onClick={() => {
                navigator.clipboard.writeText(
                  `${scopeResult.draftCR.title}\n\n${scopeResult.draftCR.description}`
                );
                alert('Copied to clipboard');
              }}
            >
              Copy draft
            </button>
          </div>
        </Modal>
      )}

      {/* Project Chat Widget */}
      <div className="bg-paper border border-ink-200 rounded-lg p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">💬</span>
          <h3 className="font-semibold text-ink-900">Ask the AI</h3>
          <span className="text-xs text-ink-400">(Beta)</span>
        </div>

        {/* Chat history */}
        {chatHistory.length > 0 && (
          <div className="bg-ink-50 rounded p-4 mb-4 max-h-64 overflow-y-auto space-y-3 border border-ink-100">
            {chatHistory.slice(-3).map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                  msg.role === 'user'
                    ? 'bg-link-500 text-paper rounded-br-none'
                    : 'bg-ink-200 text-ink-800 rounded-bl-none'
                }`}>
                  {msg.role === 'ai' && <span className="font-semibold">✨ AI: </span>}
                  {msg.text}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Input form */}
        <form onSubmit={handleAskQuestion} className="flex gap-2">
          <input
            type="text"
            placeholder="e.g. Which module is most at risk?"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            disabled={chatLoading}
            className="flex-1 border border-ink-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-link-500 disabled:bg-ink-50"
          />
          <button
            type="submit"
            disabled={chatLoading || !chatInput.trim()}
            className="bg-link-600 hover:bg-link-700 text-paper text-sm font-medium px-4 py-2 rounded-md disabled:opacity-50 transition-colors"
          >
            {chatLoading ? 'Asking...' : 'Ask'}
          </button>
        </form>
      </div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-ink-800">
          Modules
          <span className="ml-2 text-sm font-normal text-ink-400">({modules.length})</span>
        </h2>
        <div className="flex items-center gap-2">
          {/* Board / List view toggle */}
          <div className="inline-flex rounded-md border border-ink-200 bg-paper overflow-hidden">
            <button
              type="button"
              onClick={() => setModuleView('board')}
              className={`text-xs px-2.5 py-1 transition-colors ${
                moduleView === 'board' ? 'bg-link-600 text-paper' : 'text-ink-600 hover:bg-ink-50'
              }`}
              title="Board view"
            >
              ▦ Board
            </button>
            <button
              type="button"
              onClick={() => setModuleView('list')}
              className={`text-xs px-2.5 py-1 border-l border-ink-200 transition-colors ${
                moduleView === 'list' ? 'bg-link-600 text-paper' : 'text-ink-600 hover:bg-ink-50'
              }`}
              title="List view"
            >
              ☰ List
            </button>
          </div>
          {canCreateModule ? (
            <button
              onClick={() => setShowModuleModal(true)}
              className="text-sm bg-link-600 hover:bg-link-700 text-paper font-medium px-3 py-1.5 rounded-md transition-colors"
            >
              + Add Module
            </button>
          ) : null}
        </div>
      </div>

      {modules.length === 0 ? (
        <div className="bg-paper border border-dashed border-ink-300 rounded-lg p-12 text-center">
          <p className="text-ink-400 text-sm">No modules yet.</p>
          {canCreateModule ? (
            <p className="text-ink-400 text-xs mt-1">Add modules like "Core HR", "Payroll", "Recruitment".</p>
          ) : (
            <p className="text-ink-400 text-xs mt-1">A delivery head will set up modules for this project.</p>
          )}
        </div>
      ) : moduleView === 'board' ? (
        /* Rocketlane-style horizontal board: each module is a column,
           workstreams within the module are the cards. */
        <KanbanBoard className="-mx-1">
          {modules.map((mod) => {
            const tone = deriveStatusTone(mod.stats);
            const wsState = moduleWorkstreams[mod._id] || { loading: false, error: null, items: [] };
            const wsItems = wsState.items || [];
            const burnTone =
              mod.stats.burnPercent > 90 ? 'risk' : mod.stats.burnPercent > 70 ? 'caution' : 'link';
            return (
              <KanbanColumn
                key={mod._id}
                icon={<StatusDot status={tone.dot} />}
                accent={tone.accent}
                title={mod.name}
                onTitleClick={() => navigate(`/projects/${projectId}/modules/${mod._id}`)}
                subtitle={
                  <span className="flex items-center gap-2 flex-wrap">
                    <span className="bg-ink-50 text-ink-600 px-1.5 py-0.5 rounded text-[10px] font-medium">
                      {mod.stats.workstreamCount} ws · {mod.stats.totalTasks} tasks
                    </span>
                    <span className="text-ink-500">
                      {mod.stats.loggedHours}h / {mod.budgetHours}h
                    </span>
                  </span>
                }
                progress={mod.stats.progress}
                progressTone={tone.tone === 'risk' ? 'risk' : 'success'}
                actions={
                  canDeleteModule ? (
                    <button
                      onClick={(e) => handleDeleteModule(e, mod._id)}
                      className="text-[11px] text-ink-300 hover:text-risk-500 px-1"
                      title="Delete module"
                    >
                      ✕
                    </button>
                  ) : null
                }
                emptyMessage={wsState.loading ? 'Loading workstreams…' : wsState.error || 'No workstreams yet'}
                footer={
                  <div className="flex items-center justify-between text-[10px] text-ink-400">
                    <span>
                      Burn{' '}
                      <strong className={burnTone === 'risk' ? 'text-risk-600' : burnTone === 'caution' ? 'text-caution-700' : 'text-ink-700'}>
                        {mod.stats.burnPercent}%
                      </strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => navigate(`/projects/${projectId}/modules/${mod._id}`)}
                      className="text-link-600 hover:underline"
                    >
                      Open →
                    </button>
                  </div>
                }
              >
                {wsItems.map((ws) => {
                  const wsDone = (ws.tasks || []).filter((t) => t.status === 'Done').length;
                  const wsTotal = (ws.tasks || []).length;
                  const wsProgress = wsTotal ? Math.round((wsDone / wsTotal) * 100) : 0;
                  const wsTone = deriveStatusTone(
                    { progress: wsProgress, overdueTasks: 0 },
                    ws.signOffStatus
                  );
                  const dateRange = [fmtShortDate(ws.actualStartDate || ws.baselinePlannedStartDate), fmtShortDate(ws.actualEndDate || ws.baselinePlannedEndDate)]
                    .filter(Boolean)
                    .join(' → ');
                  return (
                    <KanbanCard
                      key={ws._id}
                      leadingIcon={<StatusDot status={wsTone.dot} size="sm" />}
                      title={ws.name}
                      subtitle={dateRange || null}
                      tags={[
                        wsTotal > 0 ? (
                          <span key="prog" className="text-[10px] bg-ink-50 text-ink-600 px-1.5 py-0.5 rounded">
                            {wsDone}/{wsTotal} done
                          </span>
                        ) : null,
                        ws.signOffStatus === 'Signed Off' ? (
                          <span key="signed" className="text-[10px] bg-success-50 text-success-700 px-1.5 py-0.5 rounded">✓ signed</span>
                        ) : ws.signOffStatus === 'Requested' ? (
                          <span key="req" className="text-[10px] bg-caution-50 text-caution-700 px-1.5 py-0.5 rounded">sign-off requested</span>
                        ) : null,
                      ].filter(Boolean)}
                      footer={
                        wsTotal > 0 ? (
                          <div className="h-1 bg-ink-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${wsProgress >= 100 ? 'bg-success-500' : wsProgress > 0 ? 'bg-link-500' : 'bg-ink-200'}`}
                              style={{ width: `${wsProgress}%` }}
                            />
                          </div>
                        ) : null
                      }
                      onClick={() => navigate(`/projects/${projectId}/modules/${mod._id}`)}
                    />
                  );
                })}
              </KanbanColumn>
            );
          })}
        </KanbanBoard>
      ) : (
        <div className="space-y-3">
          {modules.map((mod) => (
            <div
              key={mod._id}
              className="bg-paper border border-ink-200 rounded-lg p-5 hover:border-link-200 transition-colors cursor-pointer group"
              onClick={() => navigate(`/projects/${projectId}/modules/${mod._id}`)}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-ink-900 group-hover:text-link-700 transition-colors">
                    {mod.name}
                  </h3>
                  <span className="text-xs text-ink-400 bg-ink-50 px-2 py-0.5 rounded">
                    {mod.stats.workstreamCount} workstream{mod.stats.workstreamCount !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-link-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    View details →
                  </span>
                  {canDeleteModule ? (
                    <button
                      onClick={(e) => handleDeleteModule(e, mod._id)}
                      className="text-xs text-ink-300 hover:text-risk-500 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Task progress */}
                <div>
                  <div className="flex justify-between text-xs text-ink-500 mb-1.5">
                    <span>Task Progress</span>
                    <span>
                      {mod.stats.completedTasks}/{mod.stats.totalTasks} ·{' '}
                      <strong>{mod.stats.progress}%</strong>
                    </span>
                  </div>
                  <div className="h-2 bg-ink-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-success-500 rounded-full"
                      style={{ width: `${mod.stats.progress}%` }}
                    />
                  </div>
                </div>

                {/* Hour burn */}
                <div>
                  <div className="flex justify-between text-xs text-ink-500 mb-1.5">
                    <span>Hour Burn</span>
                    <span>
                      {mod.stats.loggedHours}h / {mod.budgetHours}h ·{' '}
                      <strong
                        className={
                          mod.stats.burnPercent > 90
                            ? 'text-risk-600'
                            : mod.stats.burnPercent > 70
                            ? 'text-caution-600'
                            : ''
                        }
                      >
                        {mod.stats.burnPercent}%
                      </strong>
                    </span>
                  </div>
                  <div className="h-2 bg-ink-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        mod.stats.burnPercent > 90
                          ? 'bg-risk-500'
                          : mod.stats.burnPercent > 70
                          ? 'bg-caution-400'
                          : 'bg-link-400'
                      }`}
                      style={{ width: `${Math.min(mod.stats.burnPercent, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Module financial summary */}
              <div className="flex gap-5 mt-3 text-xs text-ink-400">
                <span>Budget <strong className="text-ink-600">{mod.budgetHours}h</strong></span>
                <span>Logged <strong className="text-ink-600">{mod.stats.loggedHours}h</strong></span>
                <span>
                  Remaining{' '}
                  <strong className={mod.stats.remainingHours === 0 && mod.budgetHours > 0 ? 'text-risk-500' : 'text-ink-600'}>
                    {mod.stats.remainingHours}h
                  </strong>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {canViewModuleDeliveryStatus && (
        <div style={{ marginTop: 32 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Module Delivery Status</h2>
            <span style={{ fontSize: 12, color: '#9CA3AF' }}>Auto-computed from task data</span>
          </div>
          <ModuleStatusMatrix projectId={projectId} />
        </div>
      )}

      </>
      )}

      {/* Clone structure modal (FR-M1-04) */}
      {showCloneModal && (
        <Modal title="Clone module & workstream structure" onClose={() => setShowCloneModal(false)}>
          <form onSubmit={handleCloneSubmit} className="space-y-4 max-w-lg">
            <p className="text-sm text-ink-600">
              Copies <strong>modules</strong> (name + budget hours) and <strong>workstreams</strong> (name + budget
              hours + cost rate) from the source project. Does <strong>not</strong> copy tasks, logged hours, or
              staffing — set the new project fields below.
            </p>
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1.5">Source project *</label>
              <select
                required
                className="w-full border border-ink-300 rounded-md px-3 py-2 text-sm"
                value={cloneForm.sourceProjectId}
                onChange={(e) =>
                  setCloneForm((f) => ({ ...f, sourceProjectId: e.target.value }))
                }
              >
                <option value="">Select project…</option>
                {allProjects
                  .filter((p) => p._id !== projectId)
                  .map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1.5">New project name *</label>
              <input
                required
                className="w-full border border-ink-300 rounded-md px-3 py-2 text-sm"
                value={cloneForm.name}
                onChange={(e) => setCloneForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1.5">Client name *</label>
              <input
                required
                className="w-full border border-ink-300 rounded-md px-3 py-2 text-sm"
                value={cloneForm.clientName}
                onChange={(e) => setCloneForm((f) => ({ ...f, clientName: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1.5">Go-live date *</label>
                <input
                  type="date"
                  required
                  className="w-full border border-ink-300 rounded-md px-3 py-2 text-sm"
                  value={cloneForm.goLiveDate}
                  onChange={(e) => setCloneForm((f) => ({ ...f, goLiveDate: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1.5">Contract value *</label>
                <input
                  type="number"
                  required
                  min="0"
                  className="w-full border border-ink-300 rounded-md px-3 py-2 text-sm"
                  value={cloneForm.contractValue}
                  onChange={(e) => setCloneForm((f) => ({ ...f, contractValue: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1.5">Implementation fee</label>
                <input
                  type="number"
                  min="0"
                  className="w-full border border-ink-300 rounded-md px-3 py-2 text-sm"
                  value={cloneForm.implementationFee}
                  onChange={(e) => setCloneForm((f) => ({ ...f, implementationFee: e.target.value }))}
                  placeholder="Defaults to contract value"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1.5">Region</label>
                <select
                  className="w-full border border-ink-300 rounded-md px-3 py-2 text-sm"
                  value={cloneForm.region}
                  onChange={(e) => setCloneForm((f) => ({ ...f, region: e.target.value }))}
                >
                  {PROJECT_REGIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1.5">Notional ARR</label>
              <input
                type="number"
                min="0"
                className="w-full border border-ink-300 rounded-md px-3 py-2 text-sm"
                value={cloneForm.notionalARR}
                onChange={(e) => setCloneForm((f) => ({ ...f, notionalARR: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1.5">Tier</label>
              <select
                className="w-full border border-ink-300 rounded-md px-3 py-2 text-sm"
                value={cloneForm.tier}
                onChange={(e) => setCloneForm((f) => ({ ...f, tier: e.target.value }))}
              >
                <option>Tier 1</option>
                <option>Tier 2</option>
                <option>Tier 3</option>
              </select>
            </div>
            {cloneForm.tier === 'Tier 1' && (
              <div className="space-y-2">
                <input
                  type="url"
                  placeholder="SharePoint https://..."
                  required
                  className="w-full border border-ink-300 rounded-md px-3 py-2 text-sm"
                  value={cloneForm.sharePointUrl}
                  onChange={(e) => setCloneForm((f) => ({ ...f, sharePointUrl: e.target.value }))}
                />
                <input
                  type="url"
                  placeholder="Account playbook URL"
                  required
                  className="w-full border border-ink-300 rounded-md px-3 py-2 text-sm"
                  value={cloneForm.accountPlaybookUrl}
                  onChange={(e) => setCloneForm((f) => ({ ...f, accountPlaybookUrl: e.target.value }))}
                />
                <input
                  placeholder="CS resource name"
                  required
                  className="w-full border border-ink-300 rounded-md px-3 py-2 text-sm"
                  value={cloneForm.csResourceName}
                  onChange={(e) => setCloneForm((f) => ({ ...f, csResourceName: e.target.value }))}
                />
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCloneModal(false)}
                className="px-4 py-2 text-sm text-ink-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingClone}
                className="bg-link-600 hover:bg-link-700 text-paper text-sm font-medium px-4 py-2 rounded-md disabled:opacity-50"
              >
                {savingClone ? 'Cloning…' : 'Confirm clone'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add Module Modal */}
      {showModuleModal && (
        <Modal title="Add Module" onClose={() => { setShowModuleModal(false); setModuleForm(EMPTY_MODULE); }}>
          <form onSubmit={handleAddModule} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1.5">Module Name *</label>
              <input
                required
                placeholder="e.g. Core HR, Payroll, Recruitment"
                className="w-full border border-ink-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-link-500 focus:border-transparent"
                value={moduleForm.name}
                onChange={(e) => setModuleForm({ ...moduleForm, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1.5">Budgeted Hours *</label>
              <input
                required
                type="number"
                min="1"
                placeholder="e.g. 200"
                className="w-full border border-ink-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-link-500 focus:border-transparent"
                value={moduleForm.budgetHours}
                onChange={(e) => setModuleForm({ ...moduleForm, budgetHours: e.target.value })}
              />
              <p className="text-xs text-ink-400 mt-1">Hours allocated to this module in the SOW.</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setShowModuleModal(false); setModuleForm(EMPTY_MODULE); }}
                className="px-4 py-2 text-sm text-ink-500 hover:text-ink-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="bg-link-600 hover:bg-link-700 text-paper text-sm font-medium px-5 py-2 rounded-md disabled:opacity-50 transition-colors"
              >
                {saving ? 'Adding…' : 'Add Module'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
