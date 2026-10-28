import axios, { AxiosError } from 'axios'
import { clearTokens, getTokens, setAccessToken } from './tokenStorage'
import { nextRetryDelayMs, sleep, type RetryableConfig } from './retry'
import { trackRequest, untrackRequest } from './slowRequest'

const baseURL = import.meta.env.VITE_API_URL

export const apiClient = axios.create({ baseURL })

type TrackedConfig = RetryableConfig & { _retry?: boolean; _trackId?: number }

apiClient.interceptors.request.use((config: TrackedConfig) => {
  const { access } = getTokens()
  if (access) {
    config.headers.Authorization = `Bearer ${access}`
  }
  // Retried and replayed requests keep their id so a logical request is tracked once.
  config._trackId ??= trackRequest()
  return config
})

// Concurrent 401s share a single in-flight refresh instead of each firing
// their own /token/refresh/ request.
let refreshPromise: Promise<string> | null = null

async function refreshAccessToken(): Promise<string> {
  const { refresh } = getTokens()
  if (!refresh) {
    throw new Error('No refresh token available')
  }
  const { data } = await axios.post<{ access: string }>(`${baseURL}/token/refresh/`, { refresh })
  setAccessToken(data.access)
  return data.access
}

async function refreshAndReplay(error: AxiosError): Promise<unknown> {
  const originalRequest = error.config as TrackedConfig | undefined

  if (error.response?.status !== 401 || !originalRequest || originalRequest._retry) {
    return Promise.reject(error)
  }
  originalRequest._retry = true

  let newAccess: string
  try {
    refreshPromise ??= refreshAccessToken().finally(() => {
      refreshPromise = null
    })
    newAccess = await refreshPromise
  } catch {
    clearTokens()
    window.location.assign('/login')
    return Promise.reject(error)
  }

  // A failed replay is the caller's error, not a reason to sign the user out.
  originalRequest.headers.set('Authorization', `Bearer ${newAccess}`)
  return apiClient(originalRequest)
}

apiClient.interceptors.response.use(
  (response) => {
    untrackRequest((response.config as TrackedConfig)._trackId)
    return response
  },
  async (error: AxiosError) => {
    const config = error.config as TrackedConfig | undefined

    // Transient failures (network error / 502 while the backend wakes) are retried with
    // backoff; everything else falls through to the 401 refresh handling below.
    const delay = config ? nextRetryDelayMs(error, config) : null
    if (config && delay !== null) {
      await sleep(delay)
      return apiClient(config)
    }

    try {
      return await refreshAndReplay(error)
    } finally {
      untrackRequest(config?._trackId)
    }
  },
)
