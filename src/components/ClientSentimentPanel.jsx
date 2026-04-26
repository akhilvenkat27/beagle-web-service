import { useState } from 'react';
import { aiAPI } from '../services/api';

/**
 * Client email sentiment (FR-M5-06/07). Lazy-load on submit.
 * hideNumericScore: for client role — omit sentiment score in UI.
 */
export default function ClientSentimentPanel({ projectId, hideNumericScore }) {
  const [emailContent, setEmailContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState('');

  const loadHistory = async () => {
    if (!projectId) return;
    setHistoryLoading(true);
    try {
      const { data } = await aiAPI.listSentimentHistory(projectId);
      setHistory(data.history || []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!emailContent.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const { data } = await aiAPI.postClientSentiment(projectId, emailContent.trim());
      setResult(data);
      setEmailContent('');
      await loadHistory();
    } catch (err) {
      setError(err.response?.data?.error || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const sentimentClass = (s) => {
    const u = (s || '').toLowerCase();
    if (u.includes('negative')) return 'bg-risk-100 text-risk-800';
    if (u.includes('mixed')) return 'bg-caution-100 text-caution-900';
    if (u.includes('positive')) return 'bg-success-100 text-success-800';
    return 'bg-ink-100 text-ink-700';
  };

  return (
    <div className="space-y-3">
      <form onSubmit={submit} className="space-y-2">
        <label className="block text-xs font-medium text-ink-600">Paste client email</label>
        <textarea
          className="w-full border border-ink-200 rounded-md px-3 py-2 text-sm min-h-[100px]"
          value={emailContent}
          onChange={(e) => setEmailContent(e.target.value)}
          placeholder="Paste email thread or excerpt…"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={loading || !emailContent.trim()}
            className="text-xs font-medium bg-focus-600 text-paper px-3 py-1.5 rounded-md disabled:opacity-50"
          >
            {loading ? 'Analyzing…' : 'Analyze sentiment'}
          </button>
          <button
            type="button"
            onClick={loadHistory}
            disabled={historyLoading}
            className="text-xs border border-ink-300 rounded-md px-3 py-1.5 hover:bg-ink-50"
          >
            {historyLoading ? '…' : 'Load 4-week trend'}
          </button>
        </div>
      </form>

      {error && <p className="text-xs text-risk-600">{error}</p>}

      {result && (
        <div className="rounded-md border border-ink-100 p-3 bg-ink-50/80 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${sentimentClass(result.sentiment)}`}>
              {result.sentiment}
            </span>
            {!hideNumericScore && result.sentimentScore != null && (
              <span className="text-xs text-ink-600">Score: {result.sentimentScore}/100</span>
            )}
            {result.silenceRisk && (
              <span className="text-xs bg-caution-100 text-caution-800 px-1.5 rounded">Silence risk</span>
            )}
          </div>
          {result.keySignals?.length > 0 && (
            <ul className="text-xs text-ink-600 list-disc pl-4">
              {result.keySignals.map((k, i) => (
                <li key={i}>{k}</li>
              ))}
            </ul>
          )}
          {result.recommendation && (
            <p className="text-xs text-ink-800 border-l-2 border-focus-400 pl-2">{result.recommendation}</p>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-ink-600 mb-1">Recent analyses (max 4 weeks)</p>
          <ul className="text-xs space-y-1 max-h-32 overflow-y-auto">
            {history.map((h) => (
              <li key={h._id} className="flex flex-wrap gap-2 text-ink-600">
                <span>{new Date(h.createdAt).toLocaleDateString('en-IN')}</span>
                <span className={sentimentClass(h.sentiment)}>{h.sentiment}</span>
                {!hideNumericScore && <span>{h.sentimentScore}/100</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
