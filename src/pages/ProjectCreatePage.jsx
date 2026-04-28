import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { intakeAPI, projectTemplatesAPI, projectsAPI, resourcesAPI, usersAPI } from '../services/api';
import Avatar from '../components/Avatar';
import Button from '../components/Button';
import MemberPicker from '../components/MemberPicker';
import { DELIVERY_PHASES } from '../constants/deliveryPhases';

const STEPS = ['Basic info', 'Project team', 'Customer team', 'Project fields'];

const DEFAULT_MODULES = [
  {
    name: 'Kickoff & discovery',
    budgetHours: 160,
    workstreams: [
      { name: 'Inception - Kickoff & discovery', budgetHours: 80, memberIds: [], tasks: ['Project kickoff', 'Confirm scope and success criteria'] },
    ],
  },
  {
    name: 'Configuration',
    budgetHours: 240,
    workstreams: [
      { name: 'Elaboration - Configuration', budgetHours: 120, memberIds: [], tasks: ['Configure tenant', 'Review configuration with customer'] },
    ],
  },
  {
    name: 'UAT & go-live',
    budgetHours: 220,
    workstreams: [
      { name: 'Transition - UAT & go-live', budgetHours: 110, memberIds: [], tasks: ['Run UAT', 'Go-live readiness sign-off'] },
    ],
  },
];

/** Phase labels used by the backend when a built-in template doesn't carry explicit workstream names. */
const BUILT_IN_PHASE_LABELS = ['Inception', 'Elaboration', 'Configuration', 'Transition', 'Hypercare'];

function cloneModules(mods) {
  return JSON.parse(JSON.stringify(mods));
}

/**
 * Convert a project-template detail response (from GET /api/project-templates/:id)
 * into the local module-editor shape. Works for both built-in and custom templates.
 *
 * - Custom modules carry an explicit `workstreams: string[]` — used verbatim.
 * - Built-in modules carry `phaseCount` only — synthesise phased names locally so the
 *   editor pre-populates with sensible workstream rows the user can rename.
 */
function moduleDetailsToEditableModules(moduleDetails) {
  if (!Array.isArray(moduleDetails) || moduleDetails.length === 0) return null;
  return moduleDetails.map((m) => {
    const totalBudget = Number(m.budgetHours) || 0;
    const explicit = Array.isArray(m.workstreams)
      ? m.workstreams.map((w) => (typeof w === 'string' ? w : w?.name)).filter(Boolean)
      : [];
    const wsNames = explicit.length
      ? explicit
      : (() => {
          const n = Math.max(2, Math.min(BUILT_IN_PHASE_LABELS.length, Number(m.phaseCount) || 3));
          const short = String(m.name || '').slice(0, 28);
          return BUILT_IN_PHASE_LABELS.slice(0, n).map((phase) => `${phase} - ${short}`);
        })();
    const perWs = wsNames.length > 0 ? Math.max(24, Math.round(totalBudget / wsNames.length)) : totalBudget;
    return {
      name: m.name || '',
      budgetHours: totalBudget,
      workstreams: wsNames.map((nm) => ({
        name: nm,
        budgetHours: perWs,
        memberIds: [],
        tasks: ['Plan and kick off', 'Checkpoint / sign-off'],
      })),
    };
  });
}

const input = {
  height: 34,
  border: '1px solid #e5e7eb',
  borderRadius: 6,
  padding: '0 10px',
  fontSize: 13,
  background: '#fff',
  width: '100%',
};

function addDays(value, days) {
  const d = value ? new Date(`${value}T12:00:00`) : new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function Field({ label, required, children }) {
  return (
    <label style={{ display: 'grid', gap: 6, fontSize: 12, color: '#4b5563', fontWeight: 500 }}>
      <span>{required ? `* ${label}` : label}</span>
      {children}
    </label>
  );
}

function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || 'P';
}

export default function ProjectCreatePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const hubspotPrefill = location.state?.hubspotPrefill || null;
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [availability, setAvailability] = useState([]);
  const [availabilityError, setAvailabilityError] = useState('');
  const [clients, setClients] = useState([]);
  const [clientMode, setClientMode] = useState('existing');

  const [basic, setBasic] = useState({
    clientName: '',
    name: '',
    status: 'Draft',
    customerPortalTemplate: '',
    startDate: today,
    goLiveDate: addDays(today, 90),
    deliveryPhase: 'Sales Handover',
    tier: 'Tier 2',
    visibility: 'Everyone',
    clientUserId: '',
    newClientEmail: '',
    hubspotDealId: '',
    accountOwner: '',
  });
  const [team, setTeam] = useState({
    projectOwnerId: '',
    memberIds: [],
  });
  const [customerTeam, setCustomerTeam] = useState([{ name: '', email: '' }]);
  const [fields, setFields] = useState({
    currency: 'USD',
    arr: '',
    projectFee: '',
  });
  const [modules, setModules] = useState(() => cloneModules(DEFAULT_MODULES));
  /** Templates catalog (built-in + custom) loaded from the API for the dropdown. */
  const [templateCatalog, setTemplateCatalog] = useState([]);
  const [templateCatalogError, setTemplateCatalogError] = useState('');
  const [loadingTemplateDetail, setLoadingTemplateDetail] = useState(false);

  useEffect(() => {
    let active = true;
    if (!basic.startDate || !basic.goLiveDate) return undefined;
    setAvailabilityError('');
    resourcesAPI
      .availability({ startDate: basic.startDate, endDate: basic.goLiveDate })
      .then(({ data }) => {
        if (!active) return;
        setAvailability(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        if (!active) return;
        setAvailability([]);
        setAvailabilityError(e?.response?.data?.message || 'Could not load member availability');
      });
    return () => {
      active = false;
    };
  }, [basic.startDate, basic.goLiveDate]);

  useEffect(() => {
    let active = true;
    setTemplateCatalogError('');
    projectTemplatesAPI
      .getCatalog()
      .then(({ data }) => {
        if (!active) return;
        setTemplateCatalog(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        if (!active) return;
        setTemplateCatalog([]);
        setTemplateCatalogError(e?.response?.data?.message || 'Could not load templates');
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    usersAPI
      .getClients()
      .then(({ data }) => {
        if (!active) return;
        setClients(Array.isArray(data) ? data : []);
      })
      .catch(() => setClients([]));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hubspotPrefill) return;
    const scopeModules = Array.isArray(hubspotPrefill.scopedModules)
      ? hubspotPrefill.scopedModules
      : [];
    setClientMode('new');
    setBasic((b) => ({
      ...b,
      clientName: hubspotPrefill.clientName || '',
      name: hubspotPrefill.name || `${hubspotPrefill.clientName || 'HubSpot'} implementation`,
      goLiveDate: hubspotPrefill.goLiveDate || b.goLiveDate,
      hubspotDealId: hubspotPrefill.hubspotDealId || '',
      accountOwner: hubspotPrefill.accountOwner || '',
      newClientEmail:
        hubspotPrefill.clientEmail ||
        `hubspot-${String(hubspotPrefill.hubspotDealId || Date.now()).toLowerCase()}@client.udip.local`,
    }));
    setFields((f) => ({
      ...f,
      projectFee: String(hubspotPrefill.contractValue ?? ''),
      arr: String(hubspotPrefill.notionalARR ?? ''),
    }));
    if (scopeModules.length) {
      setModules(
        scopeModules.map((name) => ({
          name,
          budgetHours: 120,
          workstreams: [
            {
              name: `Delivery - ${name}`,
              budgetHours: 80,
              memberIds: [],
              tasks: [`Configure ${name}`, `Validate ${name}`, `${name} sign-off`],
            },
          ],
        }))
      );
    }
  }, [hubspotPrefill]);

  useEffect(() => {
    if (!hubspotPrefill || !clients.length) return;
    const match = clients.find(
      (c) => String(c.name || '').trim().toLowerCase() === String(hubspotPrefill.clientName || '').trim().toLowerCase()
    );
    if (match) {
      setClientMode('existing');
      chooseClient(match._id);
    }
  }, [clients, hubspotPrefill]);

  const availableMembers = useMemo(() => {
    return availability
      .filter((p) => ['member', 'pm', 'dh'].includes(p.role))
      .filter((p) => Number(p.freeHours || 0) > 0)
      .sort((a, b) => Number(b.freeHours || 0) - Number(a.freeHours || 0));
  }, [availability]);

  useEffect(() => {
    if (!team.projectOwnerId && availableMembers.length) {
      const preferred = availableMembers.find((p) => p.role === 'pm') || availableMembers[0];
      setTeam((prev) => ({ ...prev, projectOwnerId: preferred.userId }));
    }
  }, [availableMembers, team.projectOwnerId]);

  const selectedTeam = useMemo(() => {
    const ids = new Set(team.memberIds.map(String));
    return availableMembers.filter((m) => ids.has(String(m.userId)));
  }, [availableMembers, team.memberIds]);

  const selectedOwner = availableMembers.find((m) => String(m.userId) === String(team.projectOwnerId));

  // Invite popover state.
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteSearch, setInviteSearch] = useState('');
  const inviteWrapperRef = useRef(null);
  const inviteSearchRef = useRef(null);

  useEffect(() => {
    if (!inviteOpen) {
      setInviteSearch('');
      return undefined;
    }
    const handler = (e) => {
      if (!inviteWrapperRef.current) return;
      if (!inviteWrapperRef.current.contains(e.target)) setInviteOpen(false);
    };
    document.addEventListener('mousedown', handler);
    // Focus search after the popover mounts.
    setTimeout(() => inviteSearchRef.current?.focus(), 0);
    return () => document.removeEventListener('mousedown', handler);
  }, [inviteOpen]);

  const filteredInviteCandidates = useMemo(() => {
    const q = inviteSearch.trim().toLowerCase();
    const list = q
      ? availableMembers.filter((m) => {
          const name = (m.name || '').toLowerCase();
          const role = (m.role || '').toLowerCase();
          const email = (m.email || '').toLowerCase();
          return name.includes(q) || role.includes(q) || email.includes(q);
        })
      : availableMembers;
    return list;
  }, [availableMembers, inviteSearch]);

  // Subtitle helper for the owner picker.
  const ownerSubtitle = (m) => {
    const role = m?.role || '';
    const free = Math.round(m?.freeHours || 0);
    const cap = Math.round(m?.capacityHours || 0);
    return `${role}${cap ? ` · ${free}h free of ${cap}h` : ` · ${free}h free`}`;
  };
  const selectedClient = clients.find((c) => String(c._id) === String(basic.clientUserId));

  const setModule = (idx, patch) => {
    setModules((prev) => prev.map((m, i) => (i === idx ? { ...m, ...patch } : m)));
  };

  const setWorkstream = (mi, wi, patch) => {
    setModules((prev) =>
      prev.map((m, i) => {
        if (i !== mi) return m;
        return {
          ...m,
          workstreams: m.workstreams.map((w, j) => (j === wi ? { ...w, ...patch } : w)),
        };
      })
    );
  };

  const setTaskTitle = (mi, wi, ti, title) => {
    setModules((prev) =>
      prev.map((m, i) => {
        if (i !== mi) return m;
        return {
          ...m,
          workstreams: m.workstreams.map((w, j) => {
            if (j !== wi) return w;
            return { ...w, tasks: w.tasks.map((t, k) => (k === ti ? title : t)) };
          }),
        };
      })
    );
  };

  const addModule = () => {
    setModules((prev) => [
      ...prev,
      { name: 'New module', budgetHours: 120, workstreams: [{ name: 'New workstream', budgetHours: 60, memberIds: [], tasks: ['New task'] }] },
    ]);
  };

  const addWorkstream = (mi) => {
    setModules((prev) =>
      prev.map((m, i) =>
        i === mi
          ? { ...m, workstreams: [...m.workstreams, { name: 'New workstream', budgetHours: 60, memberIds: [], tasks: ['New task'] }] }
          : m
      )
    );
  };

  const addTask = (mi, wi) => {
    setModules((prev) =>
      prev.map((m, i) =>
        i === mi
          ? {
              ...m,
              workstreams: m.workstreams.map((w, j) =>
                j === wi ? { ...w, tasks: [...w.tasks, 'New task'] } : w
              ),
            }
          : m
      )
    );
  };

  const removeModule = (mi) => {
    setModules((prev) => prev.filter((_, i) => i !== mi));
  };

  const removeWorkstream = (mi, wi) => {
    setModules((prev) =>
      prev.map((m, i) => (i === mi ? { ...m, workstreams: m.workstreams.filter((_, j) => j !== wi) } : m))
    );
  };

  const removeTask = (mi, wi, ti) => {
    setModules((prev) =>
      prev.map((m, i) =>
        i === mi
          ? {
              ...m,
              workstreams: m.workstreams.map((w, j) =>
                j === wi ? { ...w, tasks: w.tasks.filter((_, k) => k !== ti) } : w
              ),
            }
          : m
      )
    );
  };

  const toggleWorkstreamMember = (mi, wi, memberId) => {
    setModules((prev) =>
      prev.map((m, i) => {
        if (i !== mi) return m;
        return {
          ...m,
          workstreams: m.workstreams.map((w, j) => {
            if (j !== wi) return w;
            const ids = new Set((w.memberIds || []).map(String));
            if (ids.has(String(memberId))) ids.delete(String(memberId));
            else ids.add(String(memberId));
            return { ...w, memberIds: [...ids] };
          }),
        };
      })
    );
  };

  const toggleMember = (id) => {
    setTeam((prev) => {
      const s = new Set(prev.memberIds.map(String));
      if (s.has(String(id))) s.delete(String(id));
      else s.add(String(id));
      return { ...prev, memberIds: [...s] };
    });
  };

  /**
   * Fetch the chosen template (built-in or custom) and hydrate the modules editor.
   * Empty value resets to the default starter plan.
   */
  const chooseTemplate = async (templateId) => {
    setBasic((b) => ({ ...b, customerPortalTemplate: templateId }));
    if (!templateId) {
      setModules(cloneModules(DEFAULT_MODULES));
      return;
    }
    setLoadingTemplateDetail(true);
    setError('');
    try {
      const { data } = await projectTemplatesAPI.getById(templateId);
      const mapped = moduleDetailsToEditableModules(data?.moduleDetails);
      if (mapped && mapped.length) {
        setModules(mapped);
      } else {
        setModules(cloneModules(DEFAULT_MODULES));
      }
      if (data?.defaultTier && !basic.tier) {
        setBasic((b) => ({ ...b, tier: data.defaultTier }));
      }
      if (data?.defaultDeliveryPhase && !basic.deliveryPhase) {
        setBasic((b) => ({ ...b, deliveryPhase: data.defaultDeliveryPhase }));
      }
    } catch (e) {
      setError(e?.response?.data?.message || 'Could not load that template — using starter plan instead.');
      setModules(cloneModules(DEFAULT_MODULES));
    } finally {
      setLoadingTemplateDetail(false);
    }
  };

  const chooseClient = (clientId) => {
    const c = clients.find((x) => String(x._id) === String(clientId));
    setBasic((b) => ({
      ...b,
      clientUserId: clientId,
      clientName: c?.name || '',
      newClientEmail: c?.email || '',
    }));
  };

  const canNext = () => {
    if (step === 0) {
      const hasClient = clientMode === 'existing' ? !!basic.clientUserId : basic.clientName.trim() && basic.newClientEmail.trim();
      return hasClient && basic.name.trim() && basic.startDate && basic.goLiveDate;
    }
    if (step === 1) return !!team.projectOwnerId;
    return true;
  };

  const submit = async () => {
    if (!canNext()) {
      setError('Please complete required fields before continuing.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const firstAssignee = selectedTeam[0]?.userId || team.projectOwnerId || null;
      let clientUserId = basic.clientUserId || '';
      let createdClientCredentials = null;
      if (clientMode === 'new') {
        const email = basic.newClientEmail.trim();
        if (!email) {
          setError('New client email is required.');
          setSaving(false);
          return;
        }
        const password = `Client@${Date.now()}`;
        const created = await usersAPI.create({
          name: basic.clientName.trim(),
          email,
          password,
          role: 'client',
        });
        clientUserId = created?.data?.user?._id || '';
        createdClientCredentials = {
          clientName: basic.clientName.trim(),
          email,
          password,
          createdAt: new Date().toISOString(),
        };
      }
      const payload = {
        name: basic.name.trim(),
        clientName: basic.clientName.trim(),
        status: basic.status,
        goLiveDate: new Date(`${basic.goLiveDate}T12:00:00`).toISOString(),
        startDate: new Date(`${basic.startDate}T12:00:00`).toISOString(),
        deliveryPhase: basic.deliveryPhase,
        tier: basic.tier,
        projectManagerId: team.projectOwnerId,
        contractValue: Number(fields.projectFee || 0),
        implementationFee: Number(fields.projectFee || 0),
        notionalARR: Number(fields.arr || 0),
        region: 'India',
        clientUserId,
        hubspotDealId: basic.hubspotDealId || null,
        projectTeam: team.memberIds,
        customerTeam: customerTeam.filter((c) => c.name || c.email),
        modules: modules
          .filter((m) => String(m.name || '').trim())
          .map((m) => ({
            name: m.name,
            budgetHours: Number(m.budgetHours || 0),
            workstreams: (m.workstreams || [])
              .filter((w) => String(w.name || '').trim())
              .map((w, wi) => ({
                name: w.name,
                budgetHours: Number(w.budgetHours || 0),
                leadId: team.projectOwnerId,
                memberIds: (w.memberIds && w.memberIds.length ? w.memberIds : team.memberIds),
                tasks: (w.tasks || [])
                  .filter((title) => String(title || '').trim())
                  .map((title, ti) => ({
                    title,
                    owner: selectedOwner?.name || 'Project Manager',
                    assignedTo: selectedTeam[(wi + ti) % Math.max(1, selectedTeam.length)]?.userId || firstAssignee,
                    dueDate: new Date(`${addDays(basic.startDate, 10 + wi * 10 + ti * 4)}T12:00:00`).toISOString(),
                  })),
              })),
          })),
      };
      const { data } = await projectsAPI.createFull(payload);
      const id = data?.project?._id || data?._id;
      if (createdClientCredentials) {
        const existing = JSON.parse(sessionStorage.getItem('newClientCredentials') || '[]');
        sessionStorage.setItem('newClientCredentials', JSON.stringify([createdClientCredentials, ...existing].slice(0, 10)));
      }
      if (basic.hubspotDealId) {
        await intakeAPI.markIntaken(basic.hubspotDealId, id).catch(() => {});
      }
      navigate(id ? `/projects/${id}` : '/projects');
    } catch (e) {
      setError(e?.response?.data?.message || 'Could not create project');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ minHeight: '100%', background: '#f3f4f6', padding: 28 }}>
      <div
        style={{
          maxWidth: 1240,
          margin: '0 auto',
          background: '#fff',
          borderRadius: 10,
          border: '1px solid #e5e7eb',
          boxShadow: '0 18px 40px rgba(15,23,42,0.12)',
          overflow: 'hidden',
          display: 'grid',
          gridTemplateColumns: '270px 1fr',
          minHeight: 'calc(100vh - 76px)',
        }}
      >
        <aside style={{ borderRight: '1px solid #eef2f7', padding: 28, background: '#fbfbfd' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 26 }}>
            <div style={{ width: 72, height: 72, borderRadius: 18, background: '#f3f4f6', display: 'grid', placeItems: 'center', fontSize: 28 }}>▦</div>
            <div style={{ color: '#6b7280', fontSize: 24 }}>↔</div>
            <div style={{ width: 72, height: 72, borderRadius: 18, background: 'linear-gradient(135deg,#8b5cf6,#6d28d9)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 28, fontWeight: 700 }}>
              {initials(basic.clientName || basic.name)}
            </div>
          </div>
          <h3 style={{ margin: 0, fontSize: 18, color: '#111827' }}>{basic.clientName || 'New customer'}</h3>
          <p style={{ margin: '4px 0 22px', fontSize: 12, color: '#6b7280' }}>{basic.name || 'Project name'}</p>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 18 }}>
            <strong style={{ display: 'block', color: '#374151', marginBottom: 6 }}>Project owner</strong>
            {selectedOwner?.name || 'Choose available owner'}
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 18 }}>
            <strong style={{ display: 'block', color: '#374151', marginBottom: 6 }}>Project team</strong>
            {selectedTeam.length ? `${selectedTeam.length} available member(s)` : 'No members selected'}
          </div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>
            <strong style={{ display: 'block', color: '#374151', marginBottom: 6 }}>Work plan</strong>
            {modules.length} modules · {modules.reduce((s, m) => s + (m.workstreams?.length || 0), 0)} workstreams
          </div>
        </aside>

        <main style={{ display: 'grid', gridTemplateRows: 'auto 1fr auto' }}>
          <header style={{ padding: '22px 28px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: '#111827' }}>New project</h1>
              <Link to="/projects" style={{ fontSize: 12, color: '#6b7280' }}>Cancel</Link>
            </div>
            <div style={{ height: 3, background: '#e9d5ff', marginTop: 14, position: 'relative' }}>
              <div style={{ width: `${((step + 1) / STEPS.length) * 100}%`, height: '100%', background: '#7c3aed' }} />
            </div>
            <nav style={{ display: 'grid', gridTemplateColumns: `repeat(${STEPS.length}, 1fr)`, marginTop: 8 }}>
              {STEPS.map((s, i) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStep(i)}
                  style={{
                    border: 0,
                    background: 'transparent',
                    textAlign: 'left',
                    fontSize: 12,
                    color: i === step ? '#6d28d9' : '#6b7280',
                    fontWeight: i === step ? 700 : 500,
                    padding: '7px 10px 7px 0',
                    cursor: 'pointer',
                  }}
                >
                  {s}
                </button>
              ))}
            </nav>
          </header>

          <section style={{ padding: '28px', overflow: 'auto' }}>
            {error ? <div style={{ marginBottom: 14, color: '#b91c1c', fontSize: 13 }}>{error}</div> : null}

            {step === 0 && (
              <div style={{ maxWidth: 820, display: 'grid', gap: 18 }}>
                <Field label="Customer name" required>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {basic.hubspotDealId ? (
                      <div style={{ border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', borderRadius: 6, padding: '7px 10px', fontSize: 12 }}>
                        HubSpot deal {basic.hubspotDealId} is prefilled. Account owner: {basic.accountOwner || '—'}
                      </div>
                    ) : null}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" onClick={() => setClientMode('existing')} style={{ border: clientMode === 'existing' ? '1px solid #7c3aed' : '1px solid #e5e7eb', background: clientMode === 'existing' ? '#f5f3ff' : '#fff', borderRadius: 6, padding: '7px 10px', fontSize: 12, fontWeight: 700, color: '#374151' }}>Existing client</button>
                      <button type="button" onClick={() => setClientMode('new')} style={{ border: clientMode === 'new' ? '1px solid #7c3aed' : '1px solid #e5e7eb', background: clientMode === 'new' ? '#f5f3ff' : '#fff', borderRadius: 6, padding: '7px 10px', fontSize: 12, fontWeight: 700, color: '#374151' }}>Create new client</button>
                    </div>
                    {clientMode === 'existing' ? (
                      <select style={input} value={basic.clientUserId} onChange={(e) => chooseClient(e.target.value)}>
                        <option value="">Select an existing client</option>
                        {clients.map((c) => (
                          <option key={c._id} value={c._id}>{c.name} · {c.email}</option>
                        ))}
                      </select>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <input style={input} placeholder="Acme Inc." value={basic.clientName} onChange={(e) => setBasic((b) => ({ ...b, clientName: e.target.value }))} />
                        <input style={input} placeholder="client@acme.com" value={basic.newClientEmail} onChange={(e) => setBasic((b) => ({ ...b, newClientEmail: e.target.value }))} />
                      </div>
                    )}
                    {clientMode === 'existing' && selectedClient ? (
                      <span style={{ color: '#6b7280', fontSize: 11 }}>Selected: {selectedClient.name} ({selectedClient.email})</span>
                    ) : null}
                  </div>
                </Field>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 18 }}>
                  <Field label="Project name" required>
                    <input style={input} placeholder="Acme 2w project" value={basic.name} onChange={(e) => setBasic((b) => ({ ...b, name: e.target.value }))} />
                  </Field>
                  <Field label="Project status">
                    <select style={input} value={basic.status} onChange={(e) => setBasic((b) => ({ ...b, status: e.target.value }))}>
                      <option value="Draft">Draft</option>
                      <option value="Active" disabled>Active after DH/PM approval</option>
                    </select>
                  </Field>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px 180px', gap: 18 }}>
                  <Field label={`Choose a project template${loadingTemplateDetail ? ' (loading…)' : ''}`}>
                    <select
                      style={input}
                      value={basic.customerPortalTemplate}
                      onChange={(e) => chooseTemplate(e.target.value)}
                      disabled={loadingTemplateDetail}
                    >
                      <option value="">Starter implementation plan</option>
                      {(() => {
                        const systemTemplates = templateCatalog.filter((t) => !t.isCustom);
                        const customTemplates = templateCatalog.filter((t) => t.isCustom);
                        return (
                          <>
                            {systemTemplates.length > 0 ? (
                              <optgroup label="System templates">
                                {systemTemplates.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.name}
                                    {t.modules ? ` · ${t.modules} modules` : ''}
                                    {t.duration ? ` · ${t.duration}` : ''}
                                  </option>
                                ))}
                              </optgroup>
                            ) : null}
                            {customTemplates.length > 0 ? (
                              <optgroup label="Custom templates">
                                {customTemplates.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.name}
                                    {t.modules ? ` · ${t.modules} modules` : ''}
                                    {t.duration ? ` · ${t.duration}` : ''}
                                    {t.createdByName ? ` · by ${t.createdByName}` : ''}
                                  </option>
                                ))}
                              </optgroup>
                            ) : null}
                          </>
                        );
                      })()}
                    </select>
                    {templateCatalogError ? (
                      <span style={{ color: '#b45309', fontSize: 11, marginTop: 4 }}>
                        {templateCatalogError}
                      </span>
                    ) : null}
                  </Field>
                  <Field label="Start date">
                    <input type="date" style={input} value={basic.startDate} onChange={(e) => setBasic((b) => ({ ...b, startDate: e.target.value }))} />
                  </Field>
                  <Field label="Due date" required>
                    <input type="date" style={input} value={basic.goLiveDate} onChange={(e) => setBasic((b) => ({ ...b, goLiveDate: e.target.value }))} />
                  </Field>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px', gap: 18 }}>
                  <Field label="Delivery phase">
                    <select style={input} value={basic.deliveryPhase} onChange={(e) => setBasic((b) => ({ ...b, deliveryPhase: e.target.value }))}>
                      {DELIVERY_PHASES.map((phase) => (
                        <option key={phase} value={phase}>{phase}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Tier">
                    <select style={input} value={basic.tier} onChange={(e) => setBasic((b) => ({ ...b, tier: e.target.value }))}>
                      <option value="Tier 1">Tier 1</option>
                      <option value="Tier 2">Tier 2</option>
                      <option value="Tier 3">Tier 3</option>
                    </select>
                  </Field>
                </div>
                <div style={{ marginTop: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 10 }}>Project visibility</div>
                  {['Everyone', 'Restricted'].map((v) => (
                    <label key={v} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 12, fontSize: 13, color: '#374151' }}>
                      <input type="radio" checked={basic.visibility === v} onChange={() => setBasic((b) => ({ ...b, visibility: v }))} />
                      <span><strong>{v}</strong><br /><span style={{ color: '#6b7280' }}>{v === 'Everyone' ? 'Everyone from your team can view the project.' : 'Only assigned team members can view the project.'}</span></span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {step === 1 && (
              <div style={{ maxWidth: 820, display: 'grid', gap: 20 }}>
                <Field label="Project owner" required>
                  <MemberPicker
                    value={{
                      userId: team.projectOwnerId,
                      label: selectedOwner
                        ? `${selectedOwner.name} · ${selectedOwner.role} · ${Math.round(selectedOwner.freeHours || 0)}h free`
                        : '',
                    }}
                    options={availableMembers}
                    getOptionId={(m) => m.userId}
                    getOptionName={(m) => m.name}
                    getOptionSubtitle={ownerSubtitle}
                    placeholder="Search and select an available owner"
                    allowFreeText={false}
                    width={360}
                    onChange={({ user }) => {
                      if (user) {
                        setTeam((t) => ({ ...t, projectOwnerId: user.userId }));
                      }
                    }}
                    onClear={() => setTeam((t) => ({ ...t, projectOwnerId: '' }))}
                  />
                </Field>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
                    Invite team members
                    {selectedTeam.length > 0 ? (
                      <span style={{ marginLeft: 8, fontWeight: 500, color: '#6b7280', fontSize: 12 }}>
                        ({selectedTeam.length} invited)
                      </span>
                    ) : null}
                  </div>
                  {availabilityError ? <p style={{ color: '#b91c1c', fontSize: 12 }}>{availabilityError}</p> : null}

                  {selectedTeam.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                      {selectedTeam.map((m) => {
                        const isOwner = String(team.projectOwnerId) === String(m.userId);
                        return (
                          <span
                            key={m.userId}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 8,
                              border: '1px solid #ddd6fe',
                              background: '#f5f3ff',
                              borderRadius: 999,
                              padding: '4px 6px 4px 4px',
                              maxWidth: 320,
                            }}
                          >
                            <Avatar name={m.name} size={22} />
                            <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                              <strong style={{ color: '#111827', fontSize: 12, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {m.name}
                                {isOwner ? <span style={{ marginLeft: 6, fontSize: 10, color: '#5b21b6', background: '#ede9fe', borderRadius: 999, padding: '1px 6px' }}>Owner</span> : null}
                              </strong>
                              <span style={{ color: '#6b7280', fontSize: 11, lineHeight: 1.2 }}>
                                {m.role} · {Math.round(m.freeHours || 0)}h free
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleMember(m.userId)}
                              aria-label={`Remove ${m.name}`}
                              style={{
                                background: 'transparent',
                                border: 0,
                                color: '#6b7280',
                                cursor: 'pointer',
                                fontSize: 14,
                                lineHeight: 1,
                                padding: 4,
                                marginLeft: 2,
                              }}
                            >
                              ×
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  ) : null}

                  <div ref={inviteWrapperRef} style={{ position: 'relative', display: 'inline-block' }}>
                    <button
                      type="button"
                      onClick={() => setInviteOpen((v) => !v)}
                      disabled={!availableMembers.length}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        border: '1px dashed #c4b5fd',
                        background: '#fff',
                        color: '#5b21b6',
                        borderRadius: 8,
                        padding: '8px 14px',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: availableMembers.length ? 'pointer' : 'not-allowed',
                        opacity: availableMembers.length ? 1 : 0.6,
                      }}
                    >
                      <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
                      <span>Invite team member</span>
                    </button>

                    {inviteOpen ? (
                      <div
                        style={{
                          position: 'absolute',
                          top: 'calc(100% + 6px)',
                          left: 0,
                          width: 380,
                          maxWidth: '90vw',
                          background: '#fff',
                          border: '1px solid #e5e7eb',
                          borderRadius: 8,
                          boxShadow: '0 10px 25px -10px rgba(15,23,42,0.25)',
                          zIndex: 30,
                        }}
                      >
                        <div style={{ padding: 8, borderBottom: '1px solid #f1f5f9' }}>
                          <input
                            ref={inviteSearchRef}
                            type="text"
                            placeholder="Search by name, role, or email"
                            value={inviteSearch}
                            onChange={(e) => setInviteSearch(e.target.value)}
                            style={input}
                          />
                        </div>
                        <div style={{ maxHeight: 280, overflowY: 'auto', padding: '4px 0' }}>
                          {!availableMembers.length ? (
                            <div style={{ padding: '12px', color: '#9ca3af', fontSize: 13 }}>
                              No non-busy members found for this date range.
                            </div>
                          ) : !filteredInviteCandidates.length ? (
                            <div style={{ padding: '12px', color: '#9ca3af', fontSize: 13 }}>
                              No members match “{inviteSearch}”.
                            </div>
                          ) : (
                            filteredInviteCandidates.map((m) => {
                              const selected = team.memberIds.map(String).includes(String(m.userId));
                              const isOwner = String(team.projectOwnerId) === String(m.userId);
                              return (
                                <button
                                  key={m.userId}
                                  type="button"
                                  onClick={() => toggleMember(m.userId)}
                                  style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    padding: '8px 12px',
                                    background: selected ? '#f5f3ff' : 'transparent',
                                    border: 0,
                                    borderLeft: selected ? '3px solid #7c3aed' : '3px solid transparent',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!selected) e.currentTarget.style.background = '#f9fafb';
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!selected) e.currentTarget.style.background = 'transparent';
                                  }}
                                >
                                  <Avatar name={m.name} size={28} />
                                  <span style={{ flex: 1, minWidth: 0 }}>
                                    <strong style={{ display: 'block', color: '#111827', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {m.name}
                                      {isOwner ? <span style={{ marginLeft: 6, fontSize: 10, color: '#5b21b6', background: '#ede9fe', borderRadius: 999, padding: '1px 6px' }}>Owner</span> : null}
                                    </strong>
                                    <span style={{ display: 'block', color: '#6b7280', fontSize: 11 }}>
                                      {m.role} · {Math.round(m.freeHours || 0)}h free of {Math.round(m.capacityHours || 0)}h
                                    </span>
                                  </span>
                                  <span style={{ fontSize: 11, fontWeight: 600, color: selected ? '#5b21b6' : '#6b7280', flexShrink: 0 }}>
                                    {selected ? '✓ Added' : '+ Add'}
                                  </span>
                                </button>
                              );
                            })
                          )}
                        </div>
                        <div style={{ borderTop: '1px solid #f1f5f9', padding: 8, display: 'flex', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            onClick={() => setInviteOpen(false)}
                            style={{
                              background: '#7c3aed',
                              color: '#fff',
                              border: 0,
                              borderRadius: 6,
                              padding: '6px 12px',
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div style={{ maxWidth: 820, display: 'grid', gap: 14 }}>
                <p style={{ margin: 0, color: '#6b7280', fontSize: 13 }}>Invite customer contacts. These are captured with the wizard payload and can be wired to customer portal users later.</p>
                {customerTeam.map((c, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <input style={input} placeholder="Customer contact name" value={c.name} onChange={(e) => setCustomerTeam((p) => p.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))} />
                    <input style={input} placeholder="Email" value={c.email} onChange={(e) => setCustomerTeam((p) => p.map((x, i) => (i === idx ? { ...x, email: e.target.value } : x)))} />
                  </div>
                ))}
                <Button variant="secondary" type="button" onClick={() => setCustomerTeam((p) => [...p, { name: '', email: '' }])}>Add customer</Button>
              </div>
            )}

            {step === 3 && (
              <div style={{ display: 'grid', gap: 18 }}>
                <div style={{ maxWidth: 820, display: 'grid', gridTemplateColumns: '160px 1fr 1fr', gap: 12 }}>
                  <Field label="Currency"><select style={input} value={fields.currency} onChange={(e) => setFields((f) => ({ ...f, currency: e.target.value }))}><option>USD</option><option>INR</option></select></Field>
                  <Field label="ARR"><input style={input} value={fields.arr} onChange={(e) => setFields((f) => ({ ...f, arr: e.target.value }))} placeholder="0" /></Field>
                  <Field label="Project Fee"><input style={input} value={fields.projectFee} onChange={(e) => setFields((f) => ({ ...f, projectFee: e.target.value }))} placeholder="0" /></Field>
                </div>
                <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <h3 style={{ margin: 0, fontSize: 15, color: '#111827' }}>Modules, workstreams & tasks</h3>
                    <Button variant="secondary" type="button" onClick={addModule}>Add module</Button>
                  </div>
                  <div style={{ display: 'grid', gap: 12 }}>
                    {modules.map((m, mi) => (
                      <div key={mi} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px auto', gap: 8, alignItems: 'center' }}>
                          <input style={input} value={m.name} onChange={(e) => setModule(mi, { name: e.target.value })} />
                          <input style={input} value={m.budgetHours} onChange={(e) => setModule(mi, { budgetHours: e.target.value })} />
                          <div style={{ display: 'flex', gap: 6 }}>
                            <Button variant="ghost" type="button" onClick={() => addWorkstream(mi)}>Add workstream</Button>
                            <Button variant="ghost" type="button" onClick={() => removeModule(mi)}>Remove</Button>
                          </div>
                        </div>
                        <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
                          {m.workstreams.map((w, wi) => (
                            <div key={wi} style={{ background: '#f9fafb', borderRadius: 8, padding: 10 }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px auto', gap: 8 }}>
                                <input style={input} value={w.name} onChange={(e) => setWorkstream(mi, wi, { name: e.target.value })} />
                                <input style={input} value={w.budgetHours} onChange={(e) => setWorkstream(mi, wi, { budgetHours: e.target.value })} />
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <Button variant="ghost" type="button" onClick={() => addTask(mi, wi)}>Add task</Button>
                                  <Button variant="ghost" type="button" onClick={() => removeWorkstream(mi, wi)}>Remove</Button>
                                </div>
                              </div>
                              {selectedTeam.length > 0 ? (
                                <div style={{ marginTop: 8 }}>
                                  <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 5 }}>Assign available members to this workstream</div>
                                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    {selectedTeam.map((member) => {
                                      const selected = (w.memberIds || []).map(String).includes(String(member.userId));
                                      return (
                                        <button
                                          key={member.userId}
                                          type="button"
                                          onClick={() => toggleWorkstreamMember(mi, wi, member.userId)}
                                          style={{
                                            border: selected ? '1px solid #7c3aed' : '1px solid #d1d5db',
                                            background: selected ? '#ede9fe' : '#fff',
                                            borderRadius: 999,
                                            padding: '4px 8px',
                                            fontSize: 11,
                                            color: '#374151',
                                            cursor: 'pointer',
                                          }}
                                        >
                                          {member.name}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : null}
                              <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                                {w.tasks.map((t, ti) => (
                                  <div key={ti} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6 }}>
                                    <input style={input} value={t} onChange={(e) => setTaskTitle(mi, wi, ti, e.target.value)} />
                                    <Button variant="ghost" type="button" onClick={() => removeTask(mi, wi, ti)}>Remove</Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>

          <footer style={{ borderTop: '1px solid #eef2f7', padding: '14px 28px', display: 'flex', justifyContent: 'space-between' }}>
            <Button variant="secondary" type="button" onClick={() => (step === 0 ? navigate('/projects') : setStep((s) => s - 1))}>
              {step === 0 ? 'Cancel' : 'Back'}
            </Button>
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={() => (canNext() ? setStep((s) => s + 1) : setError('Please complete required fields before continuing.'))}>
                Next: {STEPS[step + 1]} →
              </Button>
            ) : (
              <Button type="button" disabled={saving} onClick={submit}>
                {saving ? 'Creating...' : 'Create project →'}
              </Button>
            )}
          </footer>
        </main>
      </div>
    </div>
  );
}
