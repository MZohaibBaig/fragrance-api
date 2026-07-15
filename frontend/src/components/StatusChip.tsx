import { chipClass } from './ui'
import type { Batch } from '../api/batches'

const STATUS_LABELS: Record<string, string> = {
  macerating: 'Macerating',
  ready: 'Ready',
  archived: 'Archived',
}

export function BatchStatusChip({ status }: { status: Batch['status'] }) {
  const key = status ?? 'macerating'
  const tone = key === 'ready' ? 'success' : 'neutral'
  return <span className={chipClass(tone)}>{STATUS_LABELS[key] ?? key}</span>
}

export function DueChip() {
  return <span className={chipClass('danger')}>Due</span>
}

export function UnbalancedChip() {
  return <span className={chipClass('danger')}>Unbalanced</span>
}
