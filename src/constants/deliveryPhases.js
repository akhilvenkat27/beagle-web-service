/** PRD / Rocketlane-aligned delivery lifecycle (matches backend Project.DELIVERY_PHASES) */
export const DELIVERY_PHASES = [
  'Deal Commit',
  'Sales Handover',
  'Customer Enablement',
  'Design Approval',
  'Build & Integration',
  'UAT',
  'Go-Live',
  'Closure',
];

export function phasePillTone(phase) {
  const p = phase || '';
  if (p.includes('UAT') || p.includes('Go-Live')) return 'bg-success-50 text-success-900 ring-success-100';
  if (p.includes('Design') || p.includes('Build')) return 'bg-link-50 text-link-900 ring-link-100';
  if (p.includes('Sales') || p.includes('Deal')) return 'bg-ink-100 text-ink-700 ring-ink-200';
  if (p.includes('Customer')) return 'bg-accent-50 text-accent-900 ring-accent-100';
  if (p.includes('Closure')) return 'bg-caution-50 text-caution-900 ring-caution-100';
  return 'bg-focus-50 text-focus-900 ring-focus-100';
}
