const COLORS = {
  Draft: 'bg-ink-100 text-ink-600 border-ink-200',
  Active: 'bg-link-50 text-link-700 border-link-200',
  Completed: 'bg-success-50 text-success-700 border-success-200',
  'Not Started': 'bg-ink-100 text-ink-500 border-ink-200',
  'In Progress': 'bg-caution-50 text-caution-700 border-caution-200',
  Done: 'bg-success-50 text-success-700 border-success-200',
};

export default function StatusBadge({ status }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${COLORS[status] || 'bg-ink-100 text-ink-600 border-ink-200'}`}>
      {status}
    </span>
  );
}
