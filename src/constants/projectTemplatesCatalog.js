/**
 * Mirrors GET /api/project-templates when the API is missing or returns 404 (older backend).
 * IDs must match backend/services/projectTemplateBlueprints.js for POST instantiate to work.
 */

const E = ['Discovery & blueprinting', 'Core HR & org design', 'Payroll & compensation', 'Time, leave & attendance', 'Integrations & data migration', 'Cutover & hypercare'];
const S = ['Kickoff & discovery', 'Core configuration', 'UAT & training', 'Go-live support'];
const P = ['Program governance & waves', 'Country / entity configuration', 'Banking, statutory & interfaces', 'Parallel payroll & reconciliation', 'Retro, sign-off & hypercare'];

export const PROJECT_TEMPLATES_FALLBACK = [
  {
    id: 'enterprise-hcm',
    name: 'Enterprise HCM',
    desc: 'Full-lifecycle HCM rollout: discovery through cutover, with phased workstreams per module.',
    modules: E.length,
    duration: '20-32 wks',
    sampleModuleNames: E.slice(0, 5),
  },
  {
    id: 'smb-quickstart',
    name: 'SMB quick start',
    desc: 'Lean playbook for smaller customers: fast configuration, UAT, and go-live support.',
    modules: S.length,
    duration: '6-10 wks',
    sampleModuleNames: S,
  },
  {
    id: 'payroll-scale',
    name: 'Payroll at scale',
    desc: 'Multi-entity or multi-country payroll: governance, configuration, parallel runs, and handover.',
    modules: P.length,
    duration: '16-24 wks',
    sampleModuleNames: P,
  },
];
