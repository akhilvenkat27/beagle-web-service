/** Delivery health bands — matches API `rag` / health field values. */
export const ON_TRACK = 'on_track';
export const CAUTION = 'caution';
export const AT_RISK = 'at_risk';

const LABELS = {
  [ON_TRACK]: 'On track',
  [CAUTION]: 'Needs attention',
  [AT_RISK]: 'At risk',
};

export function healthLabel(value) {
  if (value == null || value === '') return '—';
  return LABELS[value] || String(value);
}

/** Maps API health codes to PillTag `color` props. */
export function healthPillVariant(health) {
  if (health === AT_RISK || health === CAUTION) return 'caution';
  return 'success';
}
