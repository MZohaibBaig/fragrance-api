import { apiClient } from './client'

export interface NoteSummary {
  summary: string
  tags: string[]
}

export async function summarizeNote(noteId: number): Promise<NoteSummary> {
  const { data } = await apiClient.post<NoteSummary>('/ai/summarize-note/', { note_id: noteId })
  return data
}
