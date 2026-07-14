import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal } from './Modal'
import { FieldError } from './FieldError'
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from './formStyles'
import { createIngredient, updateIngredient, type Ingredient, type IngredientInput } from '../api/ingredients'
import { parseApiError, formLevelError, type FieldErrors } from '../api/errors'

export function IngredientFormModal({
  ingredient,
  onClose,
}: {
  ingredient: Ingredient | null
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(ingredient?.name ?? '')
  const [supplier, setSupplier] = useState(ingredient?.supplier ?? '')
  const [articleNumber, setArticleNumber] = useState(ingredient?.article_number ?? '')
  const [notes, setNotes] = useState(ingredient?.notes ?? '')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (input: IngredientInput) =>
      ingredient ? updateIngredient(ingredient.id, input) : createIngredient(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredients'] })
      onClose()
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
    mutation.mutate({
      name,
      supplier: supplier || null,
      article_number: articleNumber || null,
      notes: notes || null,
    })
  }

  return (
    <Modal title={ingredient ? 'Edit ingredient' : 'New ingredient'} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div>
          <label htmlFor="ing-name" className={labelClass}>
            Name
          </label>
          <input id="ing-name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          <FieldError messages={fieldErrors.name} />
        </div>
        <div>
          <label htmlFor="ing-supplier" className={labelClass}>
            Supplier
          </label>
          <input
            id="ing-supplier"
            value={supplier ?? ''}
            onChange={(e) => setSupplier(e.target.value)}
            className={inputClass}
          />
          <FieldError messages={fieldErrors.supplier} />
        </div>
        <div>
          <label htmlFor="ing-article" className={labelClass}>
            Article number
          </label>
          <input
            id="ing-article"
            value={articleNumber ?? ''}
            onChange={(e) => setArticleNumber(e.target.value)}
            className={inputClass}
          />
          <FieldError messages={fieldErrors.article_number} />
        </div>
        <div>
          <label htmlFor="ing-notes" className={labelClass}>
            Notes
          </label>
          <textarea
            id="ing-notes"
            rows={3}
            value={notes ?? ''}
            onChange={(e) => setNotes(e.target.value)}
            className={inputClass}
          />
          <FieldError messages={fieldErrors.notes} />
        </div>

        {formError && <p className="text-danger text-sm">{formError}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            Cancel
          </button>
          <button type="submit" disabled={mutation.isPending} className={primaryButtonClass}>
            {mutation.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
