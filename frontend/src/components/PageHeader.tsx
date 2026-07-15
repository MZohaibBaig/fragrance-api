import type { ReactNode } from 'react'

export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-ink text-2xl font-medium tracking-tight">{title}</h1>
      {action}
    </div>
  )
}
