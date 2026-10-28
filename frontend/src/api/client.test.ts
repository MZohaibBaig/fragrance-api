import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { apiClient } from './client'
import { RETRY_WINDOW_MS, backoffDelayMs } from './retry'
import { getApiOrigin } from './wake'

type Step = number | 'network-error'

// Replaces the HTTP layer: each call consumes the next scripted step (the last repeats).
function scriptAdapter(steps: Step[]) {
  let call = 0
  const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
    const step = steps[Math.min(call++, steps.length - 1)]
    if (step === 'network-error') {
      throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config, {})
    }
    const response = { data: { step }, status: step, statusText: '', headers: {}, config }
    if (step >= 400) {
      throw new AxiosError(`HTTP ${step}`, AxiosError.ERR_BAD_RESPONSE, config, {}, response)
    }
    return response
  })
  apiClient.defaults.adapter = adapter as AxiosAdapter
  return adapter
}

// Lets a request settle while fake timers drive the retry sleeps.
async function settle(promise: Promise<unknown>, advanceMs: number) {
  const outcome = promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  )
  await vi.advanceTimersByTimeAsync(advanceMs)
  return outcome
}

describe('apiClient transient retry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('retries a 502 and succeeds when the next response is 200', async () => {
    const adapter = scriptAdapter([502, 200])

    const result = await settle(apiClient.get('/health/'), 5_000)

    expect(result.ok).toBe(true)
    expect(adapter).toHaveBeenCalledTimes(2)
  })

  it('retries a network error and succeeds', async () => {
    const adapter = scriptAdapter(['network-error', 'network-error', 200])

    const result = await settle(apiClient.get('/health/'), 5_000)

    expect(result.ok).toBe(true)
    expect(adapter).toHaveBeenCalledTimes(3)
  })

  it('does not retry a 500', async () => {
    const adapter = scriptAdapter([500, 200])

    const result = await settle(apiClient.get('/health/'), 5_000)

    expect(result.ok).toBe(false)
    expect(adapter).toHaveBeenCalledTimes(1)
  })

  it('does not retry a 400', async () => {
    const adapter = scriptAdapter([400, 200])

    const result = await settle(apiClient.post('/token/', {}), 5_000)

    expect(result.ok).toBe(false)
    expect(adapter).toHaveBeenCalledTimes(1)
  })

  it('gives up once the 30 s window is used up', async () => {
    const adapter = scriptAdapter([502])

    const result = await settle(apiClient.get('/health/'), RETRY_WINDOW_MS + 10_000)

    expect(result.ok).toBe(false)
    // 0.5 + 1 + 2 + 4 s then 4 s steps: bounded, never an endless loop.
    expect(adapter.mock.calls.length).toBeGreaterThan(3)
    expect(adapter.mock.calls.length).toBeLessThanOrEqual(12)
  })
})

describe('backoffDelayMs', () => {
  it('doubles from 500 ms and caps at 4 s', () => {
    expect([0, 1, 2, 3, 4, 10].map(backoffDelayMs)).toEqual([500, 1000, 2000, 4000, 4000, 4000])
  })
})

describe('getApiOrigin', () => {
  it('strips the /api path from an absolute URL', () => {
    expect(getApiOrigin('https://example.up.railway.app/api')).toBe('https://example.up.railway.app')
  })

  it('resolves a relative URL against the page origin', () => {
    expect(getApiOrigin('/api', 'https://app.example.com')).toBe('https://app.example.com')
  })

  it('returns null when unset or unresolvable', () => {
    expect(getApiOrigin('', 'https://app.example.com')).toBeNull()
    expect(getApiOrigin('/api', undefined)).toBeNull()
  })
})
