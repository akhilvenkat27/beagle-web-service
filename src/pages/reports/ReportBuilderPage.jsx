import { useEffect, useMemo, useState } from 'react';
import { reportsAPI, usersAPI } from '../../services/api';
import {
  btnPrimary,
  btnSecondary,
  Card,
  CardTitle,
  inputClass,
  linkClass,
  PageHeader,
  PageShell,
  selectClass,
} from '../../components/reporting/reportingUi';

const FIELD_OPTIONS = [
  'projectName',
  'clientName',
  'status',
  'tier',
  'goLiveDate',
  'contractValue',
  'margin',
  'progress',
  'overdueTasks',
  'daysToGoLive',
  'name',
  'budgetHours',
  'loggedHours',
  'burnPercent',
  'title',
  'owner',
  'dueDate',
  'billable',
  'isOverdue',
  'approvedHours',
  'submittedHours',
  'nonSubmittedHours',
  'memberName',
  'role',
  'seniority',
  'region',
  'utilization',
];

const checkboxRow = 'flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink-700 hover:bg-ink-50';

export default function ReportBuilderPage() {
  const [fields, setFields] = useState(['projectName', 'clientName', 'status', 'margin']);
  const [filters, setFilters] = useState([{ field: 'status', operator: 'contains', value: '' }]);
  const [preview, setPreview] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState([]);
  const [name, setName] = useState('My report');
  const [users, setUsers] = useState([]);
  const [schedule, setSchedule] = useState({ reportId: '', frequency: 'weekly', recipients: [] });
  const [scheduledRows, setScheduledRows] = useState([]);

  const runPreview = async () => {
    setLoading(true);
    try {
      const { data } = await reportsAPI.run({
        fields,
        filters: filters.filter((f) => f.field && f.operator),
      });
      setPreview(data.rows || []);
    } catch {
      setPreview([]);
    } finally {
      setLoading(false);
    }
  };

  const loadSaved = async () => {
    const { data } = await reportsAPI.list();
    setSaved(Array.isArray(data) ? data : []);
  };

  const loadScheduled = async () => {
    try {
      const { data } = await reportsAPI.scheduled();
      setScheduledRows(Array.isArray(data) ? data : []);
    } catch {
      setScheduledRows([]);
    }
  };

  useEffect(() => {
    runPreview();
    loadSaved();
    loadScheduled();
    usersAPI
      .getAll()
      .then(({ data }) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => setUsers([]));
  }, []);

  const columns = useMemo(() => (preview[0] ? Object.keys(preview[0]) : fields), [preview, fields]);

  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Module 7 · Reporting"
        title="Custom Report Builder"
        subtitle="Pick fields, filter rows, preview data, save definitions, and schedule delivery to recipients."
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardTitle>Available fields</CardTitle>
          <div className="mt-4 max-h-72 space-y-0.5 overflow-y-auto pr-1">
            {FIELD_OPTIONS.map((f) => (
              <label key={f} className={checkboxRow}>
                <input
                  type="checkbox"
                  className="rounded border-ink-300 text-focus-600 focus:ring-focus-500"
                  checked={fields.includes(f)}
                  onChange={() =>
                    setFields((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]))
                  }
                />
                <span className="font-mono text-xs text-ink-800">{f}</span>
              </label>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardTitle>Filters</CardTitle>
          <div className="mt-4 space-y-3">
            {filters.map((f, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-3">
                <select
                  className={selectClass}
                  value={f.field}
                  onChange={(e) => {
                    const next = [...filters];
                    next[i].field = e.target.value;
                    setFilters(next);
                  }}
                >
                  <option value="">Field</option>
                  {FIELD_OPTIONS.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
                <select
                  className={selectClass}
                  value={f.operator}
                  onChange={(e) => {
                    const next = [...filters];
                    next[i].operator = e.target.value;
                    setFilters(next);
                  }}
                >
                  <option value="contains">contains</option>
                  <option value="eq">eq</option>
                  <option value="neq">neq</option>
                  <option value="gt">gt</option>
                  <option value="gte">gte</option>
                  <option value="lt">lt</option>
                  <option value="lte">lte</option>
                </select>
                <input
                  className={inputClass}
                  value={f.value}
                  onChange={(e) => {
                    const next = [...filters];
                    next[i].value = e.target.value;
                    setFilters(next);
                  }}
                  placeholder="Value"
                />
              </div>
            ))}
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                className={btnSecondary}
                onClick={() => setFilters((p) => [...p, { field: '', operator: 'contains', value: '' }])}
              >
                + Add filter
              </button>
              <button type="button" className={btnPrimary} disabled={loading} onClick={runPreview}>
                {loading ? 'Running…' : 'Run preview'}
              </button>
            </div>
          </div>
        </Card>
      </div>

      <Card className="mt-5">
        <CardTitle>Preview</CardTitle>
        <div className="mt-4 overflow-hidden rounded-xl border border-ink-200">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-ink-200 bg-ink-50">
                <tr>
                  {columns.map((c) => (
                    <th key={c} className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 bg-paper">
                {preview.slice(0, 60).map((r, i) => (
                  <tr key={i} className="transition hover:bg-ink-50/80">
                    {columns.map((c) => (
                      <td key={c} className="whitespace-nowrap px-3 py-2 text-ink-700">
                        {String(r[c] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {preview.length === 0 && !loading && (
          <p className="mt-3 text-center text-sm text-ink-400">No rows. Adjust fields or filters and run preview.</p>
        )}
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardTitle>Save report</CardTitle>
          <div className="mt-4 space-y-3">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Report name" />
            <button
              type="button"
              className={btnPrimary}
              onClick={async () => {
                await reportsAPI.save({ name, fields, filters, isPublic: false });
                await loadSaved();
                await loadScheduled();
              }}
            >
              Save definition
            </button>
            <ul className="max-h-36 space-y-2 overflow-y-auto rounded-lg border border-ink-100 bg-ink-50/50 p-3 text-xs text-ink-600">
              {saved.length === 0 && <li className="text-ink-400">No saved reports yet.</li>}
              {saved.map((r) => (
                <li key={r._id} className="flex flex-wrap items-center gap-2 border-b border-ink-100 pb-2 last:border-0 last:pb-0">
                  <span className="font-medium text-ink-800">{r.name}</span>
                  <button
                    type="button"
                    className={linkClass}
                    onClick={async () => {
                      const res = await reportsAPI.runSaved(r._id);
                      setPreview(res.data.rows || []);
                      setFields(r.fields || []);
                      setSchedule((s) => ({ ...s, reportId: r._id }));
                    }}
                  >
                    Run
                  </button>
                  <button
                    type="button"
                    className={linkClass}
                    onClick={async () => {
                      const res = await reportsAPI.exportSaved(r._id);
                      const blob = new Blob([res.data], { type: 'text/csv' });
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${r.name}.csv`;
                      a.click();
                      window.URL.revokeObjectURL(url);
                    }}
                  >
                    Export CSV
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card>
          <CardTitle>Schedule</CardTitle>
          <div className="mt-4 space-y-3">
            <select
              className={selectClass}
              value={schedule.reportId}
              onChange={(e) => setSchedule((s) => ({ ...s, reportId: e.target.value }))}
            >
              <option value="">Select saved report</option>
              {saved.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.name}
                </option>
              ))}
            </select>
            <select
              className={selectClass}
              value={schedule.frequency}
              onChange={(e) => setSchedule((s) => ({ ...s, frequency: e.target.value }))}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            <select
              multiple
              className={`${inputClass} min-h-[100px]`}
              value={schedule.recipients}
              onChange={(e) =>
                setSchedule((s) => ({
                  ...s,
                  recipients: Array.from(e.target.selectedOptions).map((o) => o.value),
                }))
              }
            >
              {users.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
            <button
              type="button"
              className={btnPrimary}
              onClick={async () => {
                if (!schedule.reportId) return;
                await reportsAPI.schedule(schedule.reportId, {
                  enabled: true,
                  frequency: schedule.frequency,
                  recipients: schedule.recipients,
                });
                await loadScheduled();
              }}
            >
              Save schedule
            </button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Scheduled reports</p>
              <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto text-xs text-ink-600">
                {scheduledRows.length === 0 && <li className="text-ink-400">None scheduled.</li>}
                {scheduledRows.map((r) => (
                  <li key={r._id}>
                    <span className="font-medium text-ink-800">{r.name}</span>
                    <span className="text-ink-500">
                      {' '}
                      — next:{' '}
                      {r.schedule?.nextRun ? new Date(r.schedule.nextRun).toLocaleString('en-IN') : '—'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </PageShell>
  );
}
