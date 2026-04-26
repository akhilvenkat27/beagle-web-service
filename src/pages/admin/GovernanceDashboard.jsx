import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { governanceAPI, usersAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/PageHeader';
import DataTable from '../../components/DataTable';
import Button from '../../components/Button';
import PillTag from '../../components/PillTag';

const REGIONS = ['India', 'SEA', 'MEA', 'Americas', 'Other'];
const TIERS = ['Tier 1', 'Tier 2', 'Tier 3'];
const STATUSES = ['Draft', 'Active', 'Completed'];

export default function GovernanceDashboard() {
  const { user, enterBehaveAs, behaveAs } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ region: '', tier: '', dh: '', status: '' });
  const [users, setUsers] = useState([]);
  const [behaveTarget, setBehaveTarget] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.region) params.region = filters.region;
      if (filters.tier) params.tier = filters.tier;
      if (filters.dh) params.dh = filters.dh;
      if (filters.status) params.status = filters.status;
      const { data } = await governanceAPI.dashboard(params);
      setRows(data.projects || []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    usersAPI
      .getAll()
      .then(({ data }) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => setUsers([]));
  }, [user?.role]);

  const filtered = useMemo(() => {
    return rows;
  }, [rows]);

  const exportCsv = () => {
    const headers = [
      'Project',
      'Client',
      'Region',
      'Tier',
      'Status',
      'DH',
      'OverdueReviews',
      'NonSubmitters',
      'OpenCRs',
      'Compliance',
    ];
    const lines = [headers.join(',')].concat(
      filtered.map((r) =>
        [
          `"${(r.name || '').replace(/"/g, '""')}"`,
          `"${(r.clientName || '').replace(/"/g, '""')}"`,
          r.region,
          r.tier,
          r.status,
          `"${(r.deliveryHeadName || '').replace(/"/g, '""')}"`,
          r.overdueReviews,
          r.nonSubmittedTimesheets,
          r.openCRs,
          r.complianceScore ?? '',
        ].join(',')
      )
    );
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `governance-dashboard-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBehave = async () => {
    if (!behaveTarget) return;
    try {
      await enterBehaveAs(behaveTarget);
      window.location.reload();
    } catch (e) {
      alert(e.response?.data?.message || 'Behave-as failed');
    }
  };

  return (
    <div style={{ background: '#fff', minHeight: '100%', padding: 24 }}>
      <div style={{ maxWidth: 1320, margin: '0 auto' }}>
        <PageHeader
          title="Governance dashboard"
          subtitle="PMO view for reviews, timesheets, change requests and compliance."
          actions={(
            <>
              <Button variant="secondary" onClick={exportCsv}>Export CSV</Button>
              <Link to="/projects" style={{ fontSize: 13, color: 'var(--color-primary)', fontWeight: 500 }}>
                ← Projects
              </Link>
            </>
          )}
        />

        {user?.role === 'admin' && !behaveAs?.active && (
          <div style={{ border: '1px solid #fde68a', background: '#fffbeb', borderRadius: 8, padding: 12, display: 'flex', alignItems: 'end', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ display: 'grid', gap: 4 }}>
              <label style={{ fontSize: 11, color: '#92400e', fontWeight: 600 }}>View system as</label>
              <select
                style={{ height: 34, border: '1px solid #fcd34d', borderRadius: 6, fontSize: 12, minWidth: 220, padding: '0 8px' }}
                value={behaveTarget}
                onChange={(e) => setBehaveTarget(e.target.value)}
              >
                <option value="">Select user...</option>
                {users.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={handleBehave} disabled={!behaveTarget}>Apply</Button>
            <span style={{ fontSize: 11, color: '#92400e' }}>
              Creates a read-only behave-as session until you exit from top banner.
            </span>
          </div>
        )}

        <div style={{ border: '1px solid var(--border-default)', borderRadius: 8, padding: 12, display: 'flex', flexWrap: 'wrap', alignItems: 'end', gap: 10, marginBottom: 12 }}>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 11, color: '#6b7280' }}>Region</span>
            <select
              style={{ height: 34, border: '1px solid var(--border-default)', borderRadius: 6, fontSize: 12, padding: '0 8px' }}
              value={filters.region}
              onChange={(e) => setFilters({ ...filters, region: e.target.value })}
            >
              <option value="">All</option>
              {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>

          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 11, color: '#6b7280' }}>Tier</span>
            <select
              style={{ height: 34, border: '1px solid var(--border-default)', borderRadius: 6, fontSize: 12, padding: '0 8px' }}
              value={filters.tier}
              onChange={(e) => setFilters({ ...filters, tier: e.target.value })}
            >
              <option value="">All</option>
              {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>

          {user?.role === 'admin' && (
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 11, color: '#6b7280' }}>Delivery head</span>
              <select
                style={{ height: 34, border: '1px solid var(--border-default)', borderRadius: 6, fontSize: 12, minWidth: 180, padding: '0 8px' }}
                value={filters.dh}
                onChange={(e) => setFilters({ ...filters, dh: e.target.value })}
              >
                <option value="">All</option>
                {users.filter((u) => u.role === 'dh' || u.role === 'admin').map((u) => (
                  <option key={u._id} value={u._id}>{u.name}</option>
                ))}
              </select>
            </label>
          )}

          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 11, color: '#6b7280' }}>Status</span>
            <select
              style={{ height: 34, border: '1px solid var(--border-default)', borderRadius: 6, fontSize: 12, padding: '0 8px' }}
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">All</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>

          <Button onClick={load}>Apply filters</Button>
        </div>

        <DataTable
          columns={[
            { key: 'project', label: 'PROJECT', width: '260px' },
            { key: 'region', label: 'REGION', width: '110px' },
            { key: 'tier', label: 'TIER', width: '90px' },
            { key: 'status', label: 'STATUS', width: '120px' },
            { key: 'dh', label: 'DH', width: '160px' },
            { key: 'overdue', label: 'OVERDUE REVIEWS', width: '120px' },
            { key: 'non', label: 'NON-SUBMITTERS', width: '120px' },
            { key: 'cr', label: 'OPEN CRS', width: '90px' },
            { key: 'compliance', label: 'COMPLIANCE', width: '110px' },
          ]}
          rows={loading ? [] : filtered}
          empty={loading ? 'Loading...' : 'No projects'}
          renderRow={(r) => (
            <tr key={r.projectId}>
              <td>
                <Link to={`/projects/${r.projectId}`} style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-primary)' }}>
                  {r.name}
                </Link>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>{r.clientName}</div>
              </td>
              <td style={{ fontSize: 12, color: '#374151' }}>{r.region}</td>
              <td style={{ fontSize: 12, color: '#374151' }}>{r.tier}</td>
              <td><PillTag label={r.status || '—'} color={r.status === 'Completed' ? 'success' : r.status === 'Active' ? 'accent' : 'neutral'} /></td>
              <td style={{ fontSize: 12, color: '#374151' }}>{r.deliveryHeadName}</td>
              <td style={{ fontSize: 12, color: r.overdueReviews > 0 ? '#b91c1c' : '#9ca3af', fontWeight: r.overdueReviews > 0 ? 600 : 400 }}>
                {r.overdueReviews || 0}
              </td>
              <td style={{ fontSize: 12, color: '#374151' }}>{r.nonSubmittedTimesheets}</td>
              <td style={{ fontSize: 12, color: '#374151' }}>{r.openCRs}</td>
              <td style={{ fontSize: 12, color: (r.complianceScore ?? 0) < 60 ? '#b91c1c' : '#047857', fontWeight: 600 }}>
                {r.complianceScore ?? '—'}
              </td>
            </tr>
          )}
        />
      </div>
    </div>
  );
}
