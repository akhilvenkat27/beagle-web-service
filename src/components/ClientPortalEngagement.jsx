import { useState } from 'react';
import { aiAPI } from '../services/api';

function sentimentClass(s) {
  const u = (s || '').toLowerCase();
  if (u.includes('negative')) return 'bg-risk-100 text-risk-800';
  if (u.includes('mixed')) return 'bg-caution-100 text-caution-900';
  if (u.includes('positive')) return 'bg-success-100 text-success-800';
  return 'bg-ink-100 text-ink-700';
}

/**
 * Client portal: lazy-load PM-approved narrative and sentiment summary (no numeric score).
 */
export default function ClientPortalEngagement({ projectId }) {
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [narrative, setNarrative] = useState(null);
  const [sentLoading, setSentLoading] = useState(false);
  const [sentimentPack, setSentimentPack] = useState(null);
  const [err, setErr] = useState('');

  const loadNarrative = async () => {
    if (!projectId) return;
    setNarrativeLoading(true);
    setErr('');
    try {
      const { data } = await aiAPI.getNarrative(projectId);
      setNarrative(data);
    } catch {
      setNarrative(null);
      setErr('Could not load status update.');
    } finally {
      setNarrativeLoading(false);
    }
  };

  const loadSentiment = async () => {
    if (!projectId) return;
    setSentLoading(true);
    setErr('');
    try {
      const { data } = await aiAPI.getClientSentimentView(projectId);
      setSentimentPack(data);
    } catch {
      setSentimentPack(null);
      setErr('Could not load engagement summary.');
    } finally {
      setSentLoading(false);
    }
  };

  return (
    <div className="bg-paper border border-ink-200 rounded-xl p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink-900">Updates from your delivery team</h2>
        <p className="text-xs text-ink-500">Loads on demand — nothing runs automatically.</p>
      </div>
      {err && <p className="text-xs text-risk-600">{err}</p>}

      <div className="border border-ink-100 rounded-lg p-4 space-y-2">
        <p className="text-xs font-medium text-ink-600 uppercase tracking-wide">Status narrative</p>
        <button
          type="button"
          onClick={loadNarrative}
          disabled={narrativeLoading}
          className="text-xs font-medium bg-link-600 text-paper px-3 py-1.5 rounded-md disabled:opacity-50"
        >
          {narrativeLoading ? 'Loading…' : 'Show latest message'}
        </button>
        {narrative?.pendingPMApproval && (
          <p className="text-xs text-caution-800">
            Your team is preparing a client-ready update. Check back soon.
          </p>
        )}
        {narrative?.narrative && (
          <p className="text-sm text-ink-800 whitespace-pre-wrap border-l-2 border-link-400 pl-3 mt-2">
            {narrative.narrative}
          </p>
        )}
      </div>

      <div className="border border-ink-100 rounded-lg p-4 space-y-2">
        <p className="text-xs font-medium text-ink-600 uppercase tracking-wide">Engagement tone</p>
        <p className="text-xs text-ink-500">
          Based on correspondence your PM has reviewed. Numeric scores are not shown here.
        </p>
        <button
          type="button"
          onClick={loadSentiment}
          disabled={sentLoading}
          className="text-xs font-medium border border-ink-300 rounded-md px-3 py-1.5 hover:bg-ink-50 disabled:opacity-50"
        >
          {sentLoading ? 'Loading…' : 'Show engagement summary'}
        </button>
        {sentimentPack?.latest && (
          <div className="mt-2 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded ${sentimentClass(sentimentPack.latest.sentiment)}`}
              >
                {sentimentPack.latest.sentiment}
              </span>
              {sentimentPack.latest.silenceRisk && (
                <span className="text-xs bg-caution-100 text-caution-800 px-1.5 rounded">Follow-up suggested</span>
              )}
            </div>
            {sentimentPack.latest.keySignals?.length > 0 && (
              <ul className="text-xs text-ink-600 list-disc pl-4">
                {sentimentPack.latest.keySignals.map((k, i) => (
                  <li key={i}>{k}</li>
                ))}
              </ul>
            )}
            {sentimentPack.latest.recommendation && (
              <p className="text-xs text-ink-800 border-l-2 border-focus-400 pl-2">
                {sentimentPack.latest.recommendation}
              </p>
            )}
          </div>
        )}
        {sentimentPack?.latest == null && sentimentPack?.trend?.length === 0 && sentimentPack && (
          <p className="text-xs text-ink-500">No analyses yet for this project.</p>
        )}
        {sentimentPack?.trend?.length > 0 && (
          <div className="mt-2">
            <p className="text-xs font-semibold text-ink-600 mb-1">Recent weeks (label only)</p>
            <ul className="text-xs space-y-1 max-h-28 overflow-y-auto">
              {sentimentPack.trend.map((t, i) => (
                <li key={i} className="flex gap-2 text-ink-600">
                  <span>{new Date(t.createdAt).toLocaleDateString('en-IN')}</span>
                  <span className={sentimentClass(t.sentiment)}>{t.sentiment}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
