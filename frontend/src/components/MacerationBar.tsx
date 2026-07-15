export function MacerationBar({ progress }: { progress: number }) {
  const pct = Math.min(100, Math.max(0, progress))
  return (
    <div className="bg-surface border-border h-1.5 w-full overflow-hidden rounded-full border">
      <div className="bg-accent h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
    </div>
  )
}
