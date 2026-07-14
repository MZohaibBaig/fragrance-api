const ACCESS_KEY = 'fragrance_access_token'
const REFRESH_KEY = 'fragrance_refresh_token'
const USERNAME_KEY = 'fragrance_username'

export interface Tokens {
  access: string | null
  refresh: string | null
}

export interface StoredUser {
  username: string
}

export function getTokens(): Tokens {
  return {
    access: localStorage.getItem(ACCESS_KEY),
    refresh: localStorage.getItem(REFRESH_KEY),
  }
}

export function setTokens(tokens: { access: string; refresh: string }): void {
  localStorage.setItem(ACCESS_KEY, tokens.access)
  localStorage.setItem(REFRESH_KEY, tokens.refresh)
}

export function setAccessToken(access: string): void {
  localStorage.setItem(ACCESS_KEY, access)
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
  localStorage.removeItem(USERNAME_KEY)
}

// The API has no "current user" endpoint, so the username is captured from
// the login form at sign-in time and persisted alongside the tokens.
export function getStoredUser(): StoredUser | null {
  const username = localStorage.getItem(USERNAME_KEY)
  return username ? { username } : null
}

export function setStoredUser(user: StoredUser): void {
  localStorage.setItem(USERNAME_KEY, user.username)
}

export function isAuthenticated(): boolean {
  return Boolean(getTokens().access)
}
