import { useAuth } from '../context/AuthContext'

export function DashboardPage() {
  const { user } = useAuth()

  return (
    <div>
      <h1 className="text-ink text-2xl font-medium tracking-tight">Welcome, {user?.username}</h1>
      <p className="text-ink-muted mt-2 text-sm">Recipes and batches land in the next chunk.</p>
    </div>
  )
}
