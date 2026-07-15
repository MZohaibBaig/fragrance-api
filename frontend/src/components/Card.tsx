import type { ReactNode } from 'react'
import { cardClass } from './ui'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`${cardClass} ${className}`}>{children}</div>
}
