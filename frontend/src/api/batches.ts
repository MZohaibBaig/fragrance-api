import { apiClient } from './client'
import type { components } from './types'

export type Batch = components['schemas']['Batch']
export type BatchIngredient = components['schemas']['BatchIngredient']
export type BatchNote = components['schemas']['BatchNote']

interface PaginatedBatches {
  count: number
  next: string | null
  previous: string | null
  results: Batch[]
}

export interface BatchInput {
  recipe: number
  batch_size_g: string
  concentration?: string
  maceration_days?: number
  made_on: string
  status?: Batch['status']
  rating?: number | null
}

export interface BatchListParams {
  recipe?: number
  status?: string
  is_due?: boolean
}

export async function listBatches(params?: BatchListParams): Promise<Batch[]> {
  const { data } = await apiClient.get<PaginatedBatches>('/batches/', { params })
  return data.results
}

export async function getBatch(id: number): Promise<Batch> {
  const { data } = await apiClient.get<Batch>(`/batches/${id}/`)
  return data
}

export async function createBatch(input: BatchInput): Promise<Batch> {
  const { data } = await apiClient.post<Batch>('/batches/', input)
  return data
}

export async function updateBatch(id: number, input: Partial<BatchInput>): Promise<Batch> {
  const { data } = await apiClient.patch<Batch>(`/batches/${id}/`, input)
  return data
}
