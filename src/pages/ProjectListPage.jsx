import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePeriodicRefresh } from '../hooks/usePeriodicRefresh';
import { Link, useNavigate } from 'react-router-dom';
import { projectsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';
import Button from '../components/Button';
import DataTable from '../components/DataTable';
import PageHeader from '../components/PageHeader';
import PillTag from '../components/PillTag';
import ProgressBar from '../components/ProgressBar';
import StatusIcon from '../components/StatusIcon';

const EMPTY_FORM = {
  name: '',
  clientName: '',
  goLiveDate: '',
  contractValue: '',
};

function phaseColor(phase = '') {
  const p = phase.toLowerCase();
  if (p.includes('discover') || p.includes('kick')) return 'info';
  if (p.includes('build') || p.includes('uat') || p.includes('live')) return 'success';
  if (p.includes('pre') || p.includes('handover')) return 'accent';
  return 'neutral';
}

export default function ProjectListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canCreateProject = user?.role === 'admin';
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await projectsAPI.getAll();
      setProjects(Array.isArray(data) ? data : []);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  usePeriodicRefresh(() => load(true), 20000);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.clientName || '').toLowerCase().includes(q)
    );
  }, [projects, query]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await projectsAPI.create({
        ...form,
        contractValue: Number(form.contractValue || 0),
        implementationFee: Number(form.contractValue || 0),
        status: 'Draft',
        tier: 'Tier 2',
        region: 'India',
      });
      setShowCreate(false);
      setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create project');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 24, background: '#fff', minHeight: '100%' }}>
      <PageHeader
        title="Projects"
        subtitle="Rocketlane-style dense table view"
        actions={
          <>
            {user?.role === 'member' && (
              <Link
                to="/member/dashboard"
                style={{ fontSize: 13, color: 'var(--color-primary)', fontWeight: 500, marginRight: 8 }}
              >
                My tasks
              </Link>
            )}
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              style={{
                height: 32,
                border: '1px solid var(--border-default)',
                borderRadius: 6,
                padding: '0 10px',
                fontSize: 13,
              }}
            />
            {canCreateProject && (
              <Button onClick={() => navigate('/projects/create')}>New project +</Button>
            )}
          </>
        }
      />

      <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
        <PillTag label="All projects" color="neutral" />
        <Button variant="secondary">Filter</Button>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Group by: None</span>
      </div>

      <DataTable
        columns={[
          { key: 'name', label: 'Project Name', width: 300 },
          { key: 'status', label: 'Status', width: 140 },
          { key: 'phase', label: 'Current phases', width: 180 },
          { key: 'progress', label: 'Progress', width: 180 },
          { key: 'phases', label: 'Phases', width: 120 },
          { key: 'date', label: 'Due Date', width: 120 },
          { key: 'inferred', label: 'Inferred Progress', width: 140 },
        ]}
        rows={filtered}
        empty={loading ? 'Loading projects…' : 'No projects found'}
        renderRow={(p) => {
          const progress = Number(p.stats?.progress || 0);
          const due = p.goLiveDate
            ? new Date(p.goLiveDate).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
              })
            : '—';
          return (
            <tr key={p._id} onClick={() => navigate(`/projects/${p._id}`)} style={{ cursor: 'pointer' }}>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar name={p.name} size={24} />
                  <span style={{ fontWeight: 500, color: '#111827' }}>{p.name}</span>
                </div>
              </td>
              <td>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <StatusIcon status={p.status === 'Completed' ? 'done' : 'inprogress'} />
                  <span style={{ fontSize: 13 }}>{p.status === 'Completed' ? 'Completed' : 'In progress'}</span>
                </span>
              </td>
              <td>
                <PillTag label={p.deliveryPhase || 'Kickoff'} color={phaseColor(p.deliveryPhase)} />
              </td>
              <td>
                <ProgressBar value={progress} />
              </td>
              <td>
                <ProgressBar value={progress} segmented />
              </td>
              <td>{due}</td>
              <td style={{ color: '#9ca3af' }}>—</td>
            </tr>
          );
        }}
      />

      {showCreate && canCreateProject && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(17,24,39,0.25)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 100,
          }}
          onClick={() => setShowCreate(false)}
        >
          <form
            onSubmit={handleCreate}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 440,
              maxWidth: 'calc(100vw - 24px)',
              borderRadius: 8,
              background: '#fff',
              border: '1px solid var(--border-default)',
              padding: 20,
            }}
          >
            <h3 style={{ margin: 0, marginBottom: 14, fontSize: 16, fontWeight: 600 }}>New project</h3>
            <div style={{ display: 'grid', gap: 10 }}>
              <input
                required
                placeholder="Project name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                style={{ height: 36, border: '1px solid var(--border-default)', borderRadius: 6, padding: '0 10px' }}
              />
              <input
                required
                placeholder="Client name"
                value={form.clientName}
                onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))}
                style={{ height: 36, border: '1px solid var(--border-default)', borderRadius: 6, padding: '0 10px' }}
              />
              <input
                required
                type="date"
                value={form.goLiveDate}
                onChange={(e) => setForm((f) => ({ ...f, goLiveDate: e.target.value }))}
                style={{ height: 36, border: '1px solid var(--border-default)', borderRadius: 6, padding: '0 10px' }}
              />
              <input
                required
                type="number"
                min="0"
                placeholder="Contract value"
                value={form.contractValue}
                onChange={(e) => setForm((f) => ({ ...f, contractValue: e.target.value }))}
                style={{ height: 36, border: '1px solid var(--border-default)', borderRadius: 6, padding: '0 10px' }}
              />
            </div>
            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button variant="secondary" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Create'}
              </Button>
            </div>
          </form>
        </div>
      )}

      <div style={{ marginTop: 8, fontSize: 12, color: '#9ca3af' }}>{filtered.length} projects</div>
      <div style={{ marginTop: 8 }}>
        <Link to="/execution/all-tasks" style={{ color: 'var(--text-link)', fontSize: 12 }}>
          Open all tasks →
        </Link>
      </div>
    </div>
  );
}
