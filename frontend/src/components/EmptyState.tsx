import type { ReactNode } from 'react'

export function EmptyState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="border-border rounded-card flex flex-col items-center gap-3 border border-dashed px-6 py-12 text-center">
      <p className="text-ink-muted text-sm">{message}</p>
      {action}
    </div>
  )
}
