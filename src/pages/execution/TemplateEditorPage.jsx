import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import Button from '../../components/Button';
import MemberPicker from '../../components/MemberPicker';
import { useAuth } from '../../context/AuthContext';
import { projectTemplatesAPI, usersAPI } from '../../services/api';

const AUTHOR_ROLES = new Set(['admin', 'pmo']);

const TIER_OPTIONS = ['Tier 1', 'Tier 2', 'Tier 3'];
const DELIVERY_PHASES = [
  'Sales Handover',
  'Account Setup',
  'Design Approval',
  'Configuration',
  'UAT',
  'Customer Enablement',
  'Hypercare',
];

/* ------------------------------------------------------------------ */
/* State helpers                                                       */
/* ------------------------------------------------------------------ */

const newWorkstream = (name = 'New task', overrides = {}) => ({
  id: cryptoId(),
  name,
  description: '',
  startOffsetDays: 0,
  durationDays: 1,
  budgetHours: 0,
  ownerPlaceholder: 'Project Manager',
  ownerUserId: null,
  billable: true,
  automations: [],
  keyEvents: [],
  ...overrides,
});

const newModule = (name = 'New phase', overrides = {}) => ({
  id: cryptoId(),
  name,
  description: '',
  budgetHours: 0,
  startOffsetDays: 0,
  durationDays: 1,
  ownerPlaceholder: 'Project Manager',
  ownerUserId: null,
  automations: [],
  keyEvents: [],
  workstreams: [],
  collapsed: false,
  ...overrides,
});

function cryptoId() {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `id-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;
}

/** Convert API moduleDetails (server format) to editor row state. */
function hydrateModulesFromApi(moduleDetails) {
  if (!Array.isArray(moduleDetails) || moduleDetails.length === 0) {
    return [newModule('Inception', { budgetHours: 0 })];
  }
  return moduleDetails.map((m) =>
    newModule(m.name || 'Phase', {
      description: m.description || '',
      budgetHours: Number(m.budgetHours) || 0,
      startOffsetDays: Number(m.startOffsetDays) || 0,
      durationDays: Number(m.durationDays) || 1,
      ownerPlaceholder: m.ownerPlaceholder || 'Project Manager',
      ownerUserId: m.ownerUserId || null,
      automations: Array.isArray(m.automations) ? [...m.automations] : [],
      keyEvents: Array.isArray(m.keyEvents) ? [...m.keyEvents] : [],
      workstreams: Array.isArray(m.workstreams)
        ? m.workstreams.map((w) =>
            typeof w === 'string'
              ? newWorkstream(w)
              : newWorkstream(w.name || 'Task', {
                  description: w.description || '',
                  startOffsetDays: Number(w.startOffsetDays) || 0,
                  durationDays: Number(w.durationDays) || 1,
                  budgetHours: Number(w.budgetHours) || 0,
                  ownerPlaceholder: w.ownerPlaceholder || 'Project Manager',
                  ownerUserId: w.ownerUserId || null,
                  billable: typeof w.billable === 'boolean' ? w.billable : true,
                  automations: Array.isArray(w.automations) ? [...w.automations] : [],
                  keyEvents: Array.isArray(w.keyEvents) ? [...w.keyEvents] : [],
                })
          )
        : [],
    })
  );
}

/** Strip transient editor-only fields and produce the wire payload. */
function modulesToPayload(modules) {
  return modules.map((m) => ({
    name: m.name.trim(),
    description: (m.description || '').trim(),
    budgetHours: Number(m.budgetHours) || 0,
    startOffsetDays: Number(m.startOffsetDays) || 0,
    durationDays: Number(m.durationDays) || 1,
    ownerPlaceholder: (m.ownerPlaceholder || '').trim() || 'Project Manager',
    ownerUserId: m.ownerUserId || null,
    automations: Array.isArray(m.automations) ? m.automations.filter(Boolean) : [],
    keyEvents: Array.isArray(m.keyEvents) ? m.keyEvents.filter(Boolean) : [],
    workstreams: (m.workstreams || []).map((w) => ({
      name: w.name.trim(),
      description: (w.description || '').trim(),
      startOffsetDays: Number(w.startOffsetDays) || 0,
      durationDays: Number(w.durationDays) || 1,
      budgetHours: Number(w.budgetHours) || 0,
      ownerPlaceholder: (w.ownerPlaceholder || '').trim() || 'Project Manager',
      ownerUserId: w.ownerUserId || null,
      billable: typeof w.billable === 'boolean' ? w.billable : true,
      automations: Array.isArray(w.automations) ? w.automations.filter(Boolean) : [],
      keyEvents: Array.isArray(w.keyEvents) ? w.keyEvents.filter(Boolean) : [],
    })),
    phaseCount: Math.max(2, Math.min(5, (m.workstreams || []).length || 3)),
  }));
}

function totalBudgetHours(modules) {
  return modules.reduce((sum, m) => {
    const wsTotal = (m.workstreams || []).reduce(
      (s, w) => s + (Number(w.budgetHours) || 0),
      0
    );
    return sum + (wsTotal > 0 ? wsTotal : Number(m.budgetHours) || 0);
  }, 0);
}

function fmtHours(h) {
  const n = Math.round(Number(h) || 0);
  if (n === 0) return '–';
  return `${n}h`;
}

function fmtDays(n) {
  const v = Math.round(Number(n) || 0);
  return `${v}d`;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function TemplateEditorPage() {
  const { templateId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const isEdit = !!templateId;
  const canAuthor = AUTHOR_ROLES.has(user?.role);

  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [readOnly, setReadOnly] = useState(false);

  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [durationLabel, setDurationLabel] = useState('');
  const [defaultTier, setDefaultTier] = useState('Tier 2');
  const [defaultDeliveryPhase, setDefaultDeliveryPhase] = useState('Sales Handover');
  const [modules, setModules] = useState(() => [newModule('Inception')]);
  const [showSettings, setShowSettings] = useState(false);

  /** { kind: 'phase' | 'task', moduleId: string, workstreamId?: string } */
  const [selection, setSelection] = useState(null);
  const [activeTab, setActiveTab] = useState('phase'); // phase | automations | events

  // Internal team / member directory used by the assignee picker.
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setMembersLoading(true);
    usersAPI
      .getAll()
      .then(({ data }) => {
        if (!alive) return;
        const list = Array.isArray(data) ? data : data?.users || [];
        // Exclude clients (templates assign delivery owners, not customer users).
        setMembers(list.filter((u) => u && u._id && u.role !== 'client'));
      })
      .catch(() => {
        if (alive) setMembers([]);
      })
      .finally(() => {
        if (alive) setMembersLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);


  // Snapshot for dirty-checking.
  const initialSnapshot = useRef(null);

  /* -------------------------- Load on edit -------------------------- */

  const setSnapshot = useCallback((data) => {
    initialSnapshot.current = JSON.stringify({
      name: data.name,
      desc: data.desc,
      durationLabel: data.durationLabel,
      defaultTier: data.defaultTier,
      defaultDeliveryPhase: data.defaultDeliveryPhase,
      modules: modulesToPayload(data.modules),
    });
  }, []);

  useEffect(() => {
    let alive = true;
    if (!isEdit) {
      const initialModules = [newModule('Inception')];
      setSnapshot({
        name: '',
        desc: '',
        durationLabel: '',
        defaultTier: 'Tier 2',
        defaultDeliveryPhase: 'Sales Handover',
        modules: initialModules,
      });
      setSelection({ kind: 'phase', moduleId: initialModules[0].id });
      return () => {
        alive = false;
      };
    }
    setLoading(true);
    setLoadError('');
    projectTemplatesAPI
      .getById(templateId)
      .then(({ data }) => {
        if (!alive) return;
        const hydrated = hydrateModulesFromApi(data?.moduleDetails);
        setName(data?.name || '');
        setDesc(data?.desc || '');
        setDurationLabel(data?.duration || '');
        setDefaultTier(data?.defaultTier || 'Tier 2');
        setDefaultDeliveryPhase(data?.defaultDeliveryPhase || 'Sales Handover');
        setModules(hydrated);
        setReadOnly(!!data?.readOnly);
        setSelection(
          hydrated[0]
            ? { kind: 'phase', moduleId: hydrated[0].id }
            : null
        );
        setSnapshot({
          name: data?.name || '',
          desc: data?.desc || '',
          durationLabel: data?.duration || '',
          defaultTier: data?.defaultTier || 'Tier 2',
          defaultDeliveryPhase: data?.defaultDeliveryPhase || 'Sales Handover',
          modules: hydrated,
        });
      })
      .catch((err) => {
        if (!alive) return;
        setLoadError(err?.response?.data?.message || err?.message || 'Could not load template');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [isEdit, templateId, setSnapshot]);

  /* -------------------------- Dirty tracking ------------------------ */

  const dirty = useMemo(() => {
    if (initialSnapshot.current == null) return false;
    const current = JSON.stringify({
      name,
      desc,
      durationLabel,
      defaultTier,
      defaultDeliveryPhase,
      modules: modulesToPayload(modules),
    });
    return current !== initialSnapshot.current;
  }, [name, desc, durationLabel, defaultTier, defaultDeliveryPhase, modules]);

  // Warn on unload if dirty.
  useEffect(() => {
    if (!dirty) return undefined;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  /* -------------------------- Mutators ------------------------------ */

  const updateModule = (moduleId, patch) => {
    setModules((cur) =>
      cur.map((m) => (m.id === moduleId ? { ...m, ...patch } : m))
    );
  };
  const updateWorkstream = (moduleId, workstreamId, patch) => {
    setModules((cur) =>
      cur.map((m) =>
        m.id === moduleId
          ? {
              ...m,
              workstreams: m.workstreams.map((w) =>
                w.id === workstreamId ? { ...w, ...patch } : w
              ),
            }
          : m
      )
    );
  };

  const addPhase = () => {
    if (readOnly) return;
    const next = newModule('New phase');
    setModules((cur) => [...cur, next]);
    setSelection({ kind: 'phase', moduleId: next.id });
    setActiveTab('phase');
  };

  const removePhase = (moduleId) => {
    if (readOnly) return;
    setModules((cur) => cur.filter((m) => m.id !== moduleId));
    setSelection((s) => (s?.moduleId === moduleId ? null : s));
  };

  const addTask = (moduleId) => {
    if (readOnly) return;
    const next = newWorkstream('New task');
    setModules((cur) =>
      cur.map((m) =>
        m.id === moduleId
          ? { ...m, workstreams: [...m.workstreams, next], collapsed: false }
          : m
      )
    );
    setSelection({ kind: 'task', moduleId, workstreamId: next.id });
    setActiveTab('phase');
  };

  const removeTask = (moduleId, workstreamId) => {
    if (readOnly) return;
    setModules((cur) =>
      cur.map((m) =>
        m.id === moduleId
          ? { ...m, workstreams: m.workstreams.filter((w) => w.id !== workstreamId) }
          : m
      )
    );
    setSelection((s) =>
      s?.workstreamId === workstreamId ? { kind: 'phase', moduleId } : s
    );
  };

  /* -------------------------- Save ---------------------------------- */

  const handleSave = async () => {
    setSaveError('');
    if (!canAuthor) {
      setSaveError('Only Admin or PMO can save templates.');
      return;
    }
    if (readOnly) {
      setSaveError('Built-in templates are read-only. Use “Save as new” to fork.');
      return;
    }
    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      setSaveError('Template name must be at least 2 characters.');
      return;
    }
    if (!modules.length) {
      setSaveError('Add at least one phase.');
      return;
    }
    const invalidPhase = modules.find((m) => !m.name.trim());
    if (invalidPhase) {
      setSaveError('Every phase must have a name.');
      return;
    }
    const invalidTask = modules
      .flatMap((m) => m.workstreams.map((w) => ({ m, w })))
      .find(({ w }) => !w.name.trim());
    if (invalidTask) {
      setSaveError('Every task must have a name (or remove the row).');
      return;
    }

    const payload = {
      name: trimmedName,
      desc: desc.trim(),
      durationLabel: durationLabel.trim(),
      defaultTier,
      defaultDeliveryPhase,
      modules: modulesToPayload(modules),
    };

    setSaving(true);
    try {
      let saved;
      if (isEdit) {
        const { data } = await projectTemplatesAPI.update(templateId, payload);
        saved = data;
      } else {
        const { data } = await projectTemplatesAPI.create(payload);
        saved = data;
      }
      // Reset snapshot + redirect to the canonical edit URL.
      setSnapshot({ ...payload, modules });
      const newId = saved?.id || templateId;
      if (!isEdit && newId) {
        navigate(`/execution/templates/${encodeURIComponent(newId)}/edit`, { replace: true });
      } else {
        navigate('/execution/templates');
      }
    } catch (err) {
      const errs = err?.response?.data?.errors;
      if (Array.isArray(errs) && errs.length) {
        setSaveError(errs.join(' '));
      } else {
        setSaveError(err?.response?.data?.message || err?.message || 'Could not save template');
      }
    } finally {
      setSaving(false);
    }
  };

  /* -------------------------- Close --------------------------------- */

  const close = () => {
    if (dirty) {
      const ok = window.confirm('Discard unsaved changes?');
      if (!ok) return;
    }
    navigate('/execution/templates');
  };

  /* -------------------------- Selection ----------------------------- */

  const selectedModule = useMemo(
    () => modules.find((m) => m.id === selection?.moduleId) || null,
    [modules, selection]
  );
  const selectedWorkstream = useMemo(() => {
    if (!selectedModule || selection?.kind !== 'task') return null;
    return selectedModule.workstreams.find((w) => w.id === selection.workstreamId) || null;
  }, [selectedModule, selection]);

  /* -------------------------- Render -------------------------------- */

  const totalHours = totalBudgetHours(modules);

  if (!canAuthor) {
    return (
      <div className="bg-paper min-h-full p-6">
        <p className="text-sm text-red-600">
          Only Admin or PMO users can author project templates.{' '}
          <Link to="/execution/templates" className="underline">Back to catalog</Link>
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-paper min-h-full p-6">
        <p className="text-sm text-ink-500">Loading template…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-paper min-h-full p-6">
        <p className="text-sm text-red-600">{loadError}</p>
        <Link to="/execution/templates" className="text-sm underline text-ink-700 mt-3 inline-block">
          Back to templates
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-paper">
      {/* ------------------------ Top header ------------------------- */}
      <header className="shrink-0 border-b border-ink-100 px-5 py-3 flex items-start justify-between gap-4 bg-paper">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-ink-400 m-0 mb-0.5">
            <Link to="/execution/templates" className="hover:text-ink-700">Templates</Link>
            <span className="mx-1.5 text-ink-300">/</span>
            <span>Project templates</span>
          </p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Untitled template"
            disabled={readOnly}
            className="w-full max-w-2xl text-[20px] font-semibold text-ink-900 bg-transparent border-0 outline-none focus:ring-0 px-0 py-0"
          />
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {readOnly ? (
            <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1">
              Read-only (built-in)
            </span>
          ) : dirty ? (
            <span className="text-[12px] text-amber-700">You have unsaved changes.</span>
          ) : isEdit ? (
            <span className="text-[12px] text-ink-400">All changes saved.</span>
          ) : null}
          <Button
            type="button"
            disabled={saving || readOnly || !dirty}
            onClick={handleSave}
          >
            {saving ? 'Saving…' : (
              <>
                Save <span className="ml-1.5">→</span>
              </>
            )}
          </Button>
          <button
            type="button"
            onClick={() => setShowSettings((s) => !s)}
            className="w-8 h-8 rounded-md border border-ink-100 bg-paper text-ink-500 hover:bg-ink-50 flex items-center justify-center"
            aria-label="Template settings"
            title="Template settings"
          >
            <span className="text-base leading-none">⚙</span>
          </button>
          <button
            type="button"
            onClick={close}
            className="w-8 h-8 rounded-md border border-ink-100 bg-paper text-ink-500 hover:bg-ink-50 flex items-center justify-center"
            aria-label="Close editor"
            title="Close"
          >
            <span className="text-base leading-none">×</span>
          </button>
        </div>
      </header>

      {saveError ? (
        <div className="px-5 py-2 bg-red-50 border-b border-red-100 text-xs text-red-700">{saveError}</div>
      ) : null}

      {/* Settings popover (template-level metadata) */}
      {showSettings ? (
        <div className="px-5 py-3 border-b border-ink-100 bg-ink-50/40 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <label className="block text-[11px] font-medium text-ink-600">
            Description
            <input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              disabled={readOnly}
              className="mt-1 w-full border border-ink-200 rounded-md px-2 py-1.5 text-[13px] bg-paper"
              placeholder="Reusable delivery playbook"
            />
          </label>
          <label className="block text-[11px] font-medium text-ink-600">
            Duration label
            <input
              value={durationLabel}
              onChange={(e) => setDurationLabel(e.target.value)}
              disabled={readOnly}
              className="mt-1 w-full border border-ink-200 rounded-md px-2 py-1.5 text-[13px] bg-paper"
              placeholder="8-12 wks"
            />
          </label>
          <label className="block text-[11px] font-medium text-ink-600">
            Default tier
            <select
              value={defaultTier}
              onChange={(e) => setDefaultTier(e.target.value)}
              disabled={readOnly}
              className="mt-1 w-full border border-ink-200 rounded-md px-2 py-1.5 text-[13px] bg-paper"
            >
              {TIER_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="block text-[11px] font-medium text-ink-600">
            Default delivery phase
            <select
              value={defaultDeliveryPhase}
              onChange={(e) => setDefaultDeliveryPhase(e.target.value)}
              disabled={readOnly}
              className="mt-1 w-full border border-ink-200 rounded-md px-2 py-1.5 text-[13px] bg-paper"
            >
              {DELIVERY_PHASES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {/* ------------------------ Top tabs --------------------------- */}
      <div className="shrink-0 border-b border-ink-100 px-5 flex items-center gap-5 text-[13px]">
        <button type="button" className="py-2 border-b-2 border-ink-900 text-ink-900 font-medium">
          <span className="mr-1.5">▦</span> Project
        </button>
        <button
          type="button"
          className="py-2 border-b-2 border-transparent text-ink-400 hover:text-ink-600 cursor-not-allowed"
          title="Coming soon"
          disabled
        >
          <span className="mr-1.5">⌗</span> Spaces
        </button>
        <button
          type="button"
          className="py-2 border-b-2 border-transparent text-ink-400 hover:text-ink-600 cursor-not-allowed"
          title="Coming soon"
          disabled
        >
          <span className="mr-1.5">↹</span> Allocations
        </button>
      </div>

      {/* ------------------------ Body ------------------------------- */}
      <div className="flex-1 min-h-0 flex">
        {/* Main grid */}
        <section className="flex-1 min-w-0 flex flex-col border-r border-ink-100">
          {/* View pills */}
          <div className="shrink-0 px-4 py-2 border-b border-ink-100 flex items-center gap-1 text-[12px]">
            <button type="button" className="px-2 py-1 rounded-md text-focus-700 bg-focus-50 font-medium">
              List
            </button>
            <button
              type="button"
              className="px-2 py-1 rounded-md text-ink-400 cursor-not-allowed"
              title="Coming soon"
              disabled
            >
              Timeline
            </button>
            <button
              type="button"
              className="px-2 py-1 rounded-md text-ink-400 cursor-not-allowed"
              title="Coming soon"
              disabled
            >
              Dynamic
            </button>
            <span className="ml-2 w-px h-4 bg-ink-100" />
            <button
              type="button"
              className="ml-2 px-2 py-1 rounded-md text-ink-500 hover:bg-ink-50"
              title="Toggle filters (coming soon)"
            >
              ☰
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-auto">
            {/* Header row */}
            <div className="grid grid-cols-[minmax(280px,2fr)_90px_90px_140px_80px_90px_40px] items-center px-4 py-2 text-[11px] uppercase tracking-wide text-ink-500 border-b border-ink-100 sticky top-0 bg-paper z-10">
              <div>Name</div>
              <div>Start on</div>
              <div>Duration</div>
              <div>Assignee</div>
              <div>Effort</div>
              <div>Billing</div>
              <div />
            </div>

            {modules.map((m) => {
              const phaseSelected =
                selection?.kind === 'phase' && selection.moduleId === m.id;
              return (
                <div key={m.id} className="border-b border-ink-50">
                  {/* Phase row */}
                  <div
                    className={`group grid grid-cols-[minmax(280px,2fr)_90px_90px_140px_80px_90px_40px] items-center px-4 py-2 text-[13px] hover:bg-ink-50/40 cursor-pointer ${
                      phaseSelected ? 'bg-focus-50/40' : ''
                    }`}
                    onClick={() => {
                      setSelection({ kind: 'phase', moduleId: m.id });
                      setActiveTab('phase');
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateModule(m.id, { collapsed: !m.collapsed });
                        }}
                        className="w-4 h-4 text-ink-500 hover:text-ink-700 flex items-center justify-center"
                      >
                        <span className="text-[10px]">{m.collapsed ? '▶' : '▼'}</span>
                      </button>
                      <span
                        className="w-3.5 h-3.5 rounded-full border-2 border-ink-300 shrink-0"
                        aria-hidden
                      />
                      <input
                        value={m.name}
                        onChange={(e) => updateModule(m.id, { name: e.target.value })}
                        disabled={readOnly}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 min-w-0 bg-transparent border-0 outline-none focus:ring-0 px-0 py-0 text-[13px] font-medium text-ink-900"
                        placeholder="Phase name"
                      />
                    </div>
                    <NumberCell
                      value={m.startOffsetDays}
                      onChange={(v) => updateModule(m.id, { startOffsetDays: v })}
                      disabled={readOnly}
                      formatter={fmtDays}
                    />
                    <NumberCell
                      value={m.durationDays}
                      onChange={(v) => updateModule(m.id, { durationDays: v })}
                      disabled={readOnly}
                      formatter={fmtDays}
                    />
                    <div onClick={(e) => e.stopPropagation()}>
                      <MemberPicker
                        compact
                        value={{ userId: m.ownerUserId, label: m.ownerPlaceholder }}
                        options={members}
                        loading={membersLoading}
                        disabled={readOnly}
                        placeholder="Unassigned"
                        onChange={({ user, freeText }) => {
                          if (user) {
                            updateModule(m.id, {
                              ownerUserId: user._id,
                              ownerPlaceholder: user.name || user.email || 'Member',
                            });
                          } else {
                            updateModule(m.id, {
                              ownerUserId: null,
                              ownerPlaceholder: freeText || '',
                            });
                          }
                        }}
                        onClear={() =>
                          updateModule(m.id, { ownerUserId: null, ownerPlaceholder: '' })
                        }
                      />
                    </div>
                    <NumberCell
                      value={m.budgetHours}
                      onChange={(v) => updateModule(m.id, { budgetHours: v })}
                      disabled={readOnly}
                      formatter={fmtHours}
                    />
                    <div className="text-ink-400 text-[12px]">–</div>
                    <div className="text-right">
                      {!readOnly ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removePhase(m.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 hover:text-red-600 text-ink-400 px-1"
                          title="Remove phase"
                        >
                          ×
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* Tasks */}
                  {!m.collapsed
                    ? m.workstreams.map((w) => {
                        const taskSelected =
                          selection?.kind === 'task' &&
                          selection.workstreamId === w.id;
                        return (
                          <div
                            key={w.id}
                            className={`group grid grid-cols-[minmax(280px,2fr)_90px_90px_140px_80px_90px_40px] items-center pl-12 pr-4 py-1.5 text-[13px] hover:bg-ink-50/40 cursor-pointer ${
                              taskSelected ? 'bg-focus-50/40' : ''
                            }`}
                            onClick={() => {
                              setSelection({ kind: 'task', moduleId: m.id, workstreamId: w.id });
                              setActiveTab('phase');
                            }}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-3.5 h-3.5 rounded-full border-2 border-ink-300 shrink-0"
                                aria-hidden
                              />
                              <input
                                value={w.name}
                                onChange={(e) => updateWorkstream(m.id, w.id, { name: e.target.value })}
                                disabled={readOnly}
                                onClick={(e) => e.stopPropagation()}
                                className="flex-1 min-w-0 bg-transparent border-0 outline-none focus:ring-0 px-0 py-0 text-[13px] text-ink-800"
                                placeholder="Task name"
                              />
                            </div>
                            <NumberCell
                              value={w.startOffsetDays}
                              onChange={(v) => updateWorkstream(m.id, w.id, { startOffsetDays: v })}
                              disabled={readOnly}
                              formatter={fmtDays}
                            />
                            <NumberCell
                              value={w.durationDays}
                              onChange={(v) => updateWorkstream(m.id, w.id, { durationDays: v })}
                              disabled={readOnly}
                              formatter={fmtDays}
                            />
                            <div onClick={(e) => e.stopPropagation()}>
                              <MemberPicker
                                compact
                                value={{ userId: w.ownerUserId, label: w.ownerPlaceholder }}
                                options={members}
                                loading={membersLoading}
                                disabled={readOnly}
                                placeholder="Unassigned"
                                onChange={({ user, freeText }) => {
                                  if (user) {
                                    updateWorkstream(m.id, w.id, {
                                      ownerUserId: user._id,
                                      ownerPlaceholder: user.name || user.email || 'Member',
                                    });
                                  } else {
                                    updateWorkstream(m.id, w.id, {
                                      ownerUserId: null,
                                      ownerPlaceholder: freeText || '',
                                    });
                                  }
                                }}
                                onClear={() =>
                                  updateWorkstream(m.id, w.id, {
                                    ownerUserId: null,
                                    ownerPlaceholder: '',
                                  })
                                }
                              />
                            </div>
                            <NumberCell
                              value={w.budgetHours}
                              onChange={(v) => updateWorkstream(m.id, w.id, { budgetHours: v })}
                              disabled={readOnly}
                              formatter={fmtHours}
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (readOnly) return;
                                updateWorkstream(m.id, w.id, { billable: !w.billable });
                              }}
                              disabled={readOnly}
                              className="text-left text-[12px] text-ink-600 hover:text-ink-900"
                              title="Click to toggle billable"
                            >
                              {w.billable ? 'billable' : '–'}
                            </button>
                            <div className="text-right">
                              {!readOnly ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeTask(m.id, w.id);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 hover:text-red-600 text-ink-400 px-1"
                                  title="Remove task"
                                >
                                  ×
                                </button>
                              ) : null}
                            </div>
                          </div>
                        );
                      })
                    : null}

                  {/* Add task footer for phase */}
                  {!m.collapsed && !readOnly ? (
                    <div className="pl-12 pr-4 py-1.5 text-[12px] text-ink-500 flex items-center gap-3">
                      <button
                        type="button"
                        className="text-focus-700 hover:underline"
                        onClick={() => addTask(m.id)}
                      >
                        + Add new task
                      </button>
                      <span className="text-ink-300">or</span>
                      <button
                        type="button"
                        className="text-focus-700 hover:underline"
                        onClick={() => addTask(m.id)}
                      >
                        Add ▾
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}

            {!readOnly ? (
              <div className="px-4 py-3">
                <button
                  type="button"
                  className="text-[13px] text-focus-700 hover:underline"
                  onClick={addPhase}
                >
                  + Add new phase
                </button>
              </div>
            ) : null}
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t border-ink-100 px-4 py-2 text-[12px] text-ink-500 flex items-center justify-between">
            <span>Budgeted hours: <strong className="text-ink-800">{fmtHours(totalHours)}</strong></span>
            <span>
              {modules.length} phase{modules.length === 1 ? '' : 's'} ·{' '}
              {modules.reduce((s, m) => s + (m.workstreams?.length || 0), 0)} task
              {modules.reduce((s, m) => s + (m.workstreams?.length || 0), 0) === 1 ? '' : 's'}
            </span>
          </div>
        </section>

        {/* Right detail panel */}
        <aside className="w-[360px] shrink-0 flex flex-col bg-paper">
          {selection && (selectedModule || selectedWorkstream) ? (
            <>
              <div className="px-5 pt-4">
                <h2 className="m-0 text-[15px] font-semibold text-ink-900">
                  {selection.kind === 'task' ? selectedWorkstream?.name : selectedModule?.name}
                </h2>
              </div>
              <div className="px-5 mt-3 border-b border-ink-100 flex gap-4 text-[12px]">
                {[
                  { id: 'phase', label: selection.kind === 'task' ? 'Task details' : 'Phase details' },
                  { id: 'automations', label: 'Automations' },
                  { id: 'events', label: 'Key events' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id)}
                    className={`pb-2 border-b-2 ${
                      activeTab === t.id
                        ? 'border-ink-900 text-ink-900 font-medium'
                        : 'border-transparent text-ink-500 hover:text-ink-700'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4">
                {activeTab === 'phase' ? (
                  <DetailForm
                    selection={selection}
                    module={selectedModule}
                    workstream={selectedWorkstream}
                    readOnly={readOnly}
                    members={members}
                    membersLoading={membersLoading}
                    onModulePatch={(patch) => updateModule(selection.moduleId, patch)}
                    onWorkstreamPatch={(patch) =>
                      updateWorkstream(selection.moduleId, selection.workstreamId, patch)
                    }
                  />
                ) : null}
                {activeTab === 'automations' ? (
                  <ListEditor
                    title="Automations"
                    description="Auto-actions to run when this stage hits its trigger condition (e.g. 'Email customer when complete')."
                    items={
                      selection.kind === 'task'
                        ? selectedWorkstream?.automations || []
                        : selectedModule?.automations || []
                    }
                    disabled={readOnly}
                    onChange={(items) =>
                      selection.kind === 'task'
                        ? updateWorkstream(selection.moduleId, selection.workstreamId, { automations: items })
                        : updateModule(selection.moduleId, { automations: items })
                    }
                    placeholder="Notify customer success on completion"
                  />
                ) : null}
                {activeTab === 'events' ? (
                  <ListEditor
                    title="Key events"
                    description="Milestones surfaced in stage-gate views and roadmaps."
                    items={
                      selection.kind === 'task'
                        ? selectedWorkstream?.keyEvents || []
                        : selectedModule?.keyEvents || []
                    }
                    disabled={readOnly}
                    onChange={(items) =>
                      selection.kind === 'task'
                        ? updateWorkstream(selection.moduleId, selection.workstreamId, { keyEvents: items })
                        : updateModule(selection.moduleId, { keyEvents: items })
                    }
                    placeholder="Design sign-off"
                  />
                ) : null}
              </div>
            </>
          ) : (
            <div className="px-5 py-6 text-[12px] text-ink-500">
              Select a phase or task on the left to edit its details.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function NumberCell({ value, onChange, disabled, formatter }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ''));
  useEffect(() => {
    if (!editing) setDraft(String(value ?? ''));
  }, [value, editing]);

  if (editing && !disabled) {
    return (
      <input
        type="number"
        min={0}
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          const n = Number(draft);
          onChange(Number.isFinite(n) && n >= 0 ? n : Number(value) || 0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            setEditing(false);
            setDraft(String(value ?? ''));
          }
        }}
        className="w-full border border-ink-200 rounded-md px-1.5 py-0.5 text-[12px] bg-paper"
        onClick={(e) => e.stopPropagation()}
      />
    );
  }
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) setEditing(true);
      }}
      className={`text-left text-[12px] ${disabled ? 'text-ink-400' : 'text-ink-700 hover:text-ink-900'}`}
    >
      {formatter ? formatter(value) : value}
    </button>
  );
}

function DetailForm({
  selection,
  module: phase,
  workstream,
  readOnly,
  members,
  membersLoading,
  onModulePatch,
  onWorkstreamPatch,
}) {
  const isTask = selection.kind === 'task' && workstream;
  const target = isTask ? workstream : phase;
  const patch = isTask ? onWorkstreamPatch : onModulePatch;
  if (!target) return null;
  return (
    <div className="space-y-3">
      <div className="bg-ink-50/40 border border-ink-100 rounded-md p-3 space-y-3">
        <div>
          <p className="m-0 text-[12px] font-medium text-ink-700 mb-1">{isTask ? 'Task info' : 'Phase info'}</p>
        </div>
        <label className="block text-[11px] font-medium text-ink-600">
          Description
          <textarea
            rows={3}
            value={target.description || ''}
            onChange={(e) => patch({ description: e.target.value })}
            disabled={readOnly}
            placeholder={`Describe the objective and exit criteria for this ${isTask ? 'task' : 'phase'}.`}
            className="mt-1 w-full border border-ink-200 rounded-md px-2 py-1.5 text-[13px] bg-paper resize-none"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-[11px] font-medium text-ink-600">
            Start offset
            <input
              type="number"
              min={0}
              value={target.startOffsetDays ?? 0}
              onChange={(e) => patch({ startOffsetDays: Number(e.target.value) })}
              disabled={readOnly}
              className="mt-1 w-full border border-ink-200 rounded-md px-2 py-1.5 text-[13px] bg-paper"
            />
          </label>
          <label className="block text-[11px] font-medium text-ink-600">
            Duration days
            <input
              type="number"
              min={0}
              value={target.durationDays ?? 1}
              onChange={(e) => patch({ durationDays: Number(e.target.value) })}
              disabled={readOnly}
              className="mt-1 w-full border border-ink-200 rounded-md px-2 py-1.5 text-[13px] bg-paper"
            />
          </label>
        </div>
        <div className="block text-[11px] font-medium text-ink-600">
          Assignee
          <div className="mt-1">
            <MemberPicker
              value={{ userId: target.ownerUserId, label: target.ownerPlaceholder }}
              options={members}
              loading={membersLoading}
              disabled={readOnly}
              placeholder="Unassigned"
              align="right"
              onChange={({ user, freeText }) => {
                if (user) {
                  patch({
                    ownerUserId: user._id,
                    ownerPlaceholder: user.name || user.email || 'Member',
                  });
                } else {
                  patch({ ownerUserId: null, ownerPlaceholder: freeText || '' });
                }
              }}
              onClear={() => patch({ ownerUserId: null, ownerPlaceholder: '' })}
            />
          </div>
          {target.ownerUserId ? (
            <p className="m-0 mt-1 text-[10px] text-emerald-700">
              Assigned to a real member — tasks created from this template will be assigned automatically.
            </p>
          ) : (
            <p className="m-0 mt-1 text-[10px] text-ink-400">
              No member bound. The placeholder text is just a hint for whoever instantiates the project.
            </p>
          )}
        </div>
        <label className="block text-[11px] font-medium text-ink-600">
          Effort (hours)
          <input
            type="number"
            min={0}
            value={target.budgetHours ?? 0}
            onChange={(e) => patch({ budgetHours: Number(e.target.value) })}
            disabled={readOnly}
            className="mt-1 w-full border border-ink-200 rounded-md px-2 py-1.5 text-[13px] bg-paper"
          />
        </label>
        {isTask ? (
          <label className="flex items-center gap-2 text-[12px] text-ink-700">
            <input
              type="checkbox"
              checked={!!target.billable}
              onChange={(e) => patch({ billable: e.target.checked })}
              disabled={readOnly}
            />
            Billable
          </label>
        ) : null}
      </div>
    </div>
  );
}

function ListEditor({ title, description, items, onChange, disabled, placeholder }) {
  const [draft, setDraft] = useState('');
  return (
    <div className="space-y-2">
      <p className="m-0 text-[12px] text-ink-500 leading-relaxed">{description}</p>
      <ul className="space-y-1">
        {(items || []).map((it, idx) => (
          <li
            key={`${it}-${idx}`}
            className="flex items-center gap-2 text-[13px] text-ink-700 bg-ink-50/60 border border-ink-100 rounded-md px-2 py-1"
          >
            <span className="flex-1 min-w-0 truncate">{it}</span>
            {!disabled ? (
              <button
                type="button"
                onClick={() => onChange(items.filter((_, i) => i !== idx))}
                className="text-ink-400 hover:text-red-600 px-1"
                title={`Remove ${title.toLowerCase()}`}
              >
                ×
              </button>
            ) : null}
          </li>
        ))}
        {(items || []).length === 0 ? (
          <li className="text-[12px] text-ink-400">No {title.toLowerCase()} yet.</li>
        ) : null}
      </ul>
      {!disabled ? (
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder || `Add ${title.toLowerCase()}…`}
            className="flex-1 border border-ink-200 rounded-md px-2 py-1.5 text-[13px] bg-paper"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && draft.trim()) {
                onChange([...(items || []), draft.trim()]);
                setDraft('');
              }
            }}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              if (!draft.trim()) return;
              onChange([...(items || []), draft.trim()]);
              setDraft('');
            }}
          >
            Add
          </Button>
        </div>
      ) : null}
    </div>
  );
}
