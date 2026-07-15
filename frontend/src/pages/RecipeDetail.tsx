import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRecipe, updateRecipe, addRecipeIngredient, deleteRecipeIngredient } from '../api/recipes'
import { listIngredients } from '../api/ingredients'
import { parseApiError, formLevelError, type FieldErrors } from '../api/errors'
import { FieldError } from '../components/FieldError'
import { Card } from '../components/Card'
import { Spinner } from '../components/Spinner'
import { ghostButtonClass, inputClass, labelClass, primaryButtonClass } from '../components/formStyles'

export function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>()
  // Keying on id forces a full remount (and fresh local form state) when
  // navigating from one recipe's detail page straight to another's.
  return <RecipeDetailInner key={id} recipeId={Number(id)} />
}

function RecipeDetailInner({ recipeId }: { recipeId: number }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const recipeQuery = useQuery({ queryKey: ['recipes', recipeId], queryFn: () => getRecipe(recipeId) })
  const ingredientsQuery = useQuery({ queryKey: ['ingredients'], queryFn: listIngredients })
  const recipe = recipeQuery.data

  const [name, setName] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [concentration, setConcentration] = useState('')
  const [diluentName, setDiluentName] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (recipe && name === null) {
      setName(recipe.name)
      setDescription(recipe.description ?? '')
      setConcentration(recipe.default_concentration)
      setDiluentName(recipe.diluent_name ?? '')
    }
  }, [recipe, name])

  const saveMutation = useMutation({
    mutationFn: () =>
      updateRecipe(recipeId, {
        name: name ?? '',
        description: description || null,
        default_concentration: concentration,
        diluent_name: diluentName,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes', recipeId] })
      queryClient.invalidateQueries({ queryKey: ['recipes'] })
      setFieldErrors({})
      setFormError(null)
      setJustSaved(true)
      clearTimeout(savedTimeoutRef.current)
      savedTimeoutRef.current = setTimeout(() => setJustSaved(false), 2000)
    },
    onError: (error) => {
      const parsed = parseApiError(error)
      setFieldErrors(parsed.fieldErrors ?? {})
      setFormError(formLevelError(parsed))
      setJustSaved(false)
    },
  })

  function handleSaveFields(event: FormEvent): void {
    event.preventDefault()
    saveMutation.mutate()
  }

  const [selectedIngredientId, setSelectedIngredientId] = useState('')
  const [proportion, setProportion] = useState('')
  const [addFieldErrors, setAddFieldErrors] = useState<FieldErrors>({})
  const [addFormError, setAddFormError] = useState<string | null>(null)
  const [justAdded, setJustAdded] = useState(false)
  const addedTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const addMutation = useMutation({
    mutationFn: () =>
      addRecipeIngredient({ recipe: recipeId, ingredient: Number(selectedIngredientId), proportion }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes', recipeId] })
      setSelectedIngredientId('')
      setProportion('')
      setAddFieldErrors({})
      setAddFormError(null)
      setJustAdded(true)
      clearTimeout(addedTimeoutRef.current)
      addedTimeoutRef.current = setTimeout(() => setJustAdded(false), 2000)
    },
    onError: (error) => {
      const parsed = parseApiError(error)
      setAddFieldErrors(parsed.fieldErrors ?? {})
      setAddFormError(formLevelError(parsed))
      setJustAdded(false)
    },
  })

  const [removingId, setRemovingId] = useState<number | null>(null)
  const [removeError, setRemoveError] = useState<{ id: number; message: string } | null>(null)

  const removeMutation = useMutation({
    mutationFn: (recipeIngredientId: number) => deleteRecipeIngredient(recipeIngredientId),
    onMutate: (recipeIngredientId: number) => {
      setRemovingId(recipeIngredientId)
      setRemoveError(null)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes', recipeId] })
    },
    onError: (error, recipeIngredientId) => {
      setRemoveError({
        id: recipeIngredientId,
        message: parseApiError(error).detail ?? "Couldn't remove this ingredient.",
      })
    },
    onSettled: () => {
      setRemovingId(null)
    },
  })

  function handleAddIngredient(event: FormEvent): void {
    event.preventDefault()
    setAddFieldErrors({})
    setAddFormError(null)
    addMutation.mutate()
  }

  if (recipeQuery.isLoading) {
    return <Spinner />
  }
  if (recipeQuery.isError || !recipe) {
    return <p className="text-danger text-sm">Couldn't load this recipe.</p>
  }

  const existingIngredientIds = new Set(recipe.recipe_ingredients.map((ri) => ri.ingredient))
  const availableIngredients = (ingredientsQuery.data ?? []).filter((ing) => !existingIngredientIds.has(ing.id))

  return (
    <div>
      <button type="button" onClick={() => navigate('/recipes')} className={`${ghostButtonClass} mb-4`}>
        ← Recipes
      </button>

      <Card className="p-5">
        <form onSubmit={handleSaveFields} noValidate className="flex flex-col gap-4">
          <div>
            <label htmlFor="recipe-name" className={labelClass}>
              Name
            </label>
            <input
              id="recipe-name"
              value={name ?? ''}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
            <FieldError messages={fieldErrors.name} />
          </div>
          <div>
            <label htmlFor="recipe-description" className={labelClass}>
              Description
            </label>
            <textarea
              id="recipe-description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputClass}
            />
            <FieldError messages={fieldErrors.description} />
          </div>
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex-1">
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
            <div className="flex-1">
              <label htmlFor="recipe-diluent" className={labelClass}>
                Diluent
              </label>
              <input
                id="recipe-diluent"
                value={diluentName}
                onChange={(e) => setDiluentName(e.target.value)}
                className={inputClass}
              />
              <FieldError messages={fieldErrors.diluent_name} />
            </div>
          </div>
          {formError && <p className="text-danger text-sm">{formError}</p>}
          <div className="flex items-center gap-3">
            <button type="submit" disabled={saveMutation.isPending} className={primaryButtonClass}>
              {saveMutation.isPending ? 'Saving…' : 'Save changes'}
            </button>
            {justSaved && <span className="text-ink-muted text-sm">Saved</span>}
          </div>
        </form>
      </Card>

      <Card className="mt-8 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-ink text-lg font-medium">Ingredients</h2>
          <span className={recipe.is_balanced ? 'text-ink-muted text-sm' : 'text-danger text-sm'}>
            Proportions total {recipe.proportions_total}%{!recipe.is_balanced && ' — must reach 100'}
          </span>
        </div>

        {recipe.recipe_ingredients.length === 0 && (
          <p className="text-ink-muted mb-4 text-sm">No ingredients yet.</p>
        )}

        {recipe.recipe_ingredients.length > 0 && (
          <ul className="mb-4 flex flex-col gap-2">
            {recipe.recipe_ingredients.map((ri) => (
              <li key={ri.id} className="border-border rounded-field border px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-ink">{ri.ingredient_name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-ink-muted">{ri.proportion}%</span>
                    <button
                      type="button"
                      onClick={() => removeMutation.mutate(ri.id)}
                      disabled={removingId === ri.id}
                      className="text-danger text-xs"
                    >
                      {removingId === ri.id ? 'Removing…' : 'Remove'}
                    </button>
                  </div>
                </div>
                {removeError?.id === ri.id && <p className="text-danger mt-1 text-xs">{removeError.message}</p>}
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleAddIngredient} noValidate className="flex flex-wrap items-end gap-3">
          <div className="min-w-40 flex-1">
            <label htmlFor="ri-ingredient" className={labelClass}>
              Material
            </label>
            <select
              id="ri-ingredient"
              value={selectedIngredientId}
              onChange={(e) => setSelectedIngredientId(e.target.value)}
              className={inputClass}
            >
              <option value="">Select…</option>
              {availableIngredients.map((ing) => (
                <option key={ing.id} value={ing.id}>
                  {ing.name}
                </option>
              ))}
            </select>
            <FieldError messages={addFieldErrors.ingredient} />
          </div>
          <div className="w-28">
            <label htmlFor="ri-proportion" className={labelClass}>
              Proportion (%)
            </label>
            <input
              id="ri-proportion"
              value={proportion}
              onChange={(e) => setProportion(e.target.value)}
              className={inputClass}
            />
            <FieldError messages={addFieldErrors.proportion} />
          </div>
          <button
            type="submit"
            disabled={addMutation.isPending || !selectedIngredientId || !proportion}
            className={primaryButtonClass}
          >
            {addMutation.isPending ? 'Adding…' : 'Add'}
          </button>
          {justAdded && <span className="text-ink-muted text-sm">Added</span>}
        </form>
        {addFormError && <p className="text-danger mt-2 text-sm">{addFormError}</p>}
        {ingredientsQuery.data && ingredientsQuery.data.length > 0 && availableIngredients.length === 0 && (
          <p className="text-ink-muted mt-2 text-sm">All ingredients are already in this recipe.</p>
        )}
      </Card>
    </div>
  )
}
