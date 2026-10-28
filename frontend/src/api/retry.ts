import { isCancel, type AxiosError, type InternalAxiosRequestConfig } from 'axios'

// The Railway backend sleeps when idle, so the first request after a pause can hit a
// network error or a 502 from the edge proxy while the container boots. Retry only
// those two cases, and only for a bounded window.
export const RETRY_WINDOW_MS = 30_000
const BASE_DELAY_MS = 500
const MAX_DELAY_MS = 4_000

export interface RetryState {
  _retryStartedAt?: number
  _retryAttempt?: number
}

export type RetryableConfig = InternalAxiosRequestConfig & RetryState

export function isTransientError(error: AxiosError): boolean {
  if (isCancel(error)) {
    return false
  }
  if (error.response) {
    return error.response.status === 502
  }
  // No response: a network-level failure, provided the request was actually sent.
  return Boolean(error.request)
}

// 500ms, 1s, 2s, 4s, then 4s again.
export function backoffDelayMs(attempt: number): number {
  return Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS)
}

// Returns how long to wait before retrying, or null when the error is not transient or
// the retry window is used up. Records retry progress on the request config.
export function nextRetryDelayMs(
  error: AxiosError,
  config: RetryState,
  now: number = Date.now(),
): number | null {
  if (!isTransientError(error)) {
    return null
  }
  const startedAt = config._retryStartedAt ?? now
  const attempt = config._retryAttempt ?? 0
  const delay = backoffDelayMs(attempt)
  if (now + delay - startedAt > RETRY_WINDOW_MS) {
    return null
  }
  config._retryStartedAt = startedAt
  config._retryAttempt = attempt + 1
  return delay
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
