import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { listBatches, type Batch, type BatchListParams } from '../api/batches'
import { listRecipes } from '../api/recipes'
import { MacerationBar } from '../components/MacerationBar'
import { PageHeader } from '../components/PageHeader'
import { Card } from '../components/Card'
import { EmptyState } from '../components/EmptyState'
import { Spinner } from '../components/Spinner'
import { BatchStatusChip, DueChip } from '../components/StatusChip'
import { inputClass, labelClass, primaryButtonClass } from '../components/formStyles'

export function BatchesPage() {
  const [status, setStatus] = useState('')
  const [isDueOnly, setIsDueOnly] = useState(false)

  const params: BatchListParams = {}
  if (status) params.status = status
  if (isDueOnly) params.is_due = true

  const { data: batches, isLoading, isError } = useQuery({
    queryKey: ['batches', params],
    queryFn: () => listBatches(params),
  })
  const { data: recipes } = useQuery({ queryKey: ['recipes'], queryFn: listRecipes })
  const recipeNames = new Map((recipes ?? []).map((r) => [r.id, r.name]))

  return (
    <div>
      <PageHeader
        title="Batches"
        action={
          <Link to="/batches/new" className={primaryButtonClass}>
            New batch
          </Link>
        }
      />

      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div className="w-44">
          <label htmlFor="batch-status" className={labelClass}>
            Status
          </label>
          <select
            id="batch-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={inputClass}
          >
            <option value="">All</option>
            <option value="macerating">Macerating</option>
            <option value="ready">Ready</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <label className="text-ink-muted flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" checked={isDueOnly} onChange={(e) => setIsDueOnly(e.target.checked)} />
          Due only
        </label>
      </div>

      {isLoading && <Spinner />}
      {isError && <p className="text-danger text-sm">Couldn't load batches.</p>}
      {batches && batches.length === 0 && (
        <EmptyState
          message="No batches yet — mix your first one."
          action={
            <Link to="/batches/new" className={primaryButtonClass}>
              New batch
            </Link>
          }
        />
      )}

      {batches && batches.length > 0 && (
        <ul className="flex flex-col gap-3">
          {batches.map((batch) => (
            <li key={batch.id}>
              <BatchCard batch={batch} recipeName={recipeNames.get(batch.recipe) ?? `Recipe #${batch.recipe}`} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function BatchCard({ batch, recipeName }: { batch: Batch; recipeName: string }) {
  const status = batch.status ?? 'macerating'
  const daysRemaining = batch.days_remaining
  const remainingLabel =
    daysRemaining < 0 ? `overdue by ${Math.abs(daysRemaining)}d` : `${daysRemaining}d remaining`

  return (
    <Card className="px-4 py-3">
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
  )
}
