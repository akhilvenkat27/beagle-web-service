const STYLES = {
  info: ['var(--tag-link-bg)', 'var(--tag-link-fg)'],
  success: ['var(--tag-success-bg)', 'var(--tag-success-fg)'],
  accent: ['var(--tag-spot-bg)', 'var(--tag-spot-fg)'],
  neutral: ['var(--tag-neutral-bg)', 'var(--tag-neutral-fg)'],
  caution: ['var(--tag-warm-surface)', 'var(--tag-warm-fg)'],
};

export default function PillTag({ label, color = 'neutral' }) {
  const [bg, text] = STYLES[color] || STYLES.neutral;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 4,
        padding: '2px 8px',
        fontSize: '11px',
        lineHeight: 1.2,
        fontWeight: 500,
        background: bg,
        color: text,
      }}
    >
      {label}
    </span>
  );
}
