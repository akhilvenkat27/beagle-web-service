const PALETTE = ['#ef4444', '#8b5cf6', '#16a34a', '#3b82f6', '#f97316'];

function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .map((s) => s[0]?.toUpperCase())
    .join('')
    .slice(0, 2);
}

export default function Avatar({ name = '', src = '', size = 24 }) {
  const bg = PALETTE[(name.length || 1) % PALETTE.length];
  const fontSize = Math.round(size * 0.4);
  if (src) {
    return (
      <img
        src={src}
        alt={name || 'avatar'}
        style={{ width: size, height: size, borderRadius: '9999px', objectFit: 'cover' }}
      />
    );
  }
  return (
    <span
      title={name}
      style={{
        width: size,
        height: size,
        borderRadius: '9999px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: bg,
        color: '#fff',
        fontSize,
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      {initials(name) || 'U'}
    </span>
  );
}
