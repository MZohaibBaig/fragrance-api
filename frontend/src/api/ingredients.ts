import { apiClient } from './client'
import type { components } from './types'

export type Ingredient = components['schemas']['Ingredient']

interface PaginatedIngredients {
  count: number
  next: string | null
  previous: string | null
  results: Ingredient[]
}

export interface IngredientInput {
  name: string
  article_number?: string | null
  supplier?: string | null
  description?: string | null
  notes?: string | null
}

export async function listIngredients(): Promise<Ingredient[]> {
  const { data } = await apiClient.get<PaginatedIngredients>('/ingredients/')
  return data.results
}

export async function createIngredient(input: IngredientInput): Promise<Ingredient> {
  const { data } = await apiClient.post<Ingredient>('/ingredients/', input)
  return data
}

export async function updateIngredient(id: number, input: Partial<IngredientInput>): Promise<Ingredient> {
  const { data } = await apiClient.patch<Ingredient>(`/ingredients/${id}/`, input)
  return data
}

export async function deleteIngredient(id: number): Promise<void> {
  await apiClient.delete(`/ingredients/${id}/`)
}
