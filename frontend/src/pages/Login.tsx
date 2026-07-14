import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { parseApiError, type FieldErrors } from '../api/errors'

interface LocationState {
  from?: { pathname: string }
}

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)

  const redirectTo = (location.state as LocationState | null)?.from?.pathname ?? '/'

  const mutation = useMutation({
    mutationFn: () => login(username, password),
    onSuccess: () => {
      navigate(redirectTo, { replace: true })
    },
    onError: (error) => {
      const parsed = parseApiError(error)
      setFieldErrors(parsed.fieldErrors ?? {})
      setFormError(parsed.detail)
    },
  })

  function handleSubmit(event: FormEvent): void {
    event.preventDefault()
    setFieldErrors({})
    setFormError(null)
    mutation.mutate()
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="border-border bg-surface-raised w-full max-w-sm rounded-lg border p-8">
        <h1 className="text-ink mb-6 text-xl font-medium tracking-tight">Fragrance Lab</h1>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <div>
            <label htmlFor="username" className="text-ink-muted mb-1 block text-sm">
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="border-border bg-surface text-ink focus:border-accent w-full rounded-md border px-3 py-2 text-sm outline-none"
            />
            {fieldErrors.username && (
              <p className="text-danger mt-1 text-sm">{fieldErrors.username.join(' ')}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="text-ink-muted mb-1 block text-sm">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border-border bg-surface text-ink focus:border-accent w-full rounded-md border px-3 py-2 text-sm outline-none"
            />
            {fieldErrors.password && (
              <p className="text-danger mt-1 text-sm">{fieldErrors.password.join(' ')}</p>
            )}
          </div>

          {formError && <p className="text-danger text-sm">{formError}</p>}

          <button
            type="submit"
            disabled={mutation.isPending}
            className="bg-accent text-accent-ink mt-2 rounded-md px-3 py-2 text-sm font-medium transition-opacity disabled:opacity-60"
          >
            {mutation.isPending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
