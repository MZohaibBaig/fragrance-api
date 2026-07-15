import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../api/client'
import type { components } from '../api/types'
import { useAuth } from '../context/AuthContext'
import { MacerationBar } from '../components/MacerationBar'
import { Card } from '../components/Card'
import { EmptyState } from '../components/EmptyState'
import { Spinner } from '../components/Spinner'
import { BatchStatusChip, DueChip } from '../components/StatusChip'
import { primaryButtonClass, secondaryButtonClass } from '../components/formStyles'

type Batch = components['schemas']['Batch']
type PaginatedBatchList = components['schemas']['PaginatedBatchList']
type PaginatedRecipeList = components['schemas']['PaginatedRecipeList']

async function fetchBatches(params?: Record<string, unknown>): Promise<PaginatedBatchList> {
  const { data } = await apiClient.get<PaginatedBatchList>('/batches/', { params })
  return data
}

async function fetchRecipes(): Promise<PaginatedRecipeList> {
  const { data } = await apiClient.get<PaginatedRecipeList>('/recipes/')
  return data
}

export function DashboardPage() {
  const { user } = useAuth()

  const dueQuery = useQuery({ queryKey: ['dashboard', 'batches', 'due'], queryFn: () => fetchBatches({ is_due: true }) })
  const recentQuery = useQuery({ queryKey: ['dashboard', 'batches', 'recent'], queryFn: () => fetchBatches() })
  const recipesQuery = useQuery({ queryKey: ['dashboard', 'recipes'], queryFn: fetchRecipes })

  const isLoading = dueQuery.isLoading || recentQuery.isLoading || recipesQuery.isLoading
  const isError = dueQuery.isError || recentQuery.isError || recipesQuery.isError

  const recipeNames = new Map((recipesQuery.data?.results ?? []).map((r) => [r.id, r.name]))

  const dueBatches = [...(dueQuery.data?.results ?? [])].sort((a, b) => a.days_remaining - b.days_remaining)
  const recentBatches = (recentQuery.data?.results ?? []).slice(0, 5)

  const isEmptyAccount =
    !isLoading && recipesQuery.data?.count === 0 && recentQuery.data?.count === 0

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-ink text-2xl font-medium tracking-tight">Welcome, {user?.username}</h1>
        <p className="text-ink-muted mt-1 text-sm">Here's what needs your attention today.</p>
      </div>

      {isLoading && <Spinner />}
      {isError && <p className="text-danger text-sm">Couldn't load your dashboard.</p>}

      {isEmptyAccount && (
        <EmptyState
          message="Nothing here yet — add ingredients, build a recipe, then mix your first batch."
          action={
            <div className="flex gap-3">
              <Link to="/recipes" className={primaryButtonClass}>
                New recipe
              </Link>
              <Link to="/batches/new" className={secondaryButtonClass}>
                New batch
              </Link>
            </div>
          }
        />
      )}

      {!isLoading && !isError && !isEmptyAccount && (
        <div className="flex flex-col gap-8">
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Recipes" value={recipesQuery.data?.count ?? 0} />
            <StatTile label="Batches" value={recentQuery.data?.count ?? 0} />
            <StatTile label="Due for evaluation" value={dueQuery.data?.count ?? 0} tone="danger" />
            <div className="col-span-2 flex flex-col justify-center gap-2 sm:col-span-1">
              <Link to="/batches/new" className={`${primaryButtonClass} text-center`}>
                New batch
              </Link>
              <Link to="/recipes" className={`${secondaryButtonClass} text-center`}>
                New recipe
              </Link>
            </div>
          </section>

          <section>
            <h2 className="text-ink mb-3 text-lg font-medium tracking-tight">Due for evaluation</h2>
            {dueBatches.length === 0 ? (
              <EmptyState message="Nothing due right now — check back once a batch finishes macerating." />
            ) : (
              <ul className="flex flex-col gap-3">
                {dueBatches.map((batch) => (
                  <li key={batch.id}>
                    <BatchRow
                      batch={batch}
                      recipeName={recipeNames.get(batch.recipe) ?? `Recipe #${batch.recipe}`}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="text-ink mb-3 text-lg font-medium tracking-tight">Recent batches</h2>
            {recentBatches.length === 0 ? (
              <EmptyState
                message="No batches yet — mix your first one."
                action={
                  <Link to="/batches/new" className={primaryButtonClass}>
                    New batch
                  </Link>
                }
              />
            ) : (
              <ul className="flex flex-col gap-3">
                {recentBatches.map((batch) => (
                  <li key={batch.id}>
                    <BatchRow
                      batch={batch}
                      recipeName={recipeNames.get(batch.recipe) ?? `Recipe #${batch.recipe}`}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

function StatTile({ label, value, tone = 'default' }: { label: string; value: number; tone?: 'default' | 'danger' }) {
  return (
    <Card className="p-4">
      <div className={`text-2xl font-medium tracking-tight ${tone === 'danger' && value > 0 ? 'text-danger' : 'text-ink'}`}>
        {value}
      </div>
      <div className="text-ink-muted text-xs">{label}</div>
    </Card>
  )
}

function BatchRow({ batch, recipeName }: { batch: Batch; recipeName: string }) {
  const status = batch.status ?? 'macerating'
  const daysRemaining = batch.days_remaining
  const remainingLabel =
    daysRemaining < 0 ? `overdue by ${Math.abs(daysRemaining)}d` : `${daysRemaining}d remaining`

  return (
    <Link to="/batches" className="block">
      <Card className="hover:border-ink-muted px-4 py-3 transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-ink text-sm font-medium">{recipeName}</div>
            <div className="text-ink-muted text-xs">
              {batch.batch_size_g}g · {batch.concentration}% · made {batch.made_on}
              {batch.rating != null && <> · rated {batch.rating}/10</>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {batch.is_due && <DueChip />}
            <BatchStatusChip status={status} />
          </div>
        </div>

        {status === 'macerating' && (
          <div className="mt-3">
            <MacerationBar progress={Number(batch.maceration_progress)} />
            <div className="text-ink-muted mt-1 flex justify-between text-xs">
              <span>
                Day {batch.days_macerating} of {batch.maceration_days}
              </span>
              <span className={daysRemaining < 0 ? 'text-danger' : ''}>{remainingLabel}</span>
            </div>
          </div>
        )}
      </Card>
    </Link>
  )
}
