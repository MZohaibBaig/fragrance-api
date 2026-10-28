import { useSyncExternalStore } from 'react'

// Tracks in-flight API requests so the UI can tell the user the server is waking up
// when one takes longer than SLOW_REQUEST_MS.
export const SLOW_REQUEST_MS = 3_000

const timers = new Map<number, ReturnType<typeof setTimeout>>()
const slowIds = new Set<number>()
const listeners = new Set<() => void>()
let nextId = 1
let snapshot = false

function emit(): void {
  const next = slowIds.size > 0
  if (next === snapshot) {
    return
  }
  snapshot = next
  listeners.forEach((listener) => listener())
}

export function trackRequest(): number {
  const id = nextId++
  timers.set(
    id,
    setTimeout(() => {
      timers.delete(id)
      slowIds.add(id)
      emit()
    }, SLOW_REQUEST_MS),
  )
  return id
}

// Safe to call more than once for the same id.
export function untrackRequest(id: number | undefined): void {
  if (id === undefined) {
    return
  }
  const timer = timers.get(id)
  if (timer !== undefined) {
    clearTimeout(timer)
    timers.delete(id)
  }
  if (slowIds.delete(id)) {
    emit()
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useSlowRequest(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => false,
  )
}
