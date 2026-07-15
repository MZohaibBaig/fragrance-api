import type { MouseEvent, ReactNode } from 'react'

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  function stopPropagation(event: MouseEvent): void {
    event.stopPropagation()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}
    >
      <div
        className="border-border bg-surface-raised rounded-card shadow-card w-full max-w-md border p-6"
        onClick={stopPropagation}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-ink text-lg font-medium tracking-tight">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-ink-muted hover:text-ink text-sm"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
