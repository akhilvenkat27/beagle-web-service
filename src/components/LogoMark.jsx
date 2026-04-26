export default function LogoMark({ size = 16 }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: 3,
        background: '#0f172a',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      aria-hidden
    >
      <svg width={Math.max(10, size - 4)} height={Math.max(10, size - 4)} viewBox="0 0 14 14" fill="none">
        <path d="M3 3h4.5L4.8 7l2.7 4H3V3Z" fill="#fff" />
        <path d="M7.7 3h3.3L8.4 7l2.6 4H7.7L5 7l2.7-4Z" fill="#7c3aed" />
      </svg>
    </span>
  );
}
