import { useState, useEffect } from 'react';
import { darwinboxAPI } from '../../services/api';

function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function IntegrationHealthPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setError('');
    darwinboxAPI
      .getHealth()
      .then(({ data: d }) => setData(d))
      .catch((e) => setError(e.response?.data?.message || 'Failed to load health'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <div className="p-8 text-ink-600">Loading integration health…</div>;

  if (error) {
    return (
      <div className="p-8">
        <p className="text-risk-600">{error}</p>
      </div>
    );
  }

  const badge =
    data?.status === 'healthy'
      ? 'bg-success-100 text-success-800'
      : data?.status === 'degraded'
        ? 'bg-risk-100 text-risk-800'
        : 'bg-caution-100 text-caution-900';

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Integration health</h1>
          <p className="text-sm text-ink-500 mt-1">
            Darwinbox timesheets mock — last sync activity and per-project status (PMO view).
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            load();
          }}
          className="text-sm border border-ink-300 rounded-lg px-3 py-1.5 hover:bg-ink-50"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-paper border border-ink-200 rounded-lg p-4 shadow-sm">
          <p className="text-xs font-semibold text-ink-500 uppercase">Overall</p>
          <p className={`inline-block mt-2 text-xs font-bold px-2 py-1 rounded ${badge}`}>{data?.status || '—'}</p>
        </div>
        <div className="bg-paper border border-ink-200 rounded-lg p-4 shadow-sm">
          <p className="text-xs font-semibold text-ink-500 uppercase">Last sync</p>
          <p className="text-sm font-medium text-ink-900 mt-2">{fmtTime(data?.lastSync)}</p>
        </div>
        <div className="bg-paper border border-ink-200 rounded-lg p-4 shadow-sm">
          <p className="text-xs font-semibold text-ink-500 uppercase">Records (1h)</p>
          <p className="text-lg font-semibold text-ink-900 mt-1">{data?.recordsLastHour ?? 0}</p>
        </div>
        <div className="bg-paper border border-ink-200 rounded-lg p-4 shadow-sm">
          <p className="text-xs font-semibold text-ink-500 uppercase">Failed syncs (1h)</p>
          <p className="text-lg font-semibold text-ink-900 mt-1">{data?.failedSyncs ?? 0}</p>
          <p className="text-xs text-ink-500 mt-1">Success rate: {data?.successRateLastHour ?? 0}%</p>
        </div>
      </div>

      <div className="bg-paper border border-ink-200 rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-ink-100 bg-ink-50">
          <h2 className="text-sm font-semibold text-ink-800">Projects</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-ink-500 uppercase border-b">
            <tr>
              <th className="px-4 py-2">Project</th>
              <th className="px-4 py-2">Lifecycle</th>
              <th className="px-4 py-2">Tags pushed</th>
              <th className="px-4 py-2">Last Darwinbox sync</th>
              <th className="px-4 py-2">Records</th>
              <th className="px-4 py-2">Integration</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(data?.projectStatuses || []).map((p) => (
              <tr key={String(p.projectId)} className="hover:bg-ink-50/80">
                <td className="px-4 py-2.5 font-medium text-ink-900">{p.name}</td>
                <td className="px-4 py-2.5 text-ink-600">{p.status}</td>
                <td className="px-4 py-2.5 text-ink-600">{fmtTime(p.darwinboxTagsPushedAt)}</td>
                <td className="px-4 py-2.5 text-ink-600">{fmtTime(p.lastSyncAt)}</td>
                <td className="px-4 py-2.5 text-ink-600">{p.lastSyncRecords ?? 0}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      p.integrationStatus === 'healthy'
                        ? 'bg-success-100 text-success-800'
                        : p.integrationStatus === 'stale'
                          ? 'bg-caution-100 text-caution-900'
                          : p.integrationStatus === 'pending_sync'
                            ? 'bg-link-100 text-link-800'
                            : 'bg-ink-100 text-ink-600'
                    }`}
                  >
                    {p.integrationStatus}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!(data?.projectStatuses || []).length && (
          <p className="p-6 text-ink-500 text-sm">No projects yet.</p>
        )}
      </div>
    </div>
  );
}
