import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createBatch } from '../api/batches'
import { listRecipes } from '../api/recipes'
import { computeBatchPreview } from '../lib/batchMath'
import { parseApiError, formLevelError, type FieldErrors } from '../api/errors'
import { FieldError } from '../components/FieldError'
import { Card } from '../components/Card'
import { Spinner } from '../components/Spinner'
import { ghostButtonClass, inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from '../components/formStyles'

export function BatchNewPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: recipes, isLoading, isError } = useQuery({ queryKey: ['recipes'], queryFn: listRecipes })

  const [recipeId, setRecipeId] = useState('')
  const [batchSizeG, setBatchSizeG] = useState('')
  const [concentration, setConcentration] = useState('')
  const [macerationDays, setMacerationDays] = useState('')
  const [madeOn, setMadeOn] = useState(() => new Date().toISOString().slice(0, 10))
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)

  const recipe = (recipes ?? []).find((r) => r.id === Number(recipeId)) ?? null

  function handleRecipeChange(value: string): void {
    setRecipeId(value)
    const selected = (recipes ?? []).find((r) => r.id === Number(value))
    if (selected) {
      setConcentration(selected.default_concentration)
      setMacerationDays(String(selected.default_maceration_days ?? ''))
    }
  }

  const preview = recipe
    ? computeBatchPreview(recipe.recipe_ingredients, Number(batchSizeG), Number(concentration))
    : null

  const createMutation = useMutation({
    mutationFn: () =>
      createBatch({
        recipe: Number(recipeId),
        batch_size_g: batchSizeG,
        concentration: concentration || undefined,
        maceration_days: macerationDays ? Number(macerationDays) : undefined,
        made_on: madeOn,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] })
      navigate('/batches')
    },
    onError: (error) => {
      const parsed = parseApiError(error)
      setFieldErrors(parsed.fieldErrors ?? {})
      setFormError(formLevelError(parsed))
    },
  })

  function handleSubmit(event: FormEvent): void {
    event.preventDefault()
    setFieldErrors({})
    setFormError(null)
    createMutation.mutate()
  }

  return (
    <div>
      <button type="button" onClick={() => navigate('/batches')} className={`${ghostButtonClass} mb-4`}>
        ← Batches
      </button>

      <h1 className="text-ink mb-6 text-2xl font-medium tracking-tight">New batch</h1>

      {isLoading && <Spinner />}
      {isError && <p className="text-danger text-sm">Couldn't load recipes.</p>}

      {recipes && (
        <Card className="p-5">
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <div>
              <label htmlFor="batch-recipe" className={labelClass}>
                Recipe
              </label>
              <select
                id="batch-recipe"
                value={recipeId}
                onChange={(e) => handleRecipeChange(e.target.value)}
                className={inputClass}
              >
                <option value="">Select…</option>
                {recipes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <FieldError messages={fieldErrors.recipe} />
            </div>

            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="flex-1">
                <label htmlFor="batch-size" className={labelClass}>
                  Batch size (g)
                </label>
                <input
                  id="batch-size"
                  value={batchSizeG}
                  onChange={(e) => setBatchSizeG(e.target.value)}
                  className={inputClass}
                />
                <FieldError messages={fieldErrors.batch_size_g} />
              </div>
              <div className="flex-1">
                <label htmlFor="batch-concentration" className={labelClass}>
                  Concentration (%)
                </label>
                <input
                  id="batch-concentration"
                  value={concentration}
                  onChange={(e) => setConcentration(e.target.value)}
                  className={inputClass}
                />
                <FieldError messages={fieldErrors.concentration} />
              </div>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="flex-1">
                <label htmlFor="batch-made-on" className={labelClass}>
                  Made on
                </label>
                <input
                  id="batch-made-on"
                  type="date"
                  value={madeOn}
                  onChange={(e) => setMadeOn(e.target.value)}
                  className={inputClass}
                />
                <FieldError messages={fieldErrors.made_on} />
              </div>
              <div className="flex-1">
                <label htmlFor="batch-maceration-days" className={labelClass}>
                  Maceration days
                </label>
                <input
                  id="batch-maceration-days"
                  value={macerationDays}
                  onChange={(e) => setMacerationDays(e.target.value)}
                  className={inputClass}
                />
                <FieldError messages={fieldErrors.maceration_days} />
              </div>
            </div>

            {formError && <p className="text-danger text-sm">{formError}</p>}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={createMutation.isPending || !recipeId || !batchSizeG}
                className={primaryButtonClass}
              >
                {createMutation.isPending ? 'Creating…' : 'Create batch'}
              </button>
              <button type="button" onClick={() => navigate('/batches')} className={secondaryButtonClass}>
                Cancel
              </button>
            </div>
          </form>
        </Card>
      )}

      {recipe && preview && (
        <Card className="mt-8 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-ink text-lg font-medium">Preview</h2>
            <span className="text-ink-muted text-xs">Server-computed values are frozen on save</span>
          </div>

          {!recipe.is_balanced && (
            <p className="text-danger mb-4 text-sm">
              This recipe's proportions total {recipe.proportions_total}%, not 100 — the preview below won't sum
              cleanly.
            </p>
          )}

          <div className="mb-4 flex gap-6">
            <div>
              <div className="text-ink-muted text-xs">Aromatic</div>
              <div className="text-ink text-sm font-medium">{preview.aromaticG.toFixed(2)}g</div>
            </div>
            <div>
              <div className="text-ink-muted text-xs">Diluent ({recipe.diluent_name})</div>
              <div className="text-ink text-sm font-medium">{preview.diluentG.toFixed(2)}g</div>
            </div>
          </div>

          {preview.ingredients.length === 0 && (
            <p className="text-ink-muted text-sm">This recipe has no ingredients yet.</p>
          )}

          {preview.ingredients.length > 0 && (
            <ul className="flex flex-col gap-2">
              {preview.ingredients.map((ing) => (
                <li
                  key={ing.ingredientId}
                  className="border-border rounded-field flex items-center justify-between border px-3 py-2 text-sm"
                >
                  <span className="text-ink">{ing.ingredientName}</span>
                  <span className="text-ink-muted">{ing.grams.toFixed(2)}g</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  )
}
