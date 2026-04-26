import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { auditAPI } from '../../services/api';

function formatAuditLine(entry) {
  const who = entry.actorName || 'Someone';
  const t = entry.timestamp ? new Date(entry.timestamp) : new Date();
  const timeStr = t.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  const dateStr = t.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  if (entry.entityType === 'Task' && entry.action === 'status_changed') {
    const title = entry.before?.title || entry.after?.title || 'task';
    return `[${who}] changed task "${title}" from ${entry.before?.status || '?'} → ${entry.after?.status || '?'} at ${timeStr} on ${dateStr}`;
  }
  if (entry.entityType === 'Task' && entry.action === 'hours_logged') {
    const title = entry.after?.title || entry.before?.title || 'task';
    return `[${who}] logged ${entry.after?.added ?? '?'}h on "${title}" at ${timeStr} on ${dateStr}`;
  }
  if (entry.entityType === 'Task' && entry.action === 'assigned_to') {
    const title = entry.after?.title || 'task';
    return `[${who}] reassigned "${title}" at ${timeStr} on ${dateStr}`;
  }
  if (entry.entityType === 'Project' && entry.action === 'status_changed') {
    return `[${who}] changed project status ${entry.before?.status} → ${entry.after?.status} at ${timeStr} on ${dateStr}`;
  }
  if (entry.entityType === 'Project' && entry.action === 'project_baseline_locked') {
    return `[${who}] locked financial baseline at ${timeStr} on ${dateStr}`;
  }
  if (entry.entityType === 'Module' && entry.action === 'status_changed') {
    return `[${who}] changed module "${entry.after?.name || ''}" status to ${entry.after?.status} at ${timeStr} on ${dateStr}`;
  }
  if (entry.entityType === 'Module' && entry.action === 'dependencies_updated') {
    return `[${who}] updated module dependencies at ${timeStr} on ${dateStr}`;
  }
  if (entry.entityType === 'Workstream' && entry.action?.includes('signoff')) {
    return `[${who}] ${entry.action.replace(/_/g, ' ')} (${entry.after?.name || 'workstream'}) at ${timeStr} on ${dateStr}`;
  }
  return `[${who}] ${entry.action} on ${entry.entityType} at ${timeStr} on ${dateStr}`;
}

export default function AuditTrailPage({ projectId: projectIdProp, embedded }) {
  const [searchParams] = useSearchParams();
  const projectId = projectIdProp || searchParams.get('projectId');

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await auditAPI.getByProject(projectId);
      setLogs(Array.isArray(data) ? data : []);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleExport = async () => {
    try {
      const res = await auditAPI.exportCsv(projectId);
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = projectId ? `audit-${projectId}.csv` : 'audit-all.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert(e.response?.data?.message || 'Export failed');
    }
  };

  return (
    <div className={embedded ? '' : 'p-6 max-w-3xl mx-auto'}>
      {!embedded && (
        <nav className="flex items-center gap-2 text-sm text-ink-400 mb-4">
          <Link to="/projects" className="hover:text-link-600">
            Projects
          </Link>
          {projectId && (
            <>
              <span>/</span>
              <Link to={`/projects/${projectId}`} className="hover:text-link-600 truncate">
                Project
              </Link>
              <span>/</span>
            </>
          )}
          <span className="text-ink-700">Audit trail</span>
        </nav>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="text-lg font-semibold text-ink-900">Audit trail</h2>
        <button
          type="button"
          onClick={handleExport}
          className="text-sm border border-ink-300 rounded-md px-3 py-1.5 hover:bg-ink-50"
        >
          Export CSV
        </button>
      </div>

      {loading && <p className="text-sm text-ink-400">Loading…</p>}

      {!loading && logs.length === 0 && (
        <p className="text-sm text-ink-500">
          {projectId ? 'No audit entries for this project yet.' : 'No audit entries yet.'}
        </p>
      )}

      {!loading && logs.length > 0 && (
        <ul className="space-y-3 border border-ink-100 rounded-lg divide-y divide-ink-100 bg-paper">
          {logs.map((entry) => (
            <li key={entry._id} className="px-4 py-3 text-sm text-ink-700">
              {formatAuditLine(entry)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
