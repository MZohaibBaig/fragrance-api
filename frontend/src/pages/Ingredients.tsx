import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteIngredient, listIngredients, type Ingredient } from '../api/ingredients'
import { parseApiError } from '../api/errors'
import { IngredientFormModal } from '../components/IngredientFormModal'
import { PageHeader } from '../components/PageHeader'
import { EmptyState } from '../components/EmptyState'
import { Spinner } from '../components/Spinner'
import { primaryButtonClass, ghostButtonClass } from '../components/formStyles'
import { tableWrapClass, tableClass, tableHeadRowClass, tableHeadCellClass, tableRowClass, tableCellClass } from '../components/ui'

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
      <PageHeader
        title="Ingredients"
        action={
          <button type="button" onClick={() => setModal({ mode: 'create' })} className={primaryButtonClass}>
            New ingredient
          </button>
        }
      />

      {isLoading && <Spinner />}
      {isError && <p className="text-danger text-sm">Couldn't load ingredients.</p>}

      {ingredients && ingredients.length === 0 && (
        <EmptyState
          message="No ingredients yet — add your first material to start building recipes."
          action={
            <button type="button" onClick={() => setModal({ mode: 'create' })} className={primaryButtonClass}>
              New ingredient
            </button>
          }
        />
      )}

      {ingredients && ingredients.length > 0 && (
        <div className={tableWrapClass}>
          <table className={tableClass}>
            <thead>
              <tr className={tableHeadRowClass}>
                <th className={tableHeadCellClass}>Name</th>
                <th className={tableHeadCellClass}>Supplier</th>
                <th className={tableHeadCellClass}>Notes</th>
                <th className={tableHeadCellClass}>Dilution</th>
                <th className={tableHeadCellClass}></th>
              </tr>
            </thead>
            <tbody>
              {ingredients.map((ingredient) => (
                <tr key={ingredient.id} className={tableRowClass}>
                  <td className={`text-ink ${tableCellClass}`}>{ingredient.name}</td>
                  <td className={`text-ink-muted ${tableCellClass}`}>{ingredient.supplier || '—'}</td>
                  <td className={`text-ink-muted max-w-xs truncate ${tableCellClass}`}>{ingredient.notes || '—'}</td>
                  <td className={`text-ink-muted ${tableCellClass}`}>{ingredient.dilution_strength}%</td>
                  <td className="py-2 pr-4 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setModal({ mode: 'edit', ingredient })}
                      className={`${ghostButtonClass} mr-3`}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteClick(ingredient.id)}
                      className="text-danger text-sm"
                    >
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
        </div>
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
