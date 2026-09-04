import type { HttpRequest } from '@adonisjs/core/http'

/**
 * Returns the JSON object exactly as it appeared on the wire, but only for the
 * canonical application/json media type. Form data, query parameters, JSON
 * aliases, arrays, and primitives are intentionally not accepted as objects.
 */
export function canonicalJsonBody(request: HttpRequest): Record<string, unknown> | null {
  if (request.bodyType !== 'json' || !hasCanonicalJsonMediaType(request)) return null

  const rawBody = request.raw()
  if (!rawBody) return null

  try {
    const parsed: unknown = JSON.parse(rawBody)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

export function canonicalJsonField(request: HttpRequest, field: string): unknown {
  return canonicalJsonBody(request)?.[field]
}

function hasCanonicalJsonMediaType(request: HttpRequest): boolean {
  const mediaType = request.header('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
  return mediaType === 'application/json'
}
