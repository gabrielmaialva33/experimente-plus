import type { HttpRequest } from '@adonisjs/core/http'

/**
 * Reads the refresh credential exactly as it appeared on the wire. AdonisJS
 * normalizes request input before Vine receives it, which is appropriate for
 * names but not for opaque credentials where whitespace changes the secret.
 */
export function refreshTokenFromRawBody(request: HttpRequest): unknown {
  if (request.bodyType !== 'json' || !hasCanonicalJsonMediaType(request)) return undefined

  const rawBody = request.raw()
  if (!rawBody) return undefined

  try {
    const parsed: unknown = JSON.parse(rawBody)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined
    return (parsed as Record<string, unknown>).refresh_token
  } catch {
    return undefined
  }
}

function hasCanonicalJsonMediaType(request: HttpRequest): boolean {
  const mediaType = request.header('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
  return mediaType === 'application/json'
}
