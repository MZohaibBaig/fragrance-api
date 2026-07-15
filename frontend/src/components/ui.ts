export const cardClass = 'border-border bg-surface-raised rounded-card border shadow-card'

export const tableWrapClass = 'overflow-x-auto rounded-card border border-border'

export const tableClass = 'w-full min-w-[640px] text-left text-sm'

export const tableHeadRowClass = 'border-border text-ink-muted border-b'

export const tableHeadCellClass = 'py-2 pr-4 font-normal whitespace-nowrap'

export const tableRowClass = 'border-border border-b last:border-0'

export const tableCellClass = 'py-2 pr-4'

export const linkClass = 'text-ink-muted hover:text-ink text-sm transition-colors'

type ChipTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'

const chipToneClasses: Record<ChipTone, string> = {
  neutral: 'text-ink-muted border-border',
  accent: 'text-accent border-accent',
  success: 'text-success border-success',
  warning: 'text-warning border-warning',
  danger: 'text-danger border-danger',
}

export function chipClass(tone: ChipTone): string {
  return `rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${chipToneClasses[tone]}`
}
