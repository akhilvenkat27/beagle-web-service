export default function LoadingScreen({
  title = 'Getting things ready',
  subtitle = 'This should only take a moment.',
  fullHeight = true,
  compact = false,
}) {
  return (
    <div
      className={`flex items-center justify-center bg-paper ${fullHeight ? 'min-h-[42vh]' : ''} ${
        compact ? 'py-6' : 'py-10'
      }`}
    >
      <div className="text-center">
        <div className="mx-auto mb-3 flex items-center justify-center">
          <span className="relative inline-flex h-10 w-10 items-center justify-center">
            <span className="absolute h-10 w-10 animate-spin rounded-full border-2 border-ink-200 border-t-focus-600" />
            <span className="h-2 w-2 rounded-full bg-focus-600" />
          </span>
        </div>
        <p className="text-sm font-medium text-ink-700">{title}</p>
        <p className="mt-1 text-xs text-ink-500">{subtitle}</p>
      </div>
    </div>
  );
}
