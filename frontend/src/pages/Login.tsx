import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { parseApiError, type FieldErrors } from '../api/errors'
import { FieldError } from '../components/FieldError'
import { Card } from '../components/Card'
import { inputClass, labelClass, primaryButtonClass } from '../components/formStyles'

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
      <Card className="w-full max-w-sm p-8">
        <h1 className="text-ink mb-1 text-xl font-medium tracking-tight">Fragrance Lab</h1>
        <p className="text-ink-muted mb-6 text-sm">Sign in to manage your recipes and batches.</p>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <div>
            <label htmlFor="username" className={labelClass}>
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={inputClass}
            />
            <FieldError messages={fieldErrors.username} />
          </div>

          <div>
            <label htmlFor="password" className={labelClass}>
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
            <FieldError messages={fieldErrors.password} />
          </div>

          {formError && <p className="text-danger text-sm">{formError}</p>}

          <button type="submit" disabled={mutation.isPending} className={`${primaryButtonClass} mt-2`}>
            {mutation.isPending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </Card>
    </div>
  )
}
