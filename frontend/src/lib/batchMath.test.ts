import { describe, expect, it } from 'vitest'
import { computeBatchPreview } from './batchMath'
import type { RecipeIngredient } from '../api/recipes'

function ri(id: number, name: string, proportion: string): RecipeIngredient {
  return { id, recipe: 1, ingredient: id, ingredient_name: name, proportion }
}

describe('computeBatchPreview', () => {
  it('handles a single-ingredient recipe', () => {
    const preview = computeBatchPreview([ri(1, 'Bergamot', '100')], 100, 20)
    expect(preview.aromaticG).toBe(20)
    expect(preview.diluentG).toBe(80)
    expect(preview.ingredients).toEqual([
      { ingredientId: 1, ingredientName: 'Bergamot', proportion: 100, grams: 20 },
    ])
  })

  it('splits a multi-ingredient 60/40 recipe with exact sums', () => {
    const preview = computeBatchPreview(
      [ri(1, 'Bergamot', '60'), ri(2, 'Lemon', '40')],
      100,
      20,
    )
    expect(preview.aromaticG).toBe(20)
    expect(preview.ingredients).toEqual([
      { ingredientId: 1, ingredientName: 'Bergamot', proportion: 60, grams: 12 },
      { ingredientId: 2, ingredientName: 'Lemon', proportion: 40, grams: 8 },
    ])
    const ingredientSum = preview.ingredients.reduce((sum, i) => sum + i.grams, 0)
    expect(ingredientSum).toBe(preview.aromaticG)
  })

  it('keeps aromatic + diluent equal to the batch size', () => {
    const cases: Array<[number, number]> = [
      [100, 20],
      [4, 20],
      [20000, 20],
      [40, 22],
    ]
    for (const [batchSizeG, concentration] of cases) {
      const preview = computeBatchPreview([], batchSizeG, concentration)
      expect(preview.aromaticG + preview.diluentG).toBe(batchSizeG)
    }
  })

  it('rounds grams to 2 decimal places', () => {
    const preview = computeBatchPreview([ri(1, 'Bergamot', '100')], 100, 33.333)
    expect(preview.aromaticG).toBe(33.33)
    expect(preview.diluentG).toBe(66.67)
  })

  it('handles a tiny 4g batch', () => {
    const preview = computeBatchPreview([ri(1, 'Bergamot', '50'), ri(2, 'Lemon', '50')], 4, 20)
    expect(preview.aromaticG).toBe(0.8)
    expect(preview.diluentG).toBe(3.2)
    expect(preview.ingredients).toEqual([
      { ingredientId: 1, ingredientName: 'Bergamot', proportion: 50, grams: 0.4 },
      { ingredientId: 2, ingredientName: 'Lemon', proportion: 50, grams: 0.4 },
    ])
  })

  it('handles a huge 20000g batch', () => {
    const preview = computeBatchPreview([ri(1, 'Bergamot', '100')], 20000, 20)
    expect(preview.aromaticG).toBe(4000)
    expect(preview.diluentG).toBe(16000)
    expect(preview.ingredients[0].grams).toBe(4000)
  })

  it('does not normalize unbalanced proportions — each ingredient is computed off its own share', () => {
    // Proportions sum to 120, not 100. computeBatchPreview does not clamp or
    // rebalance; it just applies each ingredient's own proportion.
    const preview = computeBatchPreview(
      [ri(1, 'Bergamot', '50'), ri(2, 'Lemon', '70')],
      100,
      20,
    )
    expect(preview.aromaticG).toBe(20)
    expect(preview.ingredients).toEqual([
      { ingredientId: 1, ingredientName: 'Bergamot', proportion: 50, grams: 10 },
      { ingredientId: 2, ingredientName: 'Lemon', proportion: 70, grams: 14 },
    ])
    const ingredientSum = preview.ingredients.reduce((sum, i) => sum + i.grams, 0)
    expect(ingredientSum).not.toBe(preview.aromaticG)
  })
})
