import { useRef, useState, type FormEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getBatch, updateBatch, type Batch, type BatchNote, type BatchStatus } from '../api/batches'
import { getRecipe } from '../api/recipes'
import { createBatchNote, updateBatchNote, deleteBatchNote } from '../api/batchNotes'
import { parseApiError, formLevelError, type FieldErrors } from '../api/errors'
import { FieldError } from '../components/FieldError'
import { MacerationBar } from '../components/MacerationBar'
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from '../components/formStyles'

const STATUS_LABELS: Record<string, string> = {
  macerating: 'Macerating',
  ready: 'Ready',
  archived: 'Archived',
}

export function BatchDetailPage() {
  const { id } = useParams<{ id: string }>()
  return <BatchDetailInner key={id} batchId={Number(id)} />
}

function BatchDetailInner({ batchId }: { batchId: number }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const batchQuery = useQuery({ queryKey: ['batches', batchId], queryFn: () => getBatch(batchId) })
  const batch = batchQuery.data
  const recipeQuery = useQuery({
    queryKey: ['recipes', batch?.recipe],
    queryFn: () => getRecipe(batch!.recipe),
    enabled: !!batch,
  })

  function invalidateBatch(): void {
    queryClient.invalidateQueries({ queryKey: ['batches', batchId] })
    queryClient.invalidateQueries({ queryKey: ['batches'] })
  }

  if (batchQuery.isLoading) {
    return <p className="text-ink-muted text-sm">Loading…</p>
  }
  if (batchQuery.isError || !batch) {
    return <p className="text-danger text-sm">Couldn't load this batch.</p>
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate('/batches')}
        className="text-ink-muted hover:text-ink mb-4 text-sm"
      >
        ← Batches
      </button>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-ink text-2xl font-medium tracking-tight">
          {recipeQuery.data?.name ?? `Recipe #${batch.recipe}`}
        </h1>
        <span className="text-ink-muted text-sm">Made {batch.made_on}</span>
      </div>

      <SnapshotSection batch={batch} />
      <MacerationSection batch={batch} />
      <StatusRatingSection batch={batch} onSaved={invalidateBatch} />
      <NotesSection batch={batch} onChanged={invalidateBatch} />
    </div>
  )
}

function SnapshotSection({ batch }: { batch: Batch }) {
  return (
    <section className="border-border mb-6 rounded-lg border p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-ink text-lg font-medium">Snapshot</h2>
        {!batch.recipe_was_balanced && (
          <span className="text-danger text-sm">Recipe wasn't balanced when this batch was made</span>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-6">
        <div>
          <div className="text-ink-muted text-xs">Batch size</div>
          <div className="text-ink text-sm font-medium">{batch.batch_size_g}g</div>
        </div>
        <div>
          <div className="text-ink-muted text-xs">Concentration</div>
          <div className="text-ink text-sm font-medium">{batch.concentration}%</div>
        </div>
        <div>
          <div className="text-ink-muted text-xs">Aromatic</div>
          <div className="text-ink text-sm font-medium">{batch.aromatic_g}g</div>
        </div>
        <div>
          <div className="text-ink-muted text-xs">Diluent</div>
          <div className="text-ink text-sm font-medium">{batch.diluent_g}g</div>
        </div>
      </div>

      {batch.ingredients.length === 0 && <p className="text-ink-muted text-sm">No ingredients recorded.</p>}

      {batch.ingredients.length > 0 && (
        <ul className="flex flex-col gap-2">
          {batch.ingredients.map((bi) => (
            <li
              key={bi.id}
              className="border-border flex items-center justify-between rounded-md border px-3 py-2 text-sm"
            >
              <span className="text-ink">{bi.ingredient_name}</span>
              <span className="text-ink-muted">
                {bi.grams}g · {bi.proportion}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function MacerationSection({ batch }: { batch: Batch }) {
  const daysRemaining = batch.days_remaining
  const remainingLabel =
    daysRemaining < 0 ? `overdue by ${Math.abs(daysRemaining)}d` : `${daysRemaining}d remaining`

  return (
    <section className="border-border mb-6 rounded-lg border p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-ink text-lg font-medium">Maceration</h2>
        {batch.is_due && (
          <span className="text-danger border-danger rounded-full border px-2 py-0.5 text-xs">Due</span>
        )}
      </div>
      <MacerationBar progress={Number(batch.maceration_progress)} />
      <div className="text-ink-muted mt-2 flex justify-between text-xs">
        <span>
          Day {batch.days_macerating} of {batch.maceration_days}
        </span>
        <span className={daysRemaining < 0 ? 'text-danger' : ''}>{remainingLabel}</span>
      </div>
      <div className="text-ink-muted mt-2 text-xs">Ready on {batch.ready_on}</div>
    </section>
  )
}

function StatusRatingSection({ batch, onSaved }: { batch: Batch; onSaved: () => void }) {
  const [status, setStatus] = useState(batch.status ?? 'macerating')
  const [statusJustSaved, setStatusJustSaved] = useState(false)
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const statusMutation = useMutation({
    mutationFn: (value: BatchStatus) => updateBatch(batch.id, { status: value }),
    onSuccess: () => {
      onSaved()
      setStatusJustSaved(true)
      clearTimeout(statusTimeoutRef.current)
      statusTimeoutRef.current = setTimeout(() => setStatusJustSaved(false), 2000)
    },
  })

  function handleStatusChange(value: string): void {
    const next = value as BatchStatus
    setStatus(next)
    statusMutation.mutate(next)
  }

  const [rating, setRating] = useState(batch.rating != null ? String(batch.rating) : '')
  const [ratingJustSaved, setRatingJustSaved] = useState(false)
  const ratingTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const ratingMutation = useMutation({
    mutationFn: (value: number | null) => updateBatch(batch.id, { rating: value }),
    onSuccess: () => {
      onSaved()
      setRatingJustSaved(true)
      clearTimeout(ratingTimeoutRef.current)
      ratingTimeoutRef.current = setTimeout(() => setRatingJustSaved(false), 2000)
    },
  })

  function handleRatingSave(): void {
    ratingMutation.mutate(rating === '' ? null : Number(rating))
  }

  function handleRatingClear(): void {
    setRating('')
    ratingMutation.mutate(null)
  }

  return (
    <section className="border-border mb-6 rounded-lg border p-5">
      <h2 className="text-ink mb-4 text-lg font-medium">Status &amp; rating</h2>
      <div className="flex flex-wrap items-end gap-6">
        <div className="w-44">
          <label htmlFor="batch-status" className={labelClass}>
            Status
          </label>
          <select
            id="batch-status"
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
            disabled={statusMutation.isPending}
            className={inputClass}
          >
            <option value="macerating">{STATUS_LABELS.macerating}</option>
            <option value="ready">{STATUS_LABELS.ready}</option>
            <option value="archived">{STATUS_LABELS.archived}</option>
          </select>
          {statusMutation.isPending && <span className="text-ink-muted text-xs">Saving…</span>}
          {statusJustSaved && <span className="text-ink-muted text-xs">Saved</span>}
          {statusMutation.isError && <p className="text-danger mt-1 text-xs">Couldn't update status.</p>}
        </div>

        <div className="w-32">
          <label htmlFor="batch-rating" className={labelClass}>
            Rating (1-10)
          </label>
          <input
            id="batch-rating"
            type="number"
            min={1}
            max={10}
            value={rating}
            onChange={(e) => setRating(e.target.value)}
            className={inputClass}
          />
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={handleRatingSave}
              disabled={ratingMutation.isPending}
              className={primaryButtonClass}
            >
              {ratingMutation.isPending ? 'Saving…' : 'Save'}
            </button>
            {rating !== '' && (
              <button type="button" onClick={handleRatingClear} className={secondaryButtonClass}>
                Clear
              </button>
            )}
            {ratingJustSaved && <span className="text-ink-muted text-xs">Saved</span>}
          </div>
          {ratingMutation.isError && <p className="text-danger mt-1 text-xs">Couldn't update rating.</p>}
        </div>
      </div>
    </section>
  )
}

function NotesSection({ batch, onChanged }: { batch: Batch; onChanged: () => void }) {
  const queryClient = useQueryClient()
  const notes = [...batch.notes].sort((a, b) => a.observed_on.localeCompare(b.observed_on))

  const [observedOn, setObservedOn] = useState(() => new Date().toISOString().slice(0, 10))
  const [body, setBody] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)

  const addMutation = useMutation({
    mutationFn: () => createBatchNote({ batch: batch.id, observed_on: observedOn, body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches', batch.id] })
      setBody('')
      setFieldErrors({})
      setFormError(null)
    },
    onError: (error) => {
      const parsed = parseApiError(error)
      setFieldErrors(parsed.fieldErrors ?? {})
      setFormError(formLevelError(parsed))
    },
  })

  function handleAddNote(event: FormEvent): void {
    event.preventDefault()
    setFieldErrors({})
    setFormError(null)
    addMutation.mutate()
  }

  return (
    <section className="border-border rounded-lg border p-5">
      <h2 className="text-ink mb-4 text-lg font-medium">Notes</h2>

      {notes.length === 0 && <p className="text-ink-muted mb-4 text-sm">No notes yet.</p>}

      {notes.length > 0 && (
        <ul className="mb-4 flex flex-col gap-3">
          {notes.map((note) => (
            <NoteItem key={note.id} note={note} onChanged={onChanged} />
          ))}
        </ul>
      )}

      <form onSubmit={handleAddNote} noValidate className="flex flex-wrap items-end gap-3">
        <div className="w-40">
          <label htmlFor="note-observed-on" className={labelClass}>
            Observed on
          </label>
          <input
            id="note-observed-on"
            type="date"
            value={observedOn}
            onChange={(e) => setObservedOn(e.target.value)}
            className={inputClass}
          />
          <FieldError messages={fieldErrors.observed_on} />
        </div>
        <div className="min-w-60 flex-1">
          <label htmlFor="note-body" className={labelClass}>
            Note
          </label>
          <input id="note-body" value={body} onChange={(e) => setBody(e.target.value)} className={inputClass} />
          <FieldError messages={fieldErrors.body} />
        </div>
        <button type="submit" disabled={addMutation.isPending || !body} className={primaryButtonClass}>
          {addMutation.isPending ? 'Adding…' : 'Add note'}
        </button>
      </form>
      {formError && <p className="text-danger mt-2 text-sm">{formError}</p>}
    </section>
  )
}

function NoteItem({ note, onChanged }: { note: BatchNote; onChanged: () => void }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [observedOn, setObservedOn] = useState(note.observed_on)
  const [body, setBody] = useState(note.body)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const editMutation = useMutation({
    mutationFn: () => updateBatchNote(note.id, { observed_on: observedOn, body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches', note.batch] })
      setEditing(false)
      setFieldErrors({})
      setFormError(null)
    },
    onError: (error) => {
      const parsed = parseApiError(error)
      setFieldErrors(parsed.fieldErrors ?? {})
      setFormError(formLevelError(parsed))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteBatchNote(note.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches', note.batch] })
      onChanged()
    },
  })

  function handleSaveEdit(event: FormEvent): void {
    event.preventDefault()
    setFieldErrors({})
    setFormError(null)
    editMutation.mutate()
  }

  function handleDeleteClick(): void {
    if (confirmingDelete) {
      deleteMutation.mutate()
    } else {
      setConfirmingDelete(true)
    }
  }

  if (editing) {
    return (
      <li className="border-border rounded-md border px-3 py-2 text-sm">
        <form onSubmit={handleSaveEdit} noValidate className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <label htmlFor={`note-${note.id}-observed-on`} className={labelClass}>
              Observed on
            </label>
            <input
              id={`note-${note.id}-observed-on`}
              type="date"
              value={observedOn}
              onChange={(e) => setObservedOn(e.target.value)}
              className={inputClass}
            />
            <FieldError messages={fieldErrors.observed_on} />
          </div>
          <div className="min-w-60 flex-1">
            <label htmlFor={`note-${note.id}-body`} className={labelClass}>
              Note
            </label>
            <input
              id={`note-${note.id}-body`}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className={inputClass}
            />
            <FieldError messages={fieldErrors.body} />
          </div>
          <button type="submit" disabled={editMutation.isPending} className={primaryButtonClass}>
            {editMutation.isPending ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false)
              setObservedOn(note.observed_on)
              setBody(note.body)
              setFieldErrors({})
              setFormError(null)
            }}
            className={secondaryButtonClass}
          >
            Cancel
          </button>
        </form>
        {formError && <p className="text-danger mt-2 text-sm">{formError}</p>}
      </li>
    )
  }

  return (
    <li className="border-border rounded-md border px-3 py-2 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-ink-muted text-xs">
            Day {note.day_number} — {note.observed_on}
          </div>
          <div className="text-ink">{note.body}</div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <button type="button" onClick={() => setEditing(true)} className="text-ink-muted hover:text-ink text-xs">
            Edit
          </button>
          <button type="button" onClick={handleDeleteClick} disabled={deleteMutation.isPending} className="text-danger text-xs">
            {confirmingDelete ? 'Confirm?' : 'Delete'}
          </button>
        </div>
      </div>
      {deleteMutation.isError && <p className="text-danger mt-1 text-xs">Couldn't delete this note.</p>}
    </li>
  )
}
