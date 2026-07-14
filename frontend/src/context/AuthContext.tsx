import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import * as authApi from '../api/auth'
import type { StoredUser } from '../api/auth'

interface AuthContextValue {
  user: StoredUser | null
  isLoading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StoredUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (authApi.isAuthenticated()) {
      setUser(authApi.getStoredUser())
    }
    setIsLoading(false)
  }, [])

  async function login(username: string, password: string): Promise<void> {
    await authApi.login(username, password)
    setUser({ username })
  }

  function logout(): void {
    authApi.logout()
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, isLoading, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
