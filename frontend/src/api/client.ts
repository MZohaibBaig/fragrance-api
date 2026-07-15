import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { clearTokens, getTokens, setAccessToken } from './tokenStorage'

const baseURL = import.meta.env.VITE_API_URL

export const apiClient = axios.create({ baseURL })

apiClient.interceptors.request.use((config) => {
  const { access } = getTokens()
  if (access) {
    config.headers.Authorization = `Bearer ${access}`
  }
  return config
})

type RetryableConfig = InternalAxiosRequestConfig & { _retry?: boolean }

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

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableConfig | undefined

    if (error.response?.status !== 401 || !originalRequest || originalRequest._retry) {
      return Promise.reject(error)
    }
    originalRequest._retry = true

    try {
      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null
      })
      const newAccess = await refreshPromise

      originalRequest.headers.set('Authorization', `Bearer ${newAccess}`)
      return apiClient(originalRequest)
    } catch {
      clearTokens()
      window.location.assign('/login')
      return Promise.reject(error)
    }
  },
)
