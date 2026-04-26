import { useEffect, useState } from 'react';
import { portfolioAPI } from '../../services/api';
import { PageHeader, PageShell, DeliveryHealthBadge } from '../../components/reporting/reportingUi';

export default function PortfolioDrilldownPage() {
  const [data, setData] = useState({ regions: [] });
  const [openRegions, setOpenRegions] = useState({});
  const [openAccounts, setOpenAccounts] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    setError(null);
    portfolioAPI
      .drilldown()
      .then(({ data: d }) => {
        const next = d || { regions: [] };
        setData(next);
        const first = (next.regions || [])[0]?.region;
        if (first) setOpenRegions({ [first]: true });
      })
      .catch((err) => {
        setData({ regions: [] });
        setError(
          err.response?.data?.message ||
            'Could not load portfolio drilldown. Sign in and ensure your account is linked to projects.'
        );
      });
  }, []);

  const regions = data.regions || [];

  return (
    <PageShell>
      <PageHeader
        eyebrow="Module 7 · Reporting"
        title="Portfolio drilldown"
        subtitle="Expand regions and accounts to inspect project-level margin, delivery health, and milestone status."
      />

      <div className="space-y-4">
        {error && (
          <div className="rounded-xl border border-caution-200 bg-caution-50 px-4 py-3 text-sm text-caution-950">
            {error}
          </div>
        )}
        {regions.length === 0 && !error && (
          <div className="rounded-2xl border border-ink-200 bg-paper p-10 text-center text-sm text-ink-500 shadow-[0_10px_35px_rgba(15,23,42,0.06)]">
            No portfolio regions returned. If the database is empty, run{' '}
            <code className="rounded bg-ink-100 px-1.5 py-0.5 text-xs text-ink-800">npm run seed</code>{' '}
            in the backend — projects must include a <span className="font-medium">region</span> field for
            grouping.
          </div>
        )}
        {regions.map((r) => (
          <div
            key={r.region}
            className="overflow-hidden rounded-2xl border border-ink-200 bg-paper shadow-[0_10px_35px_rgba(15,23,42,0.06)]"
          >
            <button
              type="button"
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-ink-50/80"
              onClick={() => setOpenRegions((s) => ({ ...s, [r.region]: !s[r.region] }))}
            >
              <span className="flex items-center gap-2">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${openRegions[r.region] ? 'bg-focus-600' : 'bg-ink-300'}`}
                  aria-hidden
                />
                <span className="text-base font-semibold text-ink-900">{r.region}</span>
              </span>
              <span className="text-sm text-ink-500">
                {r.kpis.projects} projects · <span className="tabular-nums">{r.kpis.avgMargin}%</span> avg margin
              </span>
            </button>
            {openRegions[r.region] && (
              <div className="space-y-3 border-t border-ink-100 px-5 pb-5 pt-2">
                {r.accounts.map((a) => {
                  const k = `${r.region}:${a.account}`;
                  return (
                    <div key={k} className="overflow-hidden rounded-xl border border-ink-200 bg-ink-50/40">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition hover:bg-paper"
                        onClick={() => setOpenAccounts((s) => ({ ...s, [k]: !s[k] }))}
                      >
                        <span className="font-medium text-ink-900">{a.account}</span>
                        <span className="text-xs text-ink-500">
                          {a.kpis.projects} projects · <span className="tabular-nums">{a.kpis.avgMargin}%</span>
                        </span>
                      </button>
                      {openAccounts[k] && (
                        <div className="border-t border-ink-200 bg-paper px-3 pb-3 pt-2">
                          <div className="overflow-hidden rounded-lg border border-ink-200">
                            <div className="overflow-x-auto">
                              <table className="w-full min-w-[560px] text-sm">
                                <thead className="border-b border-ink-200 bg-ink-50">
                                  <tr>
                                    <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                                      Project
                                    </th>
                                    <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                                      Health
                                    </th>
                                    <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                                      Margin%
                                    </th>
                                    <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                                      Milestone health
                                    </th>
                                    <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                                      Days to go-live
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-ink-100">
                                  {a.projects.map((p) => (
                                    <tr key={p.projectId} className="transition hover:bg-ink-50/80">
                                      <td className="px-3 py-2 font-medium text-ink-900">{p.projectName}</td>
                                      <td className="px-3 py-2">
                                        <DeliveryHealthBadge value={p.rag} />
                                      </td>
                                      <td className="px-3 py-2 tabular-nums text-ink-700">{p.marginPercent}</td>
                                      <td className="px-3 py-2 tabular-nums text-ink-700">{p.milestoneHealth}%</td>
                                      <td className="px-3 py-2 tabular-nums text-ink-700">{p.daysToGoLive ?? '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </PageShell>
  );
}
