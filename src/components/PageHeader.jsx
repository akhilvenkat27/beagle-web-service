export default function PageHeader({ icon, title, actions, subtitle }) {
  return (
    <div style={{ borderBottom: '1px solid var(--border-default)', paddingBottom: 12, marginBottom: 14 }}>
      <div style={{ minHeight: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon ? <span style={{ color: 'var(--text-secondary)' }}>{icon}</span> : null}
          <h1 style={{ margin: 0, fontSize: 'var(--font-size-xl)', fontWeight: 600, color: 'var(--text-primary)' }}>
            {title}
          </h1>
        </div>
        {actions ? <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{actions}</div> : null}
      </div>
      {subtitle ? (
        <p style={{ margin: 0, marginTop: 3, color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
