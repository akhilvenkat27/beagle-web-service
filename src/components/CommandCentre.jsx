import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { dashboardAPI } from '../services/api';
import { AT_RISK, CAUTION, healthLabel, ON_TRACK } from '../constants/healthRag';

const healthPanelTone = (h) => {
  if (h === ON_TRACK) return 'bg-success-100 border-success-300 text-success-900';
  if (h === AT_RISK) return 'bg-risk-100 border-risk-300 text-risk-900';
  if (h === CAUTION) return 'bg-caution-100 border-caution-300 text-caution-900';
  return 'bg-ink-100 border-ink-200 text-ink-800';
};

export default function CommandCentre({ projectId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const { data: d } = await dashboardAPI.commandCentre(projectId);
      setData(d);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load command centre');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="bg-paper border border-ink-200 rounded-lg p-6 mb-6 text-sm text-ink-500">
        Loading command centre…
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-paper border border-risk-200 rounded-lg p-6 mb-6 text-sm text-risk-600">
        {error}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="bg-paper border border-ink-200 rounded-lg p-6 mb-6">
      <h2 className="text-base font-semibold text-ink-900 mb-4">PM command centre</h2>

      <div className="mb-6">
        <h3 className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">
          Module health heatmap
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(data.ragHeatmap || []).map((m) => (
            <div
              key={m.moduleId}
              className={`rounded-lg border p-3 ${healthPanelTone(m.rag)}`}
            >
              <div className="flex items-center justify-between gap-2">
                <Link
                  to={`/projects/${projectId}/modules/${m.moduleId}`}
                  className="font-medium hover:underline truncate"
                >
                  {m.name}
                </Link>
                <span className="text-xs font-bold shrink-0">{healthLabel(m.rag)}</span>
              </div>
              <p className="text-xs mt-2 opacity-80">
                Progress {m.progress}% · Burn {m.burnPercent}% · Overdue tasks {m.overdueTasks}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">
            Top 5 overdue tasks
          </h3>
          {(data.top5Overdue || []).length === 0 ? (
            <p className="text-sm text-ink-400">No overdue tasks.</p>
          ) : (
            <div className="overflow-x-auto border border-ink-100 rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-ink-50 text-left text-xs text-ink-500">
                    <th className="px-3 py-2">Task</th>
                    <th className="px-3 py-2">Days</th>
                    <th className="px-3 py-2">Owner</th>
                    <th className="px-3 py-2">Module</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {data.top5Overdue.map((t) => (
                    <tr key={t.taskId}>
                      <td className="px-3 py-2 text-ink-800">{t.title}</td>
                      <td className="px-3 py-2 text-risk-600 font-medium">{t.daysOverdue}</td>
                      <td className="px-3 py-2 text-ink-600">{t.owner || '—'}</td>
                      <td className="px-3 py-2 text-ink-500">{t.module}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <h3 className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">
            Upcoming milestones (7 days)
          </h3>
          {(data.upcomingMilestones || []).length === 0 ? (
            <p className="text-sm text-ink-400">No planned milestones ending this week.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.upcomingMilestones.map((m) => (
                <li
                  key={m.workstreamId}
                  className="flex justify-between gap-2 border border-ink-100 rounded-md px-3 py-2"
                >
                  <span className="text-ink-800">
                    <span className="text-ink-500">{m.moduleName} ·</span> {m.name}
                  </span>
                  <span className="text-caution-700 font-medium shrink-0">
                    {m.daysUntilDue}d
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
