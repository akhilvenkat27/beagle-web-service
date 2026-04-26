import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import PillTag from '../../components/PillTag';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import { projectTemplatesAPI } from '../../services/api';
import { PROJECT_TEMPLATES_FALLBACK } from '../../constants/projectTemplatesCatalog';

function defaultGoLiveISO() {
  const d = new Date();
  d.setDate(d.getDate() + 90);
  return d.toISOString().slice(0, 10);
}

export default function ProjectTemplatesPage() {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [offlineCatalog, setOfflineCatalog] = useState(false);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({
    name: '',
    clientName: '',
    goLiveDate: defaultGoLiveISO(),
    contractValue: '2500000',
    implementationFee: '',
    notionalARR: '0',
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

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

  const openUse = (t) => {
    setFormError('');
    setForm({
      name: `${t.name} — `,
      clientName: '',
      goLiveDate: defaultGoLiveISO(),
      contractValue: '2500000',
      implementationFee: '',
      notionalARR: '0',
    });
    setModal(t);
  };

  const implFee = useMemo(() => {
    const raw = form.implementationFee.trim();
    if (raw === '') return Number(form.contractValue) || 0;
    return Number(raw) || 0;
  }, [form.implementationFee, form.contractValue]);

  const submitCreate = async () => {
    if (!modal?.id) return;
    setFormError('');
    const name = form.name.trim();
    const clientName = form.clientName.trim();
    if (name.length < 2) {
      setFormError('Project name must be at least 2 characters.');
      return;
    }
    if (!clientName) {
      setFormError('Client name is required.');
      return;
    }
    const contractValue = Number(form.contractValue);
    if (Number.isNaN(contractValue) || contractValue < 0) {
      setFormError('Contract value must be zero or a positive number.');
      return;
    }
    const notionalARR = Number(form.notionalARR || 0);
    if (Number.isNaN(notionalARR) || notionalARR < 0) {
      setFormError('Notional ARR must be zero or positive.');
      return;
    }
    setSubmitting(true);
    try {
      const goLive = new Date(form.goLiveDate);
      goLive.setHours(12, 0, 0, 0);
      const { data } = await projectTemplatesAPI.instantiate(modal.id, {
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
        setModal(null);
        navigate(`/projects/${data._id}`);
      } else {
        setFormError('Project was created but no id was returned.');
      }
    } catch (e) {
      const errs = e?.response?.data?.errors;
      const st = e?.response?.status;
      if (st === 404 || e?.response?.data?.message === 'Not found') {
        setFormError('Server could not create the project (404). Restart the API and try again.');
      } else if (Array.isArray(errs) && errs.length) {
        setFormError(errs.join(' '));
      } else {
        setFormError(e?.response?.data?.message || 'Could not create project from template');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-paper min-h-full p-6">
      <div className="max-w-6xl mx-auto">
        <PageHeader
          title="Project templates"
          subtitle="Create a project with predefined modules, phased workstreams, and starter tasks—then tune dates and owners in the project workspace."
          actions={(
            <Link to="/projects">
              <Button variant="secondary">View projects</Button>
            </Link>
          )}
        />

        {offlineCatalog ? (
          <p className="text-xs text-amber-900 bg-amber-50 border border-amber-100 rounded-md px-3 py-2 mt-4 mb-0">
            Offline mode: templates shown from the app. Restart the API (with project-templates routes) to enable
            Create project.
          </p>
        ) : null}

        {loadError ? (
          <p className="text-sm text-red-600 mt-4">{loadError}</p>
        ) : null}

        {loadingCatalog ? (
          <p className="text-sm text-ink-500 mt-6">Loading templates…</p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {catalog.map((t) => (
              <article
                key={t.id}
                className="border border-ink-100 rounded-lg bg-paper overflow-hidden shadow-sm flex flex-col"
              >
                <div className="h-20 bg-gradient-to-br from-violet-600 to-violet-400 px-3.5 py-3 text-white">
                  <p className="m-0 text-[11px] opacity-90">Template</p>
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
                    <PillTag color="success" label={t.duration} />
                  </div>
                  <div className="mt-3 flex gap-2 flex-wrap mt-auto">
                    <Button type="button" onClick={() => openUse(t)}>Use template</Button>
                    <Link to="/admin/intake">
                      <Button variant="ghost">Intake</Button>
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {modal ? (
          <Modal title={`Create from: ${modal.name}`} onClose={() => !submitting && setModal(null)}>
            <div className="space-y-3">
              <p className="text-xs text-ink-500 m-0 leading-relaxed">
                Creates a new Draft project from this catalog template: {modal.modules} modules, each with phased
                workstreams and starter tasks scheduled from your go-live date.
              </p>
              {Array.isArray(modal.sampleModuleNames) && modal.sampleModuleNames.length > 0 ? (
                <div>
                  <p className="text-[11px] font-medium text-ink-600 m-0 mb-1">Modules included</p>
                  <ul className="m-0 pl-4 text-[11px] text-ink-500 space-y-0.5 max-h-28 overflow-y-auto">
                    {(modal.modules > modal.sampleModuleNames.length
                      ? [...modal.sampleModuleNames, `+ ${modal.modules - modal.sampleModuleNames.length} more`]
                      : modal.sampleModuleNames
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
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  disabled={submitting}
                />
              </label>
              <label className="block text-xs font-medium text-ink-600">
                Client name
                <input
                  className="mt-1 w-full border border-ink-200 rounded-md px-2.5 py-1.5 text-sm"
                  value={form.clientName}
                  onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))}
                  disabled={submitting}
                  placeholder="Acme Corp"
                />
              </label>
              <label className="block text-xs font-medium text-ink-600">
                Go-live date
                <input
                  type="date"
                  className="mt-1 w-full border border-ink-200 rounded-md px-2.5 py-1.5 text-sm"
                  value={form.goLiveDate}
                  onChange={(e) => setForm((f) => ({ ...f, goLiveDate: e.target.value }))}
                  disabled={submitting}
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs font-medium text-ink-600">
                  Contract value
                  <input
                    className="mt-1 w-full border border-ink-200 rounded-md px-2.5 py-1.5 text-sm"
                    value={form.contractValue}
                    onChange={(e) => setForm((f) => ({ ...f, contractValue: e.target.value }))}
                    disabled={submitting}
                  />
                </label>
                <label className="block text-xs font-medium text-ink-600">
                  Notional ARR
                  <input
                    className="mt-1 w-full border border-ink-200 rounded-md px-2.5 py-1.5 text-sm"
                    value={form.notionalARR}
                    onChange={(e) => setForm((f) => ({ ...f, notionalARR: e.target.value }))}
                    disabled={submitting}
                  />
                </label>
              </div>
              <label className="block text-xs font-medium text-ink-600">
                Implementation fee (optional, defaults to contract value)
                <input
                  className="mt-1 w-full border border-ink-200 rounded-md px-2.5 py-1.5 text-sm"
                  value={form.implementationFee}
                  onChange={(e) => setForm((f) => ({ ...f, implementationFee: e.target.value }))}
                  disabled={submitting}
                  placeholder="Same as contract value"
                />
              </label>
              <p className="text-[11px] text-ink-500 m-0">
                New projects are created in <strong className="font-medium text-ink-700">Draft</strong>. Assign DH/PM
                and activate from the project workspace when ready—same flow as Rocketlane playbooks.
              </p>
              {formError ? <p className="text-xs text-red-600 m-0">{formError}</p> : null}
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" type="button" disabled={submitting} onClick={() => setModal(null)}>
                  Cancel
                </Button>
                <Button type="button" disabled={submitting} onClick={submitCreate}>
                  {submitting ? 'Creating…' : 'Create project'}
                </Button>
              </div>
            </div>
          </Modal>
        ) : null}
      </div>
    </div>
  );
}
