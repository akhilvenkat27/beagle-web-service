import { useState, useEffect } from 'react';
import { financialAPI } from '../../services/api';
import { AT_RISK, CAUTION, healthLabel, ON_TRACK } from '../../constants/healthRag';

function formatINR(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(n));
}

function formatINRShort(n) {
  const v = Number(n) || 0;
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(1)}Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(1)}L`;
  return formatINR(v);
}

function healthGlyph(health) {
  if (health === AT_RISK) return '▲';
  if (health === CAUTION) return '◆';
  if (health === ON_TRACK) return '●';
  return '·';
}

export default function PortfolioFinancePage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    financialAPI
      .getPortfolio()
      .then(({ data: d }) => setData(d))
      .catch((e) => setError(e.response?.data?.message || 'Failed to load portfolio'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-8 text-ink-600">Loading portfolio…</div>;
  }

  if (error) {
    return (
      <div className="p-8">
        <p className="text-risk-600">{error}</p>
      </div>
    );
  }

  const regions = data?.regions || [];

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-ink-900 mb-2">Portfolio finance</h1>
      <p className="text-sm text-ink-500 mb-8">
        Revenue uses implementation fee when set; otherwise contract value. Margin uses the financial engine
        (logged hours × user cost rate vs implementation fee).
      </p>

      <div className="space-y-8">
        {regions.map((r) => (
          <section key={r.region} className="bg-paper border border-ink-200 rounded-lg p-5 shadow-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
              <h2 className="text-lg font-semibold text-ink-800">{r.region} region</h2>
              <p className="text-sm text-ink-600">
                Total revenue: <strong>{formatINRShort(r.totalRevenue)}</strong>
                <span className="mx-2 text-ink-300">|</span>
                Avg margin: <strong>{r.avgMargin}%</strong>
                <span className="mx-2 text-ink-300">|</span>
                Portfolio margin: <strong>{r.portfolioMarginPct}%</strong>
              </p>
            </div>

            <ul className="border-t border-ink-100 pt-3 space-y-2">
              {(r.projects || []).map((p) => (
                <li
                  key={String(p.projectId)}
                  className="flex flex-wrap items-center gap-2 pl-3 border-l-2 border-ink-200 py-1.5 text-sm"
                >
                  <span className="text-base" title={healthLabel(p.rag)}>
                    {healthGlyph(p.rag)}
                  </span>
                  <span className="font-medium text-ink-800">{p.name}</span>
                  <span className="text-ink-400">·</span>
                  <span className="text-ink-600">{p.clientName}</span>
                  <span className="text-ink-400">·</span>
                  <span>{formatINRShort(p.revenue)} revenue</span>
                  <span className="text-ink-400">·</span>
                  <span>Margin {p.marginPercent}%</span>
                  {p.rag === AT_RISK && <span title="Low margin">⚠</span>}
                </li>
              ))}
            </ul>
          </section>
        ))}

        {regions.length === 0 && (
          <p className="text-ink-500 text-sm">No projects in portfolio.</p>
        )}
      </div>
    </div>
  );
}
