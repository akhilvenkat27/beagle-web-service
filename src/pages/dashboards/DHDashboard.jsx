import { useCallback, useEffect, useState } from 'react';
import { usePeriodicRefresh } from '../../hooks/usePeriodicRefresh';
import { dashboardAPI } from '../../services/api';
import { healthLabel, healthPillVariant } from '../../constants/healthRag';
import PageHeader from '../../components/PageHeader';
import SectionCard from '../../components/SectionCard';
import PillTag from '../../components/PillTag';

function Stat({ label, value, hint }) {
  return (
    <div style={{ border: '1px solid var(--border-default)', borderRadius: 8, padding: 14, background: '#fff' }}>
      <p style={{ margin: 0, fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</p>
      <p style={{ margin: '6px 0 0', fontSize: 24, fontWeight: 600, color: '#111827' }}>{value}</p>
      {hint ? <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9ca3af' }}>{hint}</p> : null}
    </div>
  );
}

export default function DHDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data: d } = await dashboardAPI.byRole('dh');
      setData(d);
    } catch {
      if (!silent) setData(null);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard(false);
  }, [loadDashboard]);

  usePeriodicRefresh(() => loadDashboard(true), 20000);

  const atRisk = data?.financialSummary?.atRiskProjects || [];
  const ragRows = data?.ragHeatmap || [];
  const overloaded = data?.resourceUtilization?.overloadedMembers || [];
  const escalations = data?.escalationRiskAlerts || [];
  const pmScores = data?.pmDisciplineScores || [];

  return (
    <div style={{ background: '#fff', minHeight: '100%', padding: 24 }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <PageHeader
          title="Delivery head dashboard"
          subtitle="Financial summary, delivery health, utilization and escalation signals."
        />

        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', marginBottom: 12 }}>
          <Stat label="Total revenue" value={(data?.financialSummary?.totalRevenue || 0).toLocaleString('en-IN')} />
          <Stat label="Avg margin" value={`${data?.financialSummary?.avgMargin || 0}%`} />
          <Stat label="At-risk projects" value={atRisk.length} hint="Portfolio count" />
        </div>

        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr', marginBottom: 12 }}>
          <SectionCard title="Health heatmap" count={ragRows.length}>
            {loading ? <p style={{ margin: 0, padding: 12, color: '#9ca3af', fontSize: 12 }}>Loading...</p> : null}
            {!loading && ragRows.length === 0 ? <p style={{ margin: 0, padding: 12, color: '#9ca3af', fontSize: 12 }}>No health rows yet.</p> : null}
            {ragRows.map((r, i) => (
              <div key={`${r.projectName}-${i}`} style={{ height: 44, borderBottom: '1px solid var(--border-light)', display: 'grid', alignItems: 'center', gridTemplateColumns: '1fr auto', padding: '0 12px' }}>
                <span style={{ fontSize: 13, color: '#111827', fontWeight: 500 }}>{r.projectName}</span>
                <PillTag label={healthLabel(r.rag)} color={healthPillVariant(r.rag)} />
              </div>
            ))}
          </SectionCard>

          <SectionCard title="Overloaded members" count={overloaded.length}>
            {loading ? <p style={{ margin: 0, padding: 12, color: '#9ca3af', fontSize: 12 }}>Loading...</p> : null}
            {!loading && overloaded.length === 0 ? <p style={{ margin: 0, padding: 12, color: '#9ca3af', fontSize: 12 }}>No overloaded members.</p> : null}
            {overloaded.map((m, i) => (
              <div key={`${m.name}-${i}`} style={{ height: 44, borderBottom: '1px solid var(--border-light)', display: 'grid', alignItems: 'center', gridTemplateColumns: '1fr auto', padding: '0 12px' }}>
                <span style={{ fontSize: 13, color: '#111827', fontWeight: 500 }}>{m.name}</span>
                <span style={{ fontSize: 12, color: '#6b7280' }}>{m.assignedTasks} tasks</span>
              </div>
            ))}
          </SectionCard>
        </div>

        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
          <SectionCard title="Escalation risk alerts" count={escalations.length}>
            {loading ? <p style={{ margin: 0, padding: 12, color: '#9ca3af', fontSize: 12 }}>Loading...</p> : null}
            {!loading && escalations.length === 0 ? <p style={{ margin: 0, padding: 12, color: '#9ca3af', fontSize: 12 }}>No escalation alerts.</p> : null}
            {escalations.map((e, i) => (
              <div key={`${e.projectName}-${i}`} style={{ minHeight: 44, borderBottom: '1px solid var(--border-light)', display: 'grid', alignItems: 'center', padding: '8px 12px' }}>
                <span style={{ fontSize: 13, color: '#111827', fontWeight: 500 }}>{e.projectName}</span>
                <span style={{ fontSize: 11, color: '#6b7280' }}>{e.trigger}</span>
              </div>
            ))}
          </SectionCard>

          <SectionCard title="PM discipline scores" count={pmScores.length}>
            {loading ? <p style={{ margin: 0, padding: 12, color: '#9ca3af', fontSize: 12 }}>Loading...</p> : null}
            {!loading && pmScores.length === 0 ? <p style={{ margin: 0, padding: 12, color: '#9ca3af', fontSize: 12 }}>No PM scores.</p> : null}
            {pmScores.map((p, i) => (
              <div key={`${p.pmName}-${i}`} style={{ height: 44, borderBottom: '1px solid var(--border-light)', display: 'grid', alignItems: 'center', gridTemplateColumns: '1fr auto', padding: '0 12px' }}>
                <span style={{ fontSize: 13, color: '#374151' }}>{p.pmName}</span>
                <span style={{ fontSize: 13, color: '#111827', fontWeight: 600 }}>{p.score}</span>
              </div>
            ))}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
