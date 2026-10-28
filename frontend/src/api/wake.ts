// Derives the API origin (scheme + host) from VITE_API_URL, which includes the /api path.
// Returns null when no usable URL is configured.
export function getApiOrigin(
  apiUrl: string | undefined = import.meta.env.VITE_API_URL,
  base: string | undefined = globalThis.location?.origin,
): string | null {
  if (!apiUrl) {
    return null
  }
  try {
    return new URL(apiUrl, base).origin
  } catch {
    return null
  }
}

// Fire-and-forget request to start a sleeping backend before the user's first real call.
// The response is never read, so no-cors keeps this independent of CORS config.
export function wakeServer(): void {
  const origin = getApiOrigin()
  if (!origin) {
    return
  }
  fetch(`${origin}/health/`, { mode: 'no-cors', cache: 'no-store', credentials: 'omit' }).catch(
    () => {},
  )
}
