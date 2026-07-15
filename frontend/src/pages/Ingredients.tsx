import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteIngredient, listIngredients, type Ingredient } from '../api/ingredients'
import { parseApiError } from '../api/errors'
import { IngredientFormModal } from '../components/IngredientFormModal'
import { primaryButtonClass } from '../components/formStyles'

type ModalState = { mode: 'create' } | { mode: 'edit'; ingredient: Ingredient } | null

export function IngredientsPage() {
  const queryClient = useQueryClient()
  const { data: ingredients, isLoading, isError } = useQuery({
    queryKey: ['ingredients'],
    queryFn: listIngredients,
  })

  const [modal, setModal] = useState<ModalState>(null)
  const [confirmingId, setConfirmingId] = useState<number | null>(null)
  const [deleteErrors, setDeleteErrors] = useState<Record<number, string>>({})

  const deleteMutation = useMutation({
    mutationFn: deleteIngredient,
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['ingredients'] })
      setConfirmingId(null)
      setDeleteErrors((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    },
    onError: (error, id) => {
      const message = parseApiError(error).detail ?? "Couldn't delete this ingredient."
      setDeleteErrors((prev) => ({ ...prev, [id]: message }))
      setConfirmingId(null)
    },
  })

  function handleDeleteClick(id: number): void {
    if (confirmingId === id) {
      deleteMutation.mutate(id)
    } else {
      setConfirmingId(id)
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-ink text-2xl font-medium tracking-tight">Ingredients</h1>
        <button type="button" onClick={() => setModal({ mode: 'create' })} className={primaryButtonClass}>
          New ingredient
        </button>
      </div>

      {isLoading && <p className="text-ink-muted text-sm">Loading…</p>}
      {isError && <p className="text-danger text-sm">Couldn't load ingredients.</p>}

      {ingredients && ingredients.length === 0 && (
        <p className="text-ink-muted text-sm">No ingredients yet.</p>
      )}

      {ingredients && ingredients.length > 0 && (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-border text-ink-muted border-b">
              <th className="py-2 pr-4 font-normal">Name</th>
              <th className="py-2 pr-4 font-normal">Supplier</th>
              <th className="py-2 pr-4 font-normal">Notes</th>
              <th className="py-2 pr-4 font-normal">Dilution</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {ingredients.map((ingredient) => (
              <tr key={ingredient.id} className="border-border border-b last:border-0">
                <td className="text-ink py-2 pr-4">{ingredient.name}</td>
                <td className="text-ink-muted py-2 pr-4">{ingredient.supplier || '—'}</td>
                <td className="text-ink-muted max-w-xs truncate py-2 pr-4">{ingredient.notes || '—'}</td>
                <td className="text-ink-muted py-2 pr-4">{ingredient.dilution_strength}%</td>
                <td className="py-2 text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => setModal({ mode: 'edit', ingredient })}
                    className="text-ink-muted hover:text-ink mr-3 text-sm"
                  >
                    Edit
                  </button>
                  <button type="button" onClick={() => handleDeleteClick(ingredient.id)} className="text-danger text-sm">
                    {confirmingId === ingredient.id ? 'Confirm?' : 'Delete'}
                  </button>
                  {deleteErrors[ingredient.id] && (
                    <p className="text-danger mt-1 text-xs">{deleteErrors[ingredient.id]}</p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modal && (
        <IngredientFormModal
          ingredient={modal.mode === 'edit' ? modal.ingredient : null}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
