import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePeriodicRefresh } from '../../hooks/usePeriodicRefresh';
import { dashboardAPI, executionAPI } from '../../services/api';
import { AT_RISK } from '../../constants/healthRag';
import LogoMark from '../../components/LogoMark';
import LoadingScreen from '../../components/LoadingScreen';

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

function BarChartCard({ title, xLabel = '', yLabel = '', bars = [], maxY = 1 }) {
  return (
    <div style={{ border: '1px solid #eceff3', borderRadius: 8, background: '#fff', padding: '10px 12px', minHeight: 250 }}>
      <p style={{ margin: 0, fontSize: 13, color: '#111827' }}>{title}</p>
      <div style={{ height: 170, marginTop: 14, borderLeft: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', padding: '8px 8px 0 8px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', gap: 10 }}>
        {bars.map((b) => {
          const val = Number(b.value) || 0;
          const pct = Math.round((val / Math.max(1, maxY)) * 100);
          return (
            <div key={b.label} style={{ display: 'grid', justifyItems: 'center', gap: 5, width: '100%' }}>
              <div style={{ width: 34, height: `${Math.max(6, pct)}%`, background: b.color || '#22c55e', borderRadius: 3 }} />
              <span style={{ fontSize: 10, color: '#6b7280', textAlign: 'center' }}>{b.label}</span>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#9ca3af' }}>
        <span>{yLabel}</span>
        <span>{xLabel}</span>
      </div>
    </div>
  );
}

function GroupedBarChartCard({ title, series = [], categories = [] }) {
  const maxY = Math.max(1, ...series.flatMap((s) => s.values));

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
      <div style={{ height: 170, marginTop: 8, borderLeft: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', padding: '8px 6px 0 6px', display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, categories.length)}, minmax(0,1fr))`, gap: 10, alignItems: 'end' }}>
        {categories.map((c, ci) => (
          <div key={c} style={{ display: 'grid', justifyItems: 'center', alignItems: 'end', height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: '100%' }}>
              {series.map((s) => {
                const v = Number(s.values[ci]) || 0;
                const pct = Math.round((v / maxY) * 100);
                return (
                  <span
                    key={`${s.name}-${ci}`}
                    style={{
                      width: 9,
                      height: `${Math.max(4, pct)}%`,
                      background: s.color,
                      borderRadius: 2,
                      display: 'inline-block',
                    }}
                  />
                );
              })}
            </div>
            <span style={{ marginTop: 5, fontSize: 9, color: '#6b7280', textAlign: 'center' }}>
              {c.length > 10 ? `${c.slice(0, 8)}...` : c}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PMDashboard() {
  const [data, setData] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [dash, all] = await Promise.all([
        dashboardAPI.byRole('pm'),
        executionAPI.allTasks({}).catch(() => ({ data: { tasks: [] } })),
      ]);
      setData(dash?.data || null);
      setTasks(Array.isArray(all?.data?.tasks) ? all.data.tasks : []);
    } catch {
      if (!silent) {
        setData(null);
        setTasks([]);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard(false);
  }, [loadDashboard]);

  usePeriodicRefresh(() => loadDashboard(true), 20000);

  const myProjects = data?.myProjects || [];
  const projectsInProgress = myProjects.length;
  const projectsOverdue = myProjects.filter((p) => Number(p.overdueTasks) > 0).length;
  const projectsRunningLate = myProjects.filter(
    (p) => Number(p.burnPercent) > 90 || p.rag === AT_RISK
  ).length;

  const projectByStatusBars = [{ label: 'In progress', value: projectsInProgress, color: '#00d84a' }];

  const phaseData = useMemo(() => {
    const modules = {};
    tasks.forEach((t) => {
      const k = t.moduleName || 'Unknown';
      if (!modules[k]) modules[k] = { todo: 0, progress: 0, overdue: 0 };
      if (t.status === 'Done') return;
      if (t.status === 'In Progress') modules[k].progress += 1;
      else modules[k].todo += 1;
      if (t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'Done') modules[k].overdue += 1;
    });
    const names = Object.keys(modules).slice(0, 4);
    return {
      categories: names,
      todo: names.map((n) => modules[n].todo),
      progress: names.map((n) => modules[n].progress),
      overdue: names.map((n) => modules[n].overdue),
    };
  }, [tasks]);

  const taskStatusBars = useMemo(() => {
    const m = { 'To do': 0, 'In progress': 0, Completed: 0 };
    tasks.forEach((t) => {
      if (t.status === 'Done') m.Completed += 1;
      else if (t.status === 'In Progress') m['In progress'] += 1;
      else m['To do'] += 1;
    });
    return [
      { label: 'To do', value: m['To do'], color: '#8b96ff' },
      { label: 'In progress', value: m['In progress'], color: '#00d84a' },
      { label: 'Completed', value: m.Completed, color: '#0a6721' },
    ];
  }, [tasks]);

  if (loading) return <LoadingScreen title="Loading PM dashboard" subtitle="Gathering milestone and task performance signals..." />;

  return (
    <div style={{ background: '#fff', minHeight: '100%', padding: 14 }}>
      <div style={{ maxWidth: 1320, margin: '0 auto' }}>
        <div style={{ borderBottom: '1px solid #eceff3', paddingBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="button" style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280' }}>≡</button>
            <h1 style={{ margin: 0, fontSize: 32, fontWeight: 400, color: '#111827' }}>My First Dashboard</h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" style={{ height: 30, borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: 13, fontWeight: 500, padding: '0 10px' }}>New dashboard +</button>
            <button type="button" style={{ height: 30, borderRadius: 8, border: 0, background: '#000', color: '#fff', fontSize: 13, fontWeight: 600, padding: '0 12px' }}>Add new widget +</button>
          </div>
        </div>

        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" style={{ height: 28, borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: 12, fontWeight: 600, padding: '0 10px' }}>Dashboard</button>
            <button type="button" style={{ height: 28, borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: 12, fontWeight: 600, padding: '0 10px' }}>Filter</button>
            <button type="button" style={{ height: 28, borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: 12, fontWeight: 500, padding: '0 10px' }}>25 Apr 25 - 25 Apr 26</button>
          </div>
          <label style={{ fontSize: 12, color: '#4b5563', display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" style={{ accentColor: '#9ca3af' }} />
            Show values in charts
          </label>
        </div>

        <div style={{ marginTop: 10, display: 'grid', gap: 10, gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
          <KpiCard title="Projects In-Progress" value={projectsInProgress} />
          <KpiCard title="Projects Overdue" value={projectsOverdue} />
          <KpiCard title="Projects Running late" value={projectsRunningLate} />
        </div>

        <div style={{ marginTop: 10, display: 'grid', gap: 10, gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
          <BarChartCard title="Project by Status" xLabel="Status" yLabel="Project" bars={projectByStatusBars} maxY={Math.max(1, projectsInProgress)} />
          <GroupedBarChartCard
            title="Status by Phase"
            categories={phaseData.categories}
            series={[
              { name: 'In progress', color: '#00d84a', values: phaseData.progress },
              { name: 'Overdue', color: '#ff1f60', values: phaseData.overdue },
              { name: 'To do', color: '#8b96ff', values: phaseData.todo },
            ]}
          />
          <BarChartCard title="Task by status" xLabel="Status" yLabel="Task" bars={taskStatusBars} maxY={Math.max(1, ...taskStatusBars.map((b) => b.value))} />
        </div>

        <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {(data?.upcomingMilestones || []).slice(0, 4).map((m, i) => (
            <div key={`${m.name}-${i}`} style={{ border: '1px solid #eceff3', borderRadius: 8, padding: '8px 10px', fontSize: 12, color: '#374151', background: '#fff' }}>
              <LogoMark size={12} /> <span style={{ marginLeft: 6 }}>{m.module} / {m.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
