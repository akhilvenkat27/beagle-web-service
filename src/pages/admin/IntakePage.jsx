import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { intakeAPI } from '../../services/api';

function formatMoney(n) {
  if (n == null) return '—';
  return `$${Number(n).toLocaleString()}`;
}

export default function IntakePage() {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [newCredentials, setNewCredentials] = useState([]);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await intakeAPI.getPendingDeals();
      setDeals(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setDeals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    setNewCredentials(JSON.parse(sessionStorage.getItem('newClientCredentials') || '[]'));
  }, [load]);

  const openProjectFormWithDeal = (deal) => {
    navigate('/projects/create', {
      state: {
        hubspotPrefill: {
          name: `${deal.clientName} implementation`,
          clientName: deal.clientName,
          goLiveDate: deal.goLiveDate?.slice(0, 10) || '',
          contractValue: String(deal.contractValue ?? ''),
          notionalARR: String(deal.notionalARR ?? ''),
          hubspotDealId: deal.dealId,
          scopedModules: deal.scopedModules || [],
          implementationScope: deal.implementationScope || '',
          accountOwner: deal.accountOwner || '',
        },
      },
    });
  };

  const rejectDeal = async (deal) => {
    if (!window.confirm(`Reject HubSpot deal ${deal.dealId}?`)) return;
    setBusyId(deal.dealId);
    try {
      await intakeAPI.rejectPendingDeal(deal.dealId);
      await load();
    } catch (e) {
      alert(e.response?.data?.message || 'Could not reject deal');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <nav className="flex items-center gap-1.5 text-sm text-ink-400 mb-5">
        <Link to="/projects" className="hover:text-link-500 transition-colors">
          Projects
        </Link>
        <span>/</span>
        <span className="text-ink-700 font-medium">Pending HubSpot projects</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-900">Pending HubSpot projects</h1>
        <p className="text-sm text-ink-500 mt-1 max-w-3xl">
          Closed-won HubSpot deals land here first. Admins can intake a deal into project creation
          or reject noisy/duplicate payloads.
        </p>
      </div>

      {newCredentials.length > 0 && (
        <div className="mb-5 rounded-lg border border-success-100 bg-success-50 p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="m-0 text-sm font-semibold text-success-900">New client creations</h2>
            <button
              type="button"
              className="text-xs font-semibold text-success-900 underline"
              onClick={() => {
                sessionStorage.removeItem('newClientCredentials');
                setNewCredentials([]);
              }}
            >
              Clear
            </button>
          </div>
          <div className="grid gap-2">
            {newCredentials.map((c, idx) => (
              <div key={`${c.email}-${idx}`} className="rounded-md border border-success-100 bg-paper px-3 py-2 text-xs text-ink-700">
                <strong>{c.clientName}</strong> · Email: <code>{c.email}</code> · Temporary password:{' '}
                <code>{c.password}</code>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="text-center py-16 text-ink-400 text-sm">Loading pending deals…</div>
      )}

      {!loading && deals.length === 0 && (
        <div className="bg-paper border border-dashed border-ink-200 rounded-lg p-10 text-center text-ink-500 text-sm">
          No pending HubSpot deals. New closed-won deal webhooks will appear here for admin review.
        </div>
      )}

      {!loading && deals.length > 0 && (
        <div className="space-y-4">
          {deals.map((deal) => (
            <div
              key={deal.dealId}
              className="bg-paper border border-ink-200 rounded-lg p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-ink-400 uppercase tracking-wide">
                    {deal.dealId} · {deal.dealStage || 'closed won'}
                  </p>
                  <h2 className="text-lg font-semibold text-ink-900 mt-0.5">{deal.clientName}</h2>
                  <p className="text-sm text-ink-500 mt-1">
                    Go-live{' '}
                    <span className="text-ink-800 font-medium">
                      {deal.goLiveDate ? new Date(deal.goLiveDate).toLocaleDateString() : '—'}
                    </span>
                    <span className="mx-2 text-ink-300">·</span>
                    Contract {formatMoney(deal.contractValue)}
                    <span className="mx-2 text-ink-300">·</span>
                    Notional ARR {formatMoney(deal.notionalARR)}
                  </p>
                  <p className="text-xs text-ink-400 mt-2">
                    Account owner: {deal.accountOwner || '—'}
                  </p>
                  {deal.implementationScope ? (
                    <p className="text-xs text-ink-400 mt-2">Scope: {deal.implementationScope}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openProjectFormWithDeal(deal)}
                    className="text-sm font-medium bg-link-600 hover:bg-link-700 text-paper px-3 py-2 rounded-md transition-colors"
                  >
                    Intake
                  </button>
                  <button
                    type="button"
                    disabled={!!busyId}
                    onClick={() => rejectDeal(deal)}
                    className="text-sm font-medium border border-risk-200 hover:bg-risk-50 text-risk-700 px-3 py-2 rounded-md transition-colors disabled:opacity-50"
                  >
                    {busyId === deal.dealId ? 'Rejecting…' : 'Reject'}
                  </button>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-ink-100">
                <p className="text-xs font-semibold text-ink-500 uppercase mb-2">Scoped modules</p>
                <div className="flex flex-wrap gap-2">
                  {(deal.scopedModules || []).map((m) => (
                    <span
                      key={m}
                      className="text-xs bg-ink-100 text-ink-700 px-2 py-1 rounded-md border border-ink-200"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
