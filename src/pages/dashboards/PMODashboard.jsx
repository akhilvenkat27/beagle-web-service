import { useCallback, useEffect, useMemo, useState } from 'react';
import { dashboardAPI, executionAPI, projectsAPI } from '../../services/api';
import LoadingScreen from '../../components/LoadingScreen';
import { usePeriodicRefresh } from '../../hooks/usePeriodicRefresh';

const DEFAULT_WIDGETS = {
  rag: true,
  statusPhase: true,
  complianceDist: true,
  complianceTable: true,
  pmPerf: true,
};

function KpiCard({ title, value }) {
  return (
    <div style={{ border: '1px solid #eceff3', borderRadius: 8, background: '#fff', padding: '12px 14px', minHeight: 120 }}>
      <p style={{ margin: 0, fontSize: 13, color: '#1f2937' }}>{title}</p>
      <p style={{ margin: '22px 0 0', textAlign: 'center', fontSize: 50, fontWeight: 400, color: '#0f172a', lineHeight: 1 }}>
        {value}
      </p>
    </div>
  );
}

function ChartBar({ value, maxY, color }) {
  const h = 120;
  const px = maxY > 0 ? Math.round((value / maxY) * h) : 0;
  return <div style={{ width: 28, height: Math.max(4, px), background: color, borderRadius: 4 }} />;
}

function BarChartCard({ title, bars, maxY, yLabel, xLabel, showValues }) {
  return (
    <div style={{ border: '1px solid #eceff3', borderRadius: 8, background: '#fff', padding: '10px 12px', minHeight: 250 }}>
      <p style={{ margin: 0, fontSize: 13, color: '#111827' }}>{title}</p>
      <div style={{ marginTop: 8, height: 150, borderLeft: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', padding: '4px 10px 0', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', gap: 12 }}>
        {bars.map((b) => (
          <div key={b.label} style={{ display: 'grid', justifyItems: 'center', gap: 5 }}>
            {showValues ? <span style={{ fontSize: 10, color: '#6b7280' }}>{b.value}</span> : null}
            <ChartBar value={Number(b.value) || 0} maxY={maxY} color={b.color} />
            <span style={{ fontSize: 10, color: '#6b7280', textAlign: 'center' }}>{b.label}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ fontSize: 9, color: '#9ca3af' }}>{yLabel}</span>
        <span style={{ fontSize: 9, color: '#9ca3af' }}>{xLabel}</span>
      </div>
    </div>
  );
}

function StatusByPhaseCard({ title, categories, series, maxY, showValues }) {
  return (
    <div style={{ border: '1px solid #eceff3', borderRadius: 8, background: '#fff', padding: '10px 12px', minHeight: 250 }}>
      <p style={{ margin: 0, fontSize: 13, color: '#111827' }}>{title}</p>
      <div style={{ marginTop: 6, marginBottom: 2, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {series.map((s) => (
          <span key={s.name} style={{ fontSize: 10, color: '#6b7280', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 8, background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
      <div style={{ marginTop: 6, height: 150, borderLeft: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', padding: '4px 8px 0', display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, categories.length)}, minmax(0,1fr))`, gap: 10, alignItems: 'end' }}>
        {categories.map((cat, ci) => (
          <div key={cat} style={{ display: 'grid', justifyItems: 'center', height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: '100%' }}>
              {series.map((s) => {
                const val = Number(s.values[ci]) || 0;
                const h = Math.max(4, maxY > 0 ? Math.round((val / maxY) * 120) : 0);
                return (
                  <div key={`${s.name}-${cat}`} style={{ display: 'grid', justifyItems: 'center' }}>
                    {showValues ? <span style={{ fontSize: 9, color: '#6b7280', marginBottom: 2 }}>{val}</span> : null}
                    <span style={{ width: 9, height: h, background: s.color, borderRadius: 2, display: 'inline-block' }} />
                  </div>
                );
              })}
            </div>
            <span style={{ marginTop: 4, fontSize: 9, color: '#6b7280', textAlign: 'center' }}>
              {cat.length > 11 ? `${cat.slice(0, 9)}...` : cat}
            </span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ fontSize: 9, color: '#9ca3af' }}>Status</span>
        <span style={{ fontSize: 9, color: '#9ca3af' }}>Phase</span>
      </div>
    </div>
  );
}

function ListCard({ title, count, rows, renderRight }) {
  return (
    <section style={{ border: '1px solid #eceff3', borderRadius: 8, background: '#fff', overflow: 'hidden' }}>
      <header style={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', borderBottom: '1px solid #f3f4f6' }}>
        <strong style={{ fontSize: 13, color: '#111827' }}>{title}</strong>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>{count}</span>
      </header>
      <div>
        {rows.length === 0 ? (
          <p style={{ margin: 0, padding: 12, fontSize: 12, color: '#9ca3af' }}>No data</p>
        ) : (
          rows.map((x, i) => (
            <div key={i} style={{ height: 40, borderBottom: '1px solid #f3f4f6', display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', padding: '0 12px', gap: 8 }}>
              <span style={{ fontSize: 13, color: '#374151', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{x.label}</span>
              {renderRight(x)}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export default function PMODashboard() {
  const [data, setData] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dashboardName, setDashboardName] = useState('My First Dashboard');
  const [widgets, setWidgets] = useState(DEFAULT_WIDGETS);
  const [showValues, setShowValues] = useState(false);

  const loadDashboard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [dash, all, projRes] = await Promise.all([
        dashboardAPI.byRole('pmo'),
        executionAPI.allTasks({}).catch(() => ({ data: { tasks: [] } })),
        projectsAPI.getAll().catch(() => ({ data: [] })),
      ]);
      setData(dash?.data || null);
      setTasks(Array.isArray(all?.data?.tasks) ? all.data.tasks : []);
      setProjects(Array.isArray(projRes?.data) ? projRes.data : []);
    } catch {
      if (!silent) {
        setData(null);
        setTasks([]);
        setProjects([]);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard(false);
  }, [loadDashboard]);

  usePeriodicRefresh(() => loadDashboard(true), 20000);

  const fullPortfolio = data?.fullPortfolio || [];
  const scores = data?.governanceComplianceScores || [];
  const pmPerf = data?.pmPerformanceComparison || [];

  const projectStatusBars = useMemo(() => {
    const c = { 'Not started': 0, 'In progress': 0, Completed: 0 };
    projects.forEach((p) => {
      const status = String(p.status || '').toLowerCase().trim();
      if (status === 'completed') c.Completed += 1;
      else if (status === 'active' || status === 'in progress') c['In progress'] += 1;
      else c['Not started'] += 1;
    });
    return [
      { label: 'Not started', value: c['Not started'], color: '#8b96ff' },
      { label: 'In progress', value: c['In progress'], color: '#00d84a' },
      { label: 'Completed', value: c.Completed, color: '#0a6721' },
    ];
  }, [projects]);

  const taskStatusBars = useMemo(() => {
    const c = { 'Not started': 0, 'In progress': 0, Completed: 0 };
    tasks.forEach((t) => {
      const st = String(t.status || '').toLowerCase();
      if (st === 'done' || st === 'completed') c.Completed += 1;
      else if (st === 'in progress') c['In progress'] += 1;
      else c['Not started'] += 1;
    });
    return [
      { label: 'Not started', value: c['Not started'], color: '#8b96ff' },
      { label: 'In progress', value: c['In progress'], color: '#00d84a' },
      { label: 'Completed', value: c.Completed, color: '#0a6721' },
    ];
  }, [tasks]);

  const statusByPhase = useMemo(() => {
    const byPhase = {};
    tasks.forEach((t) => {
      const phase = t.moduleName || t.phase || 'General';
      if (!byPhase[phase]) byPhase[phase] = { notStarted: 0, inProgress: 0, completed: 0 };
      const st = String(t.status || '').toLowerCase();
      if (st === 'done' || st === 'completed') byPhase[phase].completed += 1;
      else if (st === 'in progress') byPhase[phase].inProgress += 1;
      else byPhase[phase].notStarted += 1;
    });
    const categories = Object.keys(byPhase).slice(0, 5);
    const series = [
      { name: 'Not started', color: '#8b96ff', values: categories.map((c) => byPhase[c].notStarted) },
      { name: 'In progress', color: '#00d84a', values: categories.map((c) => byPhase[c].inProgress) },
      { name: 'Completed', color: '#0a6721', values: categories.map((c) => byPhase[c].completed) },
    ];
    const maxY = Math.max(1, ...series.flatMap((s) => s.values));
    return { categories, series, maxY };
  }, [tasks]);

  const addWidget = () => {
    const hidden = Object.entries(widgets).find(([, enabled]) => !enabled);
    if (!hidden) {
      window.alert('All widgets already added.');
      return;
    }
    setWidgets((prev) => ({ ...prev, [hidden[0]]: true }));
  };

  const newDashboard = () => {
    const name = window.prompt('Dashboard name', dashboardName);
    if (!name || !name.trim()) return;
    setDashboardName(name.trim());
    setWidgets({ rag: false, statusPhase: false, complianceDist: false, complianceTable: false, pmPerf: false });
  };

  if (loading) return <LoadingScreen title="Loading PMO dashboard" subtitle="Compiling portfolio KPIs and governance insights..." />;

  return (
    <div style={{ background: '#fff', minHeight: '100%', padding: 14 }}>
      <div style={{ maxWidth: 1320, margin: '0 auto' }}>
        <div style={{ borderBottom: '1px solid #eceff3', paddingBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 400, color: '#111827' }}>{dashboardName}</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={newDashboard} type="button" style={{ height: 30, borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: 13, fontWeight: 500, padding: '0 10px' }}>New dashboard +</button>
            <button onClick={addWidget} type="button" style={{ height: 30, borderRadius: 8, border: 0, background: '#000', color: '#fff', fontSize: 13, fontWeight: 600, padding: '0 12px' }}>Add new widget +</button>
          </div>
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 13, color: '#6b7280' }}>Portfolio coverage, policy posture, integrations, and PM performance comparison.</p>
        <div style={{ marginTop: 6, display: 'flex', justifyContent: 'flex-end' }}>
          <label style={{ fontSize: 12, color: '#4b5563', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={showValues} onChange={(e) => setShowValues(e.target.checked)} />
            Show values in charts
          </label>
        </div>

        <div style={{ marginTop: 8, display: 'grid', gap: 10, gridTemplateColumns: 'repeat(4, minmax(0,1fr))' }}>
          <KpiCard title="Portfolio Projects" value={fullPortfolio.length} />
          <KpiCard title="Policy Violations" value={(data?.policyViolations || []).length} />
          <KpiCard title="Failed Integrations" value={data?.integrationHealth?.failingIntegrations || 0} />
          <KpiCard title="Failed Sync Events" value={data?.nonSubmissionStats?.failedSyncs || 0} />
        </div>

        <div style={{ marginTop: 10, display: 'grid', gap: 10, gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
          {widgets.rag && (
            <BarChartCard
              title="Projects by status"
              bars={projectStatusBars}
              maxY={Math.max(1, ...projectStatusBars.map((b) => b.value))}
              yLabel="Project"
              xLabel="Status"
              showValues={showValues}
            />
          )}
          {widgets.statusPhase && (
            <StatusByPhaseCard
              title="Status by phase"
              categories={statusByPhase.categories}
              series={statusByPhase.series}
              maxY={statusByPhase.maxY}
              showValues={showValues}
            />
          )}
          {widgets.complianceDist && (
            <BarChartCard
              title="Task by status"
              bars={taskStatusBars}
              maxY={Math.max(1, ...taskStatusBars.map((b) => b.value))}
              yLabel="Task"
              xLabel="Status"
              showValues={showValues}
            />
          )}
        </div>

        <div style={{ marginTop: 10, display: 'grid', gap: 10, gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
          {widgets.complianceTable && (
            <ListCard
              title="Compliance scores"
              count={scores.length}
              rows={scores.map((s) => ({ label: s.projectName, score: s.score }))}
              renderRight={(x) => <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{x.score}</span>}
            />
          )}
          {widgets.pmPerf && (
            <ListCard
              title="PM performance comparison"
              count={pmPerf.length}
              rows={pmPerf.map((p) => ({ label: p.pmName, score: p.score, projectsManaged: p.projectsManaged }))}
              renderRight={(x) => (
                <span style={{ fontSize: 12, color: '#6b7280' }}>
                  <strong style={{ color: '#111827' }}>{x.score}</strong> ({x.projectsManaged} projects)
                </span>
              )}
            />
          )}
        </div>
      </div>
    </div>
  );
}
