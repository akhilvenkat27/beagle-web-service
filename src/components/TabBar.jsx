export default function TabBar({ tabs = [], activeTab, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid var(--border-default)', marginBottom: 16 }}>
      {tabs.map((t) => {
        const active = t.id === activeTab;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange?.(t.id)}
            style={{
              border: 'none',
              background: 'none',
              padding: '8px 4px',
              borderBottom: active ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: active ? 'var(--color-primary)' : 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
