export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="text-ink-muted flex items-center gap-2 py-8 text-sm" role="status">
      <span className="border-border border-t-accent size-4 animate-spin rounded-full border-2" />
      {label}
    </div>
  )
}
