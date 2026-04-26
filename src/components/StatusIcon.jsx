export default function StatusIcon({ status = 'todo', size = 18 }) {
  const kind =
    status === 'done' ? 'done' : status === 'inprogress' ? 'inprogress' : 'todo';

  const common = {
    width: size,
    height: size,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  };

  if (kind === 'done') {
    return (
      <span
        style={{
          ...common,
          borderRadius: '9999px',
          background: '#22c55e',
          color: '#fff',
        }}
      >
        <svg width={Math.round(size * 0.62)} height={Math.round(size * 0.62)} viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M3.2 8.1 6.6 11.4 12.8 4.8" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }

  if (kind === 'inprogress') {
    return (
      <span
        style={{
          ...common,
          borderRadius: '9999px',
          border: '1.5px solid #22c55e',
          background: 'conic-gradient(#22c55e 0 50%, transparent 50% 100%)',
        }}
      />
    );
  }

  return (
    <span
      style={{
        ...common,
        borderRadius: '9999px',
        border: '1.5px solid #d1d5db',
        background: '#fff',
      }}
    />
  );
}
