import type { RecipeIngredient } from '../api/recipes'

export interface BatchIngredientPreview {
  ingredientId: number
  ingredientName: string
  proportion: number
  grams: number
}

export interface BatchPreview {
  aromaticG: number
  diluentG: number
  ingredients: BatchIngredientPreview[]
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Client-side preview only — mirrors Batch.compute() on the server, but the
 * server's frozen aromatic_g/diluent_g/ingredients are the source of truth.
 */
export function computeBatchPreview(
  recipeIngredients: RecipeIngredient[],
  batchSizeG: number,
  concentration: number,
): BatchPreview {
  if (!Number.isFinite(batchSizeG) || !Number.isFinite(concentration) || batchSizeG <= 0) {
    return { aromaticG: 0, diluentG: 0, ingredients: [] }
  }

  const aromaticG = round2((batchSizeG * concentration) / 100)
  const diluentG = round2(batchSizeG - aromaticG)

  const ingredients = recipeIngredients.map((ri) => ({
    ingredientId: ri.ingredient,
    ingredientName: ri.ingredient_name,
    proportion: Number(ri.proportion),
    grams: round2((aromaticG * Number(ri.proportion)) / 100),
  }))

  return { aromaticG, diluentG, ingredients }
}
