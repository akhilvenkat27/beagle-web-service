export default function SectionCard({ title, count, children }) {
  return (
    <section style={{ border: '1px solid var(--border-default)', borderRadius: 8, overflow: 'hidden', background: '#fff', boxShadow: '0 1px 2px rgba(16,24,40,0.03)' }}>
      <header
        style={{
          height: 44,
          padding: '0 16px',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#fcfcfd',
        }}
      >
        <strong style={{ fontSize: 14, fontWeight: 600 }}>{title}</strong>
        {typeof count === 'number' ? (
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{count}</span>
        ) : null}
      </header>
      <div>{children}</div>
    </section>
  );
}
