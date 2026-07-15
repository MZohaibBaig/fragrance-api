import { AxiosError } from 'axios'

export type FieldErrors = Record<string, string[]>

export interface ApiError {
  detail: string | null
  fieldErrors: FieldErrors | null
}

/** Normalizes DRF's two error shapes: {"detail": "..."} and {"field": ["msg", ...]}. */
export function parseApiError(error: unknown): ApiError {
  if (error instanceof AxiosError && error.response?.data) {
    const data = error.response.data as Record<string, unknown>

    if (typeof data.detail === 'string') {
      return { detail: data.detail, fieldErrors: null }
    }

    const fieldErrors: FieldErrors = {}
    for (const [key, value] of Object.entries(data)) {
      if (Array.isArray(value)) {
        fieldErrors[key] = value.map(String)
      }
    }
    if (Object.keys(fieldErrors).length > 0) {
      return { detail: null, fieldErrors }
    }
  }

  return { detail: 'Something went wrong. Please try again.', fieldErrors: null }
}

/** A single message for banner-style display: detail, or DRF's non_field_errors, else null. */
export function formLevelError(parsed: ApiError): string | null {
  return parsed.detail ?? parsed.fieldErrors?.non_field_errors?.join(' ') ?? null
}
