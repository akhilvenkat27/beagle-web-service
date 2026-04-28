import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import PillTag from '../../components/PillTag';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import { useAuth } from '../../context/AuthContext';
import { projectTemplatesAPI } from '../../services/api';
import { PROJECT_TEMPLATES_FALLBACK } from '../../constants/projectTemplatesCatalog';

const AUTHOR_ROLES = new Set(['admin', 'pmo']);

function defaultGoLiveISO() {
  const d = new Date();
  d.setDate(d.getDate() + 90);
  return d.toISOString().slice(0, 10);
}

export default function ProjectTemplatesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canAuthor = AUTHOR_ROLES.has(user?.role);

  const [catalog, setCatalog] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [offlineCatalog, setOfflineCatalog] = useState(false);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  // "Use template" modal state
  const [useModal, setUseModal] = useState(null);
  const [useForm, setUseForm] = useState({
    name: '',
    clientName: '',
    goLiveDate: defaultGoLiveISO(),
    contractValue: '2500000',
    implementationFee: '',
    notionalARR: '0',
  });
  const [useSubmitting, setUseSubmitting] = useState(false);
  const [useFormError, setUseFormError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const loadCatalog = useCallback(async () => {
    setLoadingCatalog(true);
    setLoadError('');
    setOfflineCatalog(false);
    try {
      const { data } = await projectTemplatesAPI.getCatalog();
      setCatalog(Array.isArray(data) ? data : []);
    } catch (e) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.message;
      if (status === 404 || msg === 'Not found') {
        setCatalog(PROJECT_TEMPLATES_FALLBACK);
        setOfflineCatalog(true);
      } else {
        setLoadError(msg || e?.message || 'Could not load templates');
        setCatalog([]);
      }
    } finally {
      setLoadingCatalog(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  /* -------------------------- Use template flow -------------------------- */

  const openUse = (t) => {
    setUseFormError('');
    setUseForm({
      name: `${t.name} — `,
      clientName: '',
      goLiveDate: defaultGoLiveISO(),
      contractValue: '2500000',
      implementationFee: '',
      notionalARR: '0',
    });
    setUseModal(t);
  };

  const implFee = useMemo(() => {
    const raw = useForm.implementationFee.trim();
    if (raw === '') return Number(useForm.contractValue) || 0;
    return Number(raw) || 0;
  }, [useForm.implementationFee, useForm.contractValue]);

  const submitUse = async () => {
    if (!useModal?.id) return;
    setUseFormError('');
    const name = useForm.name.trim();
    const clientName = useForm.clientName.trim();
    if (name.length < 2) {
      setUseFormError('Project name must be at least 2 characters.');
      return;
    }
    if (!clientName) {
      setUseFormError('Client name is required.');
      return;
    }
    const contractValue = Number(useForm.contractValue);
    if (Number.isNaN(contractValue) || contractValue < 0) {
      setUseFormError('Contract value must be zero or a positive number.');
      return;
    }
    const notionalARR = Number(useForm.notionalARR || 0);
    if (Number.isNaN(notionalARR) || notionalARR < 0) {
      setUseFormError('Notional ARR must be zero or positive.');
      return;
    }
    setUseSubmitting(true);
    try {
      const goLive = new Date(useForm.goLiveDate);
      goLive.setHours(12, 0, 0, 0);
      const { data } = await projectTemplatesAPI.instantiate(useModal.id, {
        name,
        clientName,
        goLiveDate: goLive.toISOString(),
        contractValue,
        implementationFee: implFee,
        notionalARR,
        status: 'Draft',
        region: 'India',
      });
      if (data?._id) {
        setUseModal(null);
        navigate(`/projects/${data._id}`);
      } else {
        setUseFormError('Project was created but no id was returned.');
      }
    } catch (e) {
      const errs = e?.response?.data?.errors;
      const st = e?.response?.status;
      if (st === 404 || e?.response?.data?.message === 'Not found') {
        setUseFormError('Server could not create the project (404). Restart the API and try again.');
      } else if (Array.isArray(errs) && errs.length) {
        setUseFormError(errs.join(' '));
      } else {
        setUseFormError(e?.response?.data?.message || 'Could not create project from template');
      }
    } finally {
      setUseSubmitting(false);
    }
  };

  /* -------------------------- Author / edit flow -------------------------- */

  const openCreate = () => {
    navigate('/execution/templates/new');
  };

  const openEdit = (templateId) => {
    navigate(`/execution/templates/${encodeURIComponent(templateId)}/edit`);
  };

  /* -------------------------- Delete flow -------------------------- */

  const requestDelete = (template) => {
    setDeleteError('');
    setDeleteTarget(template);
  };

  const confirmDelete = async () => {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await projectTemplatesAPI.remove(deleteTarget.id);
      await loadCatalog();
      setDeleteTarget(null);
    } catch (e) {
      setDeleteError(e?.response?.data?.message || e?.message || 'Could not delete template');
    } finally {
      setDeleting(false);
    }
  };

  /* -------------------------- Render -------------------------- */

  const headerActions = (
    <div className="flex gap-2">
      {canAuthor && !offlineCatalog ? (
        <Button onClick={openCreate}>New template</Button>
      ) : null}
      <Link to="/projects">
        <Button variant="secondary">View projects</Button>
      </Link>
    </div>
  );

  return (
    <div className="bg-paper min-h-full p-6">
      <div className="max-w-6xl mx-auto">
        <PageHeader
          title="Project templates"
          subtitle="Create a project with predefined modules, phased workstreams, and starter tasks—then tune dates and owners in the project workspace."
          actions={headerActions}
        />

        {offlineCatalog ? (
          <p className="text-xs text-amber-900 bg-amber-50 border border-amber-100 rounded-md px-3 py-2 mt-4 mb-0">
            Offline mode: templates shown from the app. Restart the API (with project-templates routes) to enable
            Create project and template authoring.
          </p>
        ) : null}

        {loadError ? <p className="text-sm text-red-600 mt-4">{loadError}</p> : null}

        {loadingCatalog ? (
          <p className="text-sm text-ink-500 mt-6">Loading templates…</p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {catalog.map((t) => {
              const isCustom = !!t.isCustom;
              return (
                <article
                  key={t.id}
                  className="border border-ink-100 rounded-lg bg-paper overflow-hidden shadow-sm flex flex-col"
                >
                  <div
                    className={`h-20 px-3.5 py-3 text-white bg-gradient-to-br ${
                      isCustom ? 'from-emerald-600 to-emerald-400' : 'from-violet-600 to-violet-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="m-0 text-[11px] opacity-90">Template</p>
                      <span className="text-[10px] font-semibold uppercase tracking-wide bg-white/20 px-1.5 py-0.5 rounded">
                        {isCustom ? 'Custom' : 'System'}
                      </span>
                    </div>
                    <h3 className="m-0 mt-1 text-[15px] font-semibold leading-snug">{t.name}</h3>
                  </div>
                  <div className="p-3.5 flex-1 flex flex-col">
                    <p className="m-0 text-[13px] text-ink-500 min-h-[3.25rem] leading-snug">{t.desc}</p>
                    {Array.isArray(t.sampleModuleNames) && t.sampleModuleNames.length > 0 ? (
                      <ul className="mt-2 m-0 pl-4 text-[11px] text-ink-500 space-y-0.5">
                        {t.sampleModuleNames.map((nm) => (
                          <li key={nm}>{nm}</li>
                        ))}
                        {t.modules > t.sampleModuleNames.length ? (
                          <li className="list-none -ml-4 text-ink-400">+ more in project</li>
                        ) : null}
                      </ul>
                    ) : null}
                    <div className="mt-2.5 flex gap-2 flex-wrap">
                      <PillTag label={`${t.modules} modules`} />
                      {t.duration ? <PillTag color="success" label={t.duration} /> : null}
                      {isCustom && t.createdByName ? <PillTag label={`by ${t.createdByName}`} /> : null}
                    </div>
                    <div className="mt-3 flex gap-2 flex-wrap mt-auto">
                      <Button type="button" onClick={() => openUse(t)}>Use template</Button>
                      {isCustom && canAuthor ? (
                        <>
                          <Button type="button" variant="secondary" onClick={() => openEdit(t.id)}>
                            Edit
                          </Button>
                          <Button type="button" variant="ghost" onClick={() => requestDelete(t)}>
                            Delete
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* "Use template" modal */}
        {useModal ? (
          <Modal title={`Create from: ${useModal.name}`} onClose={() => !useSubmitting && setUseModal(null)}>
            <div className="space-y-3">
              <p className="text-xs text-ink-500 m-0 leading-relaxed">
                Creates a new Draft project from this template: {useModal.modules} modules, each with workstreams and
                starter tasks scheduled from your go-live date.
              </p>
              {Array.isArray(useModal.sampleModuleNames) && useModal.sampleModuleNames.length > 0 ? (
                <div>
                  <p className="text-[11px] font-medium text-ink-600 m-0 mb-1">Modules included</p>
                  <ul className="m-0 pl-4 text-[11px] text-ink-500 space-y-0.5 max-h-28 overflow-y-auto">
                    {(useModal.modules > useModal.sampleModuleNames.length
                      ? [...useModal.sampleModuleNames, `+ ${useModal.modules - useModal.sampleModuleNames.length} more`]
                      : useModal.sampleModuleNames
                    ).map((line, idx) => (
                      <li key={`${line}-${idx}`}>{line}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <label className="block text-xs font-medium text-ink-600">
                Project name
                <input
                  className="mt-1 w-full border border-ink-200 rounded-md px-2.5 py-1.5 text-sm"
                  value={useForm.name}
                  onChange={(e) => setUseForm((f) => ({ ...f, name: e.target.value }))}
                  disabled={useSubmitting}
                />
              </label>
              <label className="block text-xs font-medium text-ink-600">
                Client name
                <input
                  className="mt-1 w-full border border-ink-200 rounded-md px-2.5 py-1.5 text-sm"
                  value={useForm.clientName}
                  onChange={(e) => setUseForm((f) => ({ ...f, clientName: e.target.value }))}
                  disabled={useSubmitting}
                  placeholder="Acme Corp"
                />
              </label>
              <label className="block text-xs font-medium text-ink-600">
                Go-live date
                <input
                  type="date"
                  className="mt-1 w-full border border-ink-200 rounded-md px-2.5 py-1.5 text-sm"
                  value={useForm.goLiveDate}
                  onChange={(e) => setUseForm((f) => ({ ...f, goLiveDate: e.target.value }))}
                  disabled={useSubmitting}
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs font-medium text-ink-600">
                  Contract value
                  <input
                    className="mt-1 w-full border border-ink-200 rounded-md px-2.5 py-1.5 text-sm"
                    value={useForm.contractValue}
                    onChange={(e) => setUseForm((f) => ({ ...f, contractValue: e.target.value }))}
                    disabled={useSubmitting}
                  />
                </label>
                <label className="block text-xs font-medium text-ink-600">
                  Notional ARR
                  <input
                    className="mt-1 w-full border border-ink-200 rounded-md px-2.5 py-1.5 text-sm"
                    value={useForm.notionalARR}
                    onChange={(e) => setUseForm((f) => ({ ...f, notionalARR: e.target.value }))}
                    disabled={useSubmitting}
                  />
                </label>
              </div>
              <label className="block text-xs font-medium text-ink-600">
                Implementation fee (optional, defaults to contract value)
                <input
                  className="mt-1 w-full border border-ink-200 rounded-md px-2.5 py-1.5 text-sm"
                  value={useForm.implementationFee}
                  onChange={(e) => setUseForm((f) => ({ ...f, implementationFee: e.target.value }))}
                  disabled={useSubmitting}
                  placeholder="Same as contract value"
                />
              </label>
              <p className="text-[11px] text-ink-500 m-0">
                New projects are created in <strong className="font-medium text-ink-700">Draft</strong>. Assign DH/PM
                and activate from the project workspace when ready.
              </p>
              {useFormError ? <p className="text-xs text-red-600 m-0">{useFormError}</p> : null}
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" type="button" disabled={useSubmitting} onClick={() => setUseModal(null)}>
                  Cancel
                </Button>
                <Button type="button" disabled={useSubmitting} onClick={submitUse}>
                  {useSubmitting ? 'Creating…' : 'Create project'}
                </Button>
              </div>
            </div>
          </Modal>
        ) : null}

        {/* Delete confirmation */}
        {deleteTarget ? (
          <Modal
            title={`Delete template: ${deleteTarget.name}`}
            onClose={() => !deleting && setDeleteTarget(null)}
          >
            <div className="space-y-3">
              <p className="text-sm text-ink-700 m-0">
                This will permanently remove the <strong>{deleteTarget.name}</strong> template. Existing projects
                created from it are not affected.
              </p>
              {deleteError ? <p className="text-xs text-red-600 m-0">{deleteError}</p> : null}
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" type="button" disabled={deleting} onClick={() => setDeleteTarget(null)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={deleting}
                  onClick={confirmDelete}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {deleting ? 'Deleting…' : 'Delete template'}
                </Button>
              </div>
            </div>
          </Modal>
        ) : null}
      </div>
    </div>
  );
}
