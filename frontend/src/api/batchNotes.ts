import { apiClient } from './client'
import type { BatchNote } from './batches'

export interface BatchNoteInput {
  batch: number
  observed_on: string
  body: string
}

export async function createBatchNote(input: BatchNoteInput): Promise<BatchNote> {
  const { data } = await apiClient.post<BatchNote>('/batch-notes/', input)
  return data
}

export async function updateBatchNote(id: number, input: Partial<Omit<BatchNoteInput, 'batch'>>): Promise<BatchNote> {
  const { data } = await apiClient.patch<BatchNote>(`/batch-notes/${id}/`, input)
  return data
}

export async function deleteBatchNote(id: number): Promise<void> {
  await apiClient.delete(`/batch-notes/${id}/`)
}
