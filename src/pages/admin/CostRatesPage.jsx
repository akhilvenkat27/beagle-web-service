import { useState, useEffect, useCallback } from 'react';
import { costRatesAPI } from '../../services/api';

const REGIONS = ['India', 'SEA', 'MEA', 'Americas', 'Other'];
const SENIORITY = ['Junior', 'Mid', 'Senior', 'Lead'];

const emptyForm = {
  role: '',
  seniority: 'Senior',
  region: 'India',
  ratePerHour: '',
  currency: 'INR',
  effectiveFrom: new Date().toISOString().slice(0, 10),
};

export default function CostRatesPage() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [supersedeId, setSupersedeId] = useState(null);
  const [superForm, setSuperForm] = useState({ ratePerHour: '', effectiveFrom: '' });

  const load = useCallback(async () => {
    setError('');
    try {
      const { data } = await costRatesAPI.list(true);
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load cost rates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submitAdd = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await costRatesAPI.create({
        role: form.role.trim(),
        seniority: form.seniority,
        region: form.region,
        ratePerHour: Number(form.ratePerHour),
        currency: form.currency,
        effectiveFrom: form.effectiveFrom,
      });
      setShowAdd(false);
      setForm(emptyForm);
      load();
    } catch (e) {
      setError(e.response?.data?.message || 'Create failed');
    }
  };

  const submitSupersede = async (e) => {
    e.preventDefault();
    if (!supersedeId) return;
    setError('');
    try {
      await costRatesAPI.supersede(supersedeId, {
        ratePerHour: Number(superForm.ratePerHour),
        effectiveFrom: superForm.effectiveFrom,
      });
      setSupersedeId(null);
      setSuperForm({ ratePerHour: '', effectiveFrom: '' });
      load();
    } catch (e) {
      setError(e.response?.data?.message || 'Supersede failed');
    }
  };

  if (loading) return <div className="p-8 text-ink-600">Loading…</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-ink-900">Cost rates</h1>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="bg-focus-600 hover:bg-focus-700 text-paper text-sm font-medium px-4 py-2 rounded-lg"
        >
          Add rate
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-risk-50 border border-risk-200 text-risk-800 text-sm rounded">{error}</div>
      )}

      <div className="bg-paper border border-ink-200 rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-ink-50 border-b text-left text-xs font-semibold text-ink-600 uppercase">
            <tr>
              <th className="px-4 py-3">Region</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Seniority</th>
              <th className="px-4 py-3">Rate / hr</th>
              <th className="px-4 py-3">Currency</th>
              <th className="px-4 py-3">Effective from</th>
              <th className="px-4 py-3">Effective to</th>
              <th className="px-4 py-3 w-28" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r._id} className={r.effectiveTo ? 'bg-ink-50/80 text-ink-500' : ''}>
                <td className="px-4 py-2.5">{r.region}</td>
                <td className="px-4 py-2.5">{r.role}</td>
                <td className="px-4 py-2.5">{r.seniority}</td>
                <td className="px-4 py-2.5 font-mono">{Number(r.ratePerHour).toLocaleString('en-IN')}</td>
                <td className="px-4 py-2.5">{r.currency}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  {r.effectiveFrom ? new Date(r.effectiveFrom).toLocaleDateString('en-IN') : '—'}
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  {r.effectiveTo ? new Date(r.effectiveTo).toLocaleDateString('en-IN') : '—'}
                </td>
                <td className="px-4 py-2.5">
                  {!r.effectiveTo && (
                    <button
                      type="button"
                      onClick={() => {
                        setSupersedeId(r._id);
                        setSuperForm({
                          ratePerHour: String(r.ratePerHour),
                          effectiveFrom: new Date().toISOString().slice(0, 10),
                        });
                      }}
                      className="text-focus-600 hover:underline text-xs font-medium"
                    >
                      Supersede
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-6 text-ink-500 text-sm">No cost rates yet.</p>}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-ink-950/40 flex items-center justify-center p-4 z-50">
          <div className="bg-paper rounded-lg p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold mb-4">Add cost rate</h2>
            <form onSubmit={submitAdd} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">Role</label>
                <input
                  required
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                  placeholder="e.g. Functional Consultant"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink-600 mb-1">Seniority</label>
                  <select
                    className="w-full border rounded px-3 py-2 text-sm"
                    value={form.seniority}
                    onChange={(e) => setForm((f) => ({ ...f, seniority: e.target.value }))}
                  >
                    {SENIORITY.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-600 mb-1">Region</label>
                  <select
                    className="w-full border rounded px-3 py-2 text-sm"
                    value={form.region}
                    onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
                  >
                    {REGIONS.map((reg) => (
                      <option key={reg} value={reg}>
                        {reg}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink-600 mb-1">Rate / hour</label>
                  <input
                    required
                    type="number"
                    min="0"
                    className="w-full border rounded px-3 py-2 text-sm"
                    value={form.ratePerHour}
                    onChange={(e) => setForm((f) => ({ ...f, ratePerHour: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-600 mb-1">Currency</label>
                  <select
                    className="w-full border rounded px-3 py-2 text-sm"
                    value={form.currency}
                    onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                  >
                    <option value="INR">INR</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">Effective from</label>
                <input
                  required
                  type="date"
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={form.effectiveFrom}
                  onChange={(e) => setForm((f) => ({ ...f, effectiveFrom: e.target.value }))}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="px-3 py-2 text-sm text-ink-600"
                  onClick={() => setShowAdd(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm bg-focus-600 text-paper rounded font-medium">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {supersedeId && (
        <div className="fixed inset-0 bg-ink-950/40 flex items-center justify-center p-4 z-50">
          <div className="bg-paper rounded-lg p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold mb-4">Supersede rate</h2>
            <p className="text-xs text-ink-500 mb-3">
              Closes the current row at end of day before the new effective date, and creates a new active rate.
            </p>
            <form onSubmit={submitSupersede} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">New rate / hour</label>
                <input
                  required
                  type="number"
                  min="0"
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={superForm.ratePerHour}
                  onChange={(e) => setSuperForm((f) => ({ ...f, ratePerHour: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">Effective from</label>
                <input
                  required
                  type="date"
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={superForm.effectiveFrom}
                  onChange={(e) => setSuperForm((f) => ({ ...f, effectiveFrom: e.target.value }))}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="px-3 py-2 text-sm text-ink-600"
                  onClick={() => setSupersedeId(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm bg-focus-600 text-paper rounded font-medium">
                  Supersede
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
