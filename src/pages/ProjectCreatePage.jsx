import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { intakeAPI, projectsAPI, resourcesAPI, usersAPI } from '../services/api';
import Button from '../components/Button';
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

const TEMPLATE_MODULES = {
  'enterprise-hcm': [
    { name: 'Discovery & blueprinting', budgetHours: 220, workstreams: [{ name: 'Inception - Discovery', budgetHours: 110, memberIds: [], tasks: ['Kickoff workshop', 'Blueprint sign-off'] }] },
    { name: 'Core HR & org design', budgetHours: 260, workstreams: [{ name: 'Elaboration - Core HR', budgetHours: 130, memberIds: [], tasks: ['Org model setup', 'Core HR review'] }] },
    { name: 'Payroll & compensation', budgetHours: 280, workstreams: [{ name: 'Configuration - Payroll', budgetHours: 140, memberIds: [], tasks: ['Payroll config', 'Compensation validation'] }] },
    { name: 'Cutover & hypercare', budgetHours: 200, workstreams: [{ name: 'Transition - Cutover', budgetHours: 100, memberIds: [], tasks: ['Cutover rehearsal', 'Hypercare handoff'] }] },
  ],
  'smb-quickstart': [
    { name: 'Kickoff & discovery', budgetHours: 120, workstreams: [{ name: 'Inception - Quickstart', budgetHours: 60, memberIds: [], tasks: ['Kickoff call', 'Confirm launch checklist'] }] },
    { name: 'Core configuration', budgetHours: 160, workstreams: [{ name: 'Configuration - Core setup', budgetHours: 80, memberIds: [], tasks: ['Configure basics', 'Admin walkthrough'] }] },
    { name: 'UAT & go-live', budgetHours: 140, workstreams: [{ name: 'Transition - Go-live', budgetHours: 70, memberIds: [], tasks: ['UAT sign-off', 'Go-live support'] }] },
  ],
  'payroll-scale': [
    { name: 'Program governance & waves', budgetHours: 180, workstreams: [{ name: 'Inception - Payroll governance', budgetHours: 90, memberIds: [], tasks: ['Wave plan', 'Governance cadence'] }] },
    { name: 'Country / entity configuration', budgetHours: 280, workstreams: [{ name: 'Configuration - Entities', budgetHours: 140, memberIds: [], tasks: ['Entity setup', 'Country validation'] }] },
    { name: 'Parallel payroll & reconciliation', budgetHours: 300, workstreams: [{ name: 'Elaboration - Parallel payroll', budgetHours: 150, memberIds: [], tasks: ['Parallel run', 'Variance reconciliation'] }] },
    { name: 'Retro, sign-off & hypercare', budgetHours: 180, workstreams: [{ name: 'Transition - Payroll handover', budgetHours: 90, memberIds: [], tasks: ['Final sign-off', 'Hypercare close'] }] },
  ],
};

function cloneModules(mods) {
  return JSON.parse(JSON.stringify(mods));
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

  const chooseTemplate = (templateId) => {
    setBasic((b) => ({ ...b, customerPortalTemplate: templateId }));
    setModules(cloneModules(TEMPLATE_MODULES[templateId] || DEFAULT_MODULES));
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
                  <Field label="Choose a project template">
                    <select style={input} value={basic.customerPortalTemplate} onChange={(e) => chooseTemplate(e.target.value)}>
                      <option value="">Starter implementation plan</option>
                      <option value="enterprise-hcm">Enterprise HCM</option>
                      <option value="smb-quickstart">SMB quick start</option>
                      <option value="payroll-scale">Payroll at scale</option>
                    </select>
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
                  <select style={input} value={team.projectOwnerId} onChange={(e) => setTeam((t) => ({ ...t, projectOwnerId: e.target.value }))}>
                    <option value="">Select available owner</option>
                    {availableMembers.map((m) => (
                      <option key={m.userId} value={m.userId}>{m.name} · {m.role} · {Math.round(m.freeHours || 0)}h free</option>
                    ))}
                  </select>
                </Field>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Invite available team members</div>
                  {availabilityError ? <p style={{ color: '#b91c1c', fontSize: 12 }}>{availabilityError}</p> : null}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                    {availableMembers.map((m) => {
                      const selected = team.memberIds.map(String).includes(String(m.userId));
                      return (
                        <button key={m.userId} type="button" onClick={() => toggleMember(m.userId)} style={{ border: selected ? '1px solid #7c3aed' : '1px solid #e5e7eb', background: selected ? '#f5f3ff' : '#fff', borderRadius: 8, padding: 10, textAlign: 'left', cursor: 'pointer' }}>
                          <strong style={{ display: 'block', color: '#111827', fontSize: 13 }}>{m.name}</strong>
                          <span style={{ color: '#6b7280', fontSize: 12 }}>{m.role} · {Math.round(m.freeHours || 0)}h free of {Math.round(m.capacityHours || 0)}h</span>
                        </button>
                      );
                    })}
                    {!availableMembers.length ? <div style={{ color: '#9ca3af', fontSize: 13 }}>No non-busy members found for this date range.</div> : null}
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
