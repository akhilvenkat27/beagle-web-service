export default function EmptyState({ icon = '🔔', title, description, action }) {
  return (
    <div style={{ padding: '40px 16px', textAlign: 'center' }}>
      <div style={{ fontSize: 44, opacity: 0.35 }}>{icon}</div>
      <h3 style={{ marginTop: 8, marginBottom: 4, fontSize: 16, fontWeight: 500, color: '#374151' }}>{title}</h3>
      {description ? (
        <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>{description}</p>
      ) : null}
      {action ? <div style={{ marginTop: 12 }}>{action}</div> : null}
    </div>
  );
}
