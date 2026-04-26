export default function ProgressBar({ value = 0, segmented = false }) {
  const safe = Math.max(0, Math.min(100, Number(value) || 0));
  if (segmented) {
    const full = Math.round(safe / 20);
    return (
      <span style={{ display: 'inline-flex', gap: 2 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} style={{ color: i < full ? 'var(--progress-fill)' : '#d1d5db' }}>
            ◆
          </span>
        ))}
      </span>
    );
  }
  return (
    <div style={{ width: 120, height: 8, borderRadius: 9999, background: '#e5e7eb', overflow: 'hidden' }}>
      <div
        style={{
          width: `${safe}%`,
          height: '100%',
          background: 'linear-gradient(90deg, var(--progress-fill) 60%, var(--progress-fill-strong) 100%)',
        }}
      />
    </div>
  );
}
