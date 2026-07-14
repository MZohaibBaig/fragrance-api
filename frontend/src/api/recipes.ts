import { apiClient } from './client'
import type { components } from './types'

export type Recipe = components['schemas']['Recipe']
export type RecipeIngredient = components['schemas']['RecipeIngredient']

interface PaginatedRecipes {
  count: number
  next: string | null
  previous: string | null
  results: Recipe[]
}

export interface RecipeInput {
  name: string
  description?: string | null
  default_concentration: string
  diluent_name?: string
  default_maceration_days?: number
}

export interface RecipeIngredientInput {
  recipe: number
  ingredient: number
  proportion: string
}

export async function listRecipes(): Promise<Recipe[]> {
  const { data } = await apiClient.get<PaginatedRecipes>('/recipes/')
  return data.results
}

export async function getRecipe(id: number): Promise<Recipe> {
  const { data } = await apiClient.get<Recipe>(`/recipes/${id}/`)
  return data
}

export async function createRecipe(input: RecipeInput): Promise<Recipe> {
  const { data } = await apiClient.post<Recipe>('/recipes/', input)
  return data
}

export async function updateRecipe(id: number, input: Partial<RecipeInput>): Promise<Recipe> {
  const { data } = await apiClient.patch<Recipe>(`/recipes/${id}/`, input)
  return data
}

export async function addRecipeIngredient(input: RecipeIngredientInput): Promise<RecipeIngredient> {
  const { data } = await apiClient.post<RecipeIngredient>('/recipe-ingredients/', input)
  return data
}

export async function deleteRecipeIngredient(id: number): Promise<void> {
  await apiClient.delete(`/recipe-ingredients/${id}/`)
}
