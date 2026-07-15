import type { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return isActive ? 'text-ink text-sm font-medium' : 'text-ink-muted hover:text-ink text-sm transition-colors'
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout(): void {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen">
      <header className="border-border bg-surface sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="text-ink text-lg font-medium tracking-tight">Fragrance Lab</span>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <NavLink to="/" end className={navLinkClass}>
              Dashboard
            </NavLink>
            <NavLink to="/ingredients" className={navLinkClass}>
              Ingredients
            </NavLink>
            <NavLink to="/recipes" className={navLinkClass}>
              Recipes
            </NavLink>
            <NavLink to="/batches" className={navLinkClass}>
              Batches
            </NavLink>
          </nav>
        </div>
        {user && (
          <div className="flex items-center gap-4">
            <span className="text-ink-muted text-sm">{user.username}</span>
            <button
              type="button"
              onClick={handleLogout}
              className="text-ink-muted hover:text-ink border-border hover:border-ink-muted rounded-field border px-3 py-1.5 text-sm transition-colors"
            >
              Log out
            </button>
          </div>
        )}
      </header>
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">{children}</main>
    </div>
  )
}
