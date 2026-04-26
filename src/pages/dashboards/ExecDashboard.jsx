import { useCallback, useEffect, useState } from 'react';
import { usePeriodicRefresh } from '../../hooks/usePeriodicRefresh';
import { dashboardAPI } from '../../services/api';
import { healthLabel, healthPillVariant } from '../../constants/healthRag';
import PageHeader from '../../components/PageHeader';
import SectionCard from '../../components/SectionCard';
import PillTag from '../../components/PillTag';

function Stat({ label, value }) {
  return (
    <div style={{ border: '1px solid var(--border-default)', borderRadius: 8, padding: 14, background: '#fff' }}>
      <p style={{ margin: 0, fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</p>
      <p style={{ margin: '6px 0 0', fontSize: 24, fontWeight: 600, color: '#111827' }}>{value}</p>
    </div>
  );
}

export default function ExecDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data: d } = await dashboardAPI.byRole('exec');
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

  const regional = data?.regionalBreakdown || [];
  const risk = data?.topAtRiskProjects || [];

  return (
    <div style={{ background: '#fff', minHeight: '100%', padding: 24 }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <PageHeader
          title="Executive dashboard"
          subtitle="Portfolio KPIs, regional mix, at-risk projects and AI narrative."
        />

        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', marginBottom: 12 }}>
          <Stat label="Total ARR" value={(data?.portfolioKpis?.totalARR || 0).toLocaleString('en-IN')} />
          <Stat label="Total projects" value={data?.portfolioKpis?.totalProjects || 0} />
          <Stat label="Avg margin" value={`${data?.portfolioKpis?.avgMargin || 0}%`} />
          <Stat label="Go-live rate" value={`${data?.portfolioKpis?.goLiveRate || 0}%`} />
        </div>

        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr', marginBottom: 12 }}>
          <SectionCard title="Regional breakdown" count={regional.length}>
            {loading ? <p style={{ margin: 0, padding: 12, color: '#9ca3af', fontSize: 12 }}>Loading...</p> : null}
            {!loading && regional.length === 0 ? <p style={{ margin: 0, padding: 12, color: '#9ca3af', fontSize: 12 }}>No regional data.</p> : null}
            {regional.map((r, i) => (
              <div key={`${r.region}-${i}`} style={{ height: 44, borderBottom: '1px solid var(--border-light)', display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', padding: '0 12px' }}>
                <span style={{ fontSize: 13, color: '#111827', fontWeight: 500 }}>{r.region}</span>
                <span style={{ fontSize: 12, color: '#6b7280' }}>{r.projects} projects · {r.avgMargin}% margin</span>
              </div>
            ))}
          </SectionCard>

          <SectionCard title="Top at-risk projects" count={risk.length}>
            {loading ? <p style={{ margin: 0, padding: 12, color: '#9ca3af', fontSize: 12 }}>Loading...</p> : null}
            {!loading && risk.length === 0 ? <p style={{ margin: 0, padding: 12, color: '#9ca3af', fontSize: 12 }}>No at-risk projects listed.</p> : null}
            {risk.map((p, i) => (
              <div key={`${p.projectName}-${i}`} style={{ height: 44, borderBottom: '1px solid var(--border-light)', display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', padding: '0 12px' }}>
                <span style={{ fontSize: 13, color: '#111827', fontWeight: 500 }}>{p.projectName}</span>
                <PillTag label={healthLabel(p.rag)} color={healthPillVariant(p.rag)} />
              </div>
            ))}
          </SectionCard>
        </div>

        <SectionCard title="AI portfolio narrative">
          <p style={{ margin: 0, padding: 12, fontSize: 13, lineHeight: 1.5, color: '#374151' }}>
            {data?.aiPortfolioNarrative || '—'}
          </p>
        </SectionCard>
      </div>
    </div>
  );
}
