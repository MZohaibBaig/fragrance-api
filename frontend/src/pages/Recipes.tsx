import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createRecipe, listRecipes } from '../api/recipes'
import { parseApiError, formLevelError, type FieldErrors } from '../api/errors'
import { FieldError } from '../components/FieldError'
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from '../components/formStyles'

export function RecipesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: recipes, isLoading, isError } = useQuery({ queryKey: ['recipes'], queryFn: listRecipes })

  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [concentration, setConcentration] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: () => createRecipe({ name, default_concentration: concentration }),
    onSuccess: (recipe) => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] })
      navigate(`/recipes/${recipe.id}`)
    },
    onError: (error) => {
      const parsed = parseApiError(error)
      setFieldErrors(parsed.fieldErrors ?? {})
      setFormError(formLevelError(parsed))
    },
  })

  function handleCreate(event: FormEvent): void {
    event.preventDefault()
    setFieldErrors({})
    setFormError(null)
    createMutation.mutate()
  }

  function closeCreate(): void {
    setShowCreate(false)
    setName('')
    setConcentration('')
    setFieldErrors({})
    setFormError(null)
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-ink text-2xl font-medium tracking-tight">Recipes</h1>
        <button type="button" onClick={() => setShowCreate((v) => !v)} className={primaryButtonClass}>
          New recipe
        </button>
      </div>

      {showCreate && (
        <form
          onSubmit={handleCreate}
          noValidate
          className="border-border bg-surface-raised mb-6 flex flex-col gap-3 rounded-lg border p-4"
        >
          <div>
            <label htmlFor="recipe-name" className={labelClass}>
              Name
            </label>
            <input id="recipe-name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
            <FieldError messages={fieldErrors.name} />
          </div>
          <div>
            <label htmlFor="recipe-concentration" className={labelClass}>
              Default concentration (%)
            </label>
            <input
              id="recipe-concentration"
              value={concentration}
              onChange={(e) => setConcentration(e.target.value)}
              className={inputClass}
            />
            <FieldError messages={fieldErrors.default_concentration} />
          </div>
          {formError && <p className="text-danger text-sm">{formError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={closeCreate} className={secondaryButtonClass}>
              Cancel
            </button>
            <button type="submit" disabled={createMutation.isPending} className={primaryButtonClass}>
              {createMutation.isPending ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      )}

      {isLoading && <p className="text-ink-muted text-sm">Loading…</p>}
      {isError && <p className="text-danger text-sm">Couldn't load recipes.</p>}
      {recipes && recipes.length === 0 && <p className="text-ink-muted text-sm">No recipes yet.</p>}

      {recipes && recipes.length > 0 && (
        <ul className="flex flex-col gap-2">
          {recipes.map((recipe) => (
            <li key={recipe.id}>
              <Link
                to={`/recipes/${recipe.id}`}
                className="border-border hover:border-ink-muted flex items-center justify-between rounded-md border px-4 py-3 transition-colors"
              >
                <div>
                  <div className="text-ink text-sm font-medium">{recipe.name}</div>
                  <div className="text-ink-muted text-xs">
                    {recipe.default_concentration}% in {recipe.diluent_name} · {recipe.recipe_ingredients.length}{' '}
                    ingredient{recipe.recipe_ingredients.length === 1 ? '' : 's'}
                  </div>
                </div>
                {!recipe.is_balanced && (
                  <span className="text-danger border-danger rounded-full border px-2 py-0.5 text-xs whitespace-nowrap">
                    Unbalanced
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
