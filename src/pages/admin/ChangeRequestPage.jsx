import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { crAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/Modal';

const STATUS_ORDER = ['Draft', 'Pending Approval', 'Approved', 'Rejected'];

function statusStyle(s) {
  if (s === 'Approved') return 'bg-success-100 text-success-900';
  if (s === 'Rejected') return 'bg-risk-100 text-risk-800';
  if (s === 'Pending Approval') return 'bg-caution-100 text-caution-900';
  return 'bg-ink-100 text-ink-700';
}

export default function ChangeRequestPage() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const isDh = user?.role === 'dh' || user?.role === 'admin';

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [history, setHistory] = useState([]);
  const [showDetail, setShowDetail] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [form, setForm] = useState({
    title: '',
    description: '',
    scopeDescription: '',
    affectedWorkstreams: '',
  });
  const [saving, setSaving] = useState(false);

  const fetchList = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const { data } = await crAPI.list(projectId);
      setList(Array.isArray(data) ? data : []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const openDetail = async (id) => {
    try {
      const { data } = await crAPI.getById(id);
      setDetail(data.cr);
      setHistory(data.history || []);
      setShowDetail(true);
    } catch {
      alert('Failed to load CR');
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const affected = form.affectedWorkstreams
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      await crAPI.create({
        projectId,
        title: form.title.trim(),
        description: form.description.trim(),
        scopeDescription: form.scopeDescription.trim(),
        affectedWorkstreams: affected,
      });
      setShowCreate(false);
      setForm({ title: '', description: '', scopeDescription: '', affectedWorkstreams: '' });
      fetchList();
    } catch (err) {
      alert(err.response?.data?.error || err.response?.data?.message || 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  const submit = async (id) => {
    try {
      await crAPI.submit(id);
      fetchList();
      if (detail?._id === id) openDetail(id);
    } catch (err) {
      alert(err.response?.data?.error || 'Submit failed');
    }
  };

  const approve = async (id) => {
    if (!window.confirm('Approve this change request and bump financial baseline?')) return;
    try {
      await crAPI.approve(id);
      fetchList();
      setShowDetail(false);
    } catch (err) {
      alert(err.response?.data?.error || 'Approve failed');
    }
  };

  const reject = async () => {
    if (!rejectModal || !rejectReason.trim()) return;
    try {
      await crAPI.reject(rejectModal, rejectReason.trim());
      setRejectModal(null);
      setRejectReason('');
      fetchList();
      setShowDetail(false);
    } catch (err) {
      alert(err.response?.data?.error || 'Reject failed');
    }
  };

  const notify = async (id) => {
    try {
      await crAPI.notifyClient(id);
      fetchList();
      if (detail?._id === id) openDetail(id);
    } catch (err) {
      alert(err.response?.data?.error || 'Notify failed');
    }
  };

  const byStatus = STATUS_ORDER.map((st) => ({
    status: st,
    items: list.filter((c) => c.status === st),
  }));

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <nav className="text-sm text-ink-500 mb-4">
        <Link to="/projects" className="hover:text-link-600">
          Projects
        </Link>
        <span className="mx-2">/</span>
        <Link to={`/projects/${projectId}`} className="hover:text-link-600">
          Project
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink-800 font-medium">Change requests</span>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-ink-900">Change requests</h1>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="text-sm font-medium bg-link-600 text-paper px-4 py-2 rounded-md hover:bg-link-700"
        >
          New CR
        </button>
      </div>

      {loading ? (
        <p className="text-ink-500 text-sm">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {byStatus.map(({ status, items }) => (
            <div key={status} className="bg-paper border border-ink-200 rounded-lg p-3 min-h-[200px]">
              <p className={`text-xs font-bold uppercase tracking-wide mb-2 px-2 py-1 rounded ${statusStyle(status)}`}>
                {status}
              </p>
              <ul className="space-y-2">
                {items.map((c) => (
                  <li key={c._id}>
                    <button
                      type="button"
                      onClick={() => openDetail(c._id)}
                      className="text-left w-full text-sm border border-ink-100 rounded p-2 hover:bg-ink-50"
                    >
                      <span className="font-medium text-ink-900 block truncate">{c.title}</span>
                      <span className="text-xs text-ink-500">
                        {c.requestedBy?.name || '—'} · impact ~{c.impactDays}d
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <Modal title="New change request" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="space-y-3 max-w-lg">
            <div>
              <label className="text-xs font-medium text-ink-600">Title</label>
              <input
                className="w-full border rounded-md px-2 py-1.5 text-sm mt-0.5"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-600">Description</label>
              <textarea
                className="w-full border rounded-md px-2 py-1.5 text-sm mt-0.5 min-h-[72px]"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-600">Scope</label>
              <textarea
                className="w-full border rounded-md px-2 py-1.5 text-sm mt-0.5 min-h-[56px]"
                value={form.scopeDescription}
                onChange={(e) => setForm({ ...form, scopeDescription: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-600">Affected workstreams (comma-separated)</label>
              <input
                className="w-full border rounded-md px-2 py-1.5 text-sm mt-0.5"
                value={form.affectedWorkstreams}
                onChange={(e) => setForm({ ...form, affectedWorkstreams: e.target.value })}
                placeholder="Core HR, Payroll"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="text-sm bg-link-600 text-paper px-3 py-1.5 rounded-md disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Create draft'}
              </button>
              <button type="button" className="text-sm text-ink-600" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showDetail && detail && (
        <Modal title={detail.title} onClose={() => setShowDetail(false)}>
          <div className="max-w-2xl space-y-3 text-sm">
            <p className="text-xs font-semibold text-ink-500">Status: {detail.status}</p>
            <div>
              <p className="text-xs font-semibold text-ink-600">Description</p>
              <p className="text-ink-800 whitespace-pre-wrap">{detail.description || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-ink-600">Scope</p>
              <p className="text-ink-800 whitespace-pre-wrap">{detail.scopeDescription || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-ink-600">AI impact (on submit)</p>
              <ul className="text-ink-700 list-disc pl-4">
                <li>Days: {detail.impactDays}</li>
                <li>Cost (est.): {detail.impactCost}</li>
                <li>Margin shift (pts): {detail.impactMarginShift}</li>
              </ul>
              {detail.aiRecommendation && (
                <p className="text-xs text-ink-600 border-l-2 border-focus-300 pl-2 mt-1">{detail.aiRecommendation}</p>
              )}
            </div>
            {detail.status === 'Rejected' && detail.dhRejectionReason && (
              <div className="bg-risk-50 border border-risk-100 rounded p-2 text-xs text-risk-900">
                <strong>DH rejection:</strong> {detail.dhRejectionReason}
              </div>
            )}
            <p className="text-xs text-ink-500">
              Client notified: {detail.clientNotified ? `Yes (${detail.clientNotifiedAt || ''})` : 'No'}
            </p>

            <div className="flex flex-wrap gap-2 pt-2 border-t">
              {detail.status === 'Draft' && (
                <button
                  type="button"
                  onClick={() => submit(detail._id)}
                  className="text-xs bg-caution-600 text-paper px-3 py-1.5 rounded-md"
                >
                  Submit for DH approval
                </button>
              )}
              {isDh && detail.status === 'Pending Approval' && (
                <>
                  <button
                    type="button"
                    onClick={() => approve(detail._id)}
                    className="text-xs bg-success-700 text-paper px-3 py-1.5 rounded-md"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejectModal(detail._id)}
                    className="text-xs border border-risk-300 text-risk-800 px-3 py-1.5 rounded-md"
                  >
                    Reject
                  </button>
                </>
              )}
              {['Approved', 'Pending Approval'].includes(detail.status) && (
                <button
                  type="button"
                  onClick={() => notify(detail._id)}
                  className="text-xs border border-ink-300 px-3 py-1.5 rounded-md"
                >
                  Mark client notified
                </button>
              )}
            </div>

            {history.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-ink-600 mb-1">Audit history</p>
                <ul className="text-xs space-y-1 max-h-40 overflow-y-auto text-ink-600">
                  {history.map((h) => (
                    <li key={h._id}>
                      {new Date(h.timestamp).toLocaleString('en-IN')} — {h.action} ({h.actorName || '—'})
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Modal>
      )}

      {rejectModal && (
        <Modal title="Reject change request" onClose={() => { setRejectModal(null); setRejectReason(''); }}>
          <div className="max-w-md space-y-2">
            <textarea
              className="w-full border rounded-md p-2 text-sm min-h-[80px]"
              placeholder="Reason for rejection (required)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <button
              type="button"
              onClick={reject}
              disabled={!rejectReason.trim()}
              className="text-sm bg-risk-600 text-paper px-3 py-1.5 rounded-md disabled:opacity-50"
            >
              Confirm reject
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
