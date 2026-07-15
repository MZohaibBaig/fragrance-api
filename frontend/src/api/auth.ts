import { apiClient } from './client'
import { setStoredUser, setTokens, clearTokens } from './tokenStorage'

export {
  getTokens,
  getStoredUser,
  isAuthenticated,
} from './tokenStorage'
export type { StoredUser } from './tokenStorage'

interface TokenPair {
  access: string
  refresh: string
}

export async function login(username: string, password: string): Promise<void> {
  const { data } = await apiClient.post<TokenPair>('/token/', { username, password })
  setTokens(data)
  setStoredUser({ username })
}

export function logout(): void {
  clearTokens()
}
