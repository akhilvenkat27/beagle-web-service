import { useEffect, useState } from 'react';
import { reportsAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { LoadingState, PageHeader, PageShell } from '../../components/reporting/reportingUi';

function rankTone(rank) {
  if (rank === 1) return 'bg-caution-50 text-caution-900 ring-1 ring-inset ring-caution-200';
  if (rank === 2) return 'bg-ink-100 text-ink-800 ring-1 ring-inset ring-ink-200';
  if (rank === 3) return 'bg-caution-50 text-caution-900 ring-1 ring-inset ring-caution-100';
  return 'bg-ink-50 text-ink-600 ring-1 ring-inset ring-ink-100';
}

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    reportsAPI
      .pmLeaderboard()
      .then(({ data }) => setRows(data.rankings || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState label="Loading leaderboard…" />;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Module 7 · Reporting"
        title="PM performance leaderboard"
        subtitle="Aggregated delivery and discipline signals. PMs may see anonymized peers depending on policy."
      />

      <div className="overflow-hidden rounded-2xl border border-ink-200 bg-paper shadow-[0_10px_35px_rgba(15,23,42,0.06)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-ink-200 bg-ink-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">Rank</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">PM</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                  On-time delivery
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Timesheet accuracy
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Escalation rate
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Discipline score
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Projects managed
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-ink-400">
                    No leaderboard rows yet.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.rank} className="transition hover:bg-ink-50/80">
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex min-w-[2rem] items-center justify-center rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${rankTone(r.rank)}`}
                    >
                      {r.rank}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-ink-900">
                    {user?.role === 'pm' && r.pmId !== user._id ? `PM #${r.rank}` : r.pmName}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-ink-700">{r.onTimeDeliveryRate}%</td>
                  <td className="px-4 py-3 tabular-nums text-ink-700">{r.timesheetAccuracy}%</td>
                  <td className="px-4 py-3 tabular-nums text-ink-700">{r.escalationRate}%</td>
                  <td className="px-4 py-3 tabular-nums text-ink-700">{r.disciplineScore}</td>
                  <td className="px-4 py-3 tabular-nums text-ink-700">{r.projectsManaged}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageShell>
  );
}
