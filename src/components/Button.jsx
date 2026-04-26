export default function Button({
  children,
  variant = 'primary',
  type = 'button',
  className = '',
  ...props
}) {
  const base =
    'inline-flex items-center justify-center rounded-md px-[14px] py-[7px] text-[13px] font-medium transition';
  const variants = {
    primary: 'bg-[#111827] text-paper hover:bg-[#0b1220]',
    secondary: 'border border-[#E5E7EB] bg-paper text-[#374151] hover:bg-[#F9FAFB]',
    ghost: 'bg-transparent text-[#5B4ED4] hover:bg-[#EEE9FF]',
  };
  return (
    <button type={type} className={`${base} ${variants[variant] || variants.primary} ${className}`} {...props}>
      {children}
    </button>
  );
}
