import { useState, useEffect, useCallback } from 'react';
import { aiAPI } from '../services/api';

const TYPES = ['Risk', 'Assumption', 'Issue', 'Dependency'];
const PRIOS = ['High', 'Medium', 'Low'];

export default function RAIDLog({ projectId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [manual, setManual] = useState({ type: 'Risk', description: '', priority: 'Medium' });
  const [showManual, setShowManual] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await aiAPI.listRaidItems(projectId);
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load RAID log');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const extract = async () => {
    if (!notes.trim()) return;
    setExtracting(true);
    setError('');
    try {
      await aiAPI.postRaidExtract(projectId, notes.trim());
      setNotes('');
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Extract failed');
    } finally {
      setExtracting(false);
    }
  };

  const confirm = async (id) => {
    try {
      await aiAPI.patchRaidItem(id, { confirmedByPM: true });
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Update failed');
    }
  };

  const addManual = async (e) => {
    e.preventDefault();
    try {
      await aiAPI.createRaidItem(projectId, manual);
      setManual({ type: 'Risk', description: '', priority: 'Medium' });
      setShowManual(false);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Create failed');
    }
  };

  const exportCsv = () => {
    const headers = ['type', 'description', 'priority', 'status', 'source', 'confirmedByPM', 'suggestedOwner'];
    const rows = items.map((r) =>
      headers.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(',')
    );
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `raid-${projectId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-paper border border-ink-200 rounded-lg p-6 space-y-4">
      <div className="flex flex-wrap justify-between gap-2">
        <h2 className="text-base font-semibold text-ink-900">RAID log</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={exportCsv}
            className="text-xs border border-ink-300 rounded-md px-2 py-1 hover:bg-ink-50"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => setShowManual((s) => !s)}
            className="text-xs bg-ink-800 text-paper rounded-md px-2 py-1 hover:bg-ink-900"
          >
            Add RAID item
          </button>
        </div>
      </div>

      <div className="border border-dashed border-ink-200 rounded-md p-3 space-y-2">
        <p className="text-xs font-medium text-ink-600">Extract from meeting notes (AI)</p>
        <textarea
          className="w-full text-sm border rounded-md px-2 py-1.5 min-h-[80px]"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Paste notes…"
        />
        <button
          type="button"
          onClick={extract}
          disabled={extracting || !notes.trim()}
          className="text-xs bg-accent-700 text-paper px-3 py-1 rounded-md disabled:opacity-50"
        >
          {extracting ? 'Extracting…' : 'Extract RAID'}
        </button>
      </div>

      {showManual && (
        <form onSubmit={addManual} className="border border-ink-100 rounded-md p-3 space-y-2 text-sm">
          <select
            className="border rounded px-2 py-1"
            value={manual.type}
            onChange={(e) => setManual((m) => ({ ...m, type: e.target.value }))}
          >
            {TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <select
            className="border rounded px-2 py-1"
            value={manual.priority}
            onChange={(e) => setManual((m) => ({ ...m, priority: e.target.value }))}
          >
            {PRIOS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <textarea
            required
            className="w-full border rounded px-2 py-1"
            placeholder="Description"
            value={manual.description}
            onChange={(e) => setManual((m) => ({ ...m, description: e.target.value }))}
          />
          <button type="submit" className="text-xs bg-link-600 text-paper px-2 py-1 rounded">
            Save
          </button>
        </form>
      )}

      {error && <p className="text-xs text-risk-600">{error}</p>}
      {loading && <p className="text-xs text-ink-500">Loading…</p>}

      <div className="overflow-x-auto border rounded-md">
        <table className="w-full text-xs">
          <thead className="bg-ink-50 text-left">
            <tr>
              <th className="px-2 py-1.5">Type</th>
              <th className="px-2 py-1.5">Description</th>
              <th className="px-2 py-1.5">Prio</th>
              <th className="px-2 py-1.5">Source</th>
              <th className="px-2 py-1.5">PM</th>
              <th className="px-2 py-1.5" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((r) => (
              <tr key={r._id} className={r.confirmedByPM ? '' : 'bg-caution-50/50'}>
                <td className="px-2 py-1.5 font-medium">{r.type}</td>
                <td className="px-2 py-1.5 text-ink-700 max-w-xs truncate" title={r.description}>
                  {r.description}
                </td>
                <td className="px-2 py-1.5">{r.priority}</td>
                <td className="px-2 py-1.5">{r.source}</td>
                <td className="px-2 py-1.5">{r.confirmedByPM ? '✓' : '—'}</td>
                <td className="px-2 py-1.5">
                  {!r.confirmedByPM && (
                    <button
                      type="button"
                      onClick={() => confirm(r._id)}
                      className="text-focus-600 hover:underline"
                    >
                      Confirm
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
