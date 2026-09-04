import type { HttpRequest } from '@adonisjs/core/http'

import InvalidBenefitPresentationException from '#exceptions/invalid_benefit_presentation_exception'
import { BENEFIT_PRESENTATION_TOKEN_MAX_LENGTH } from '#modules/benefits/constants/benefit_redemption'
import { benefitPresentationTokenValidator } from '#modules/benefits/validators/benefit_redemption_validator'

/**
 * Validates the token field as it appeared on the wire before the bodyparser's
 * whitespace normalization, then applies the canonical HTTP input validator.
 */
export async function validateBenefitPresentationTokenInput(
  request: HttpRequest,
  allowedBodyTypes: ReadonlyArray<'json' | 'urlencoded'>
): Promise<{ token: string }> {
  const rawToken = tokenFromRawBody(request, allowedBodyTypes)
  return request.validateUsing(benefitPresentationTokenValidator, {
    data: { token: rawToken },
  })
}

/**
 * Query strings are not handled by the bodyparser. Bound the raw field before
 * applying the same small-whitespace normalization used by POST requests.
 */
export function normalizeBenefitPresentationTokenQuery(input: unknown): string {
  if (typeof input !== 'string') return ''
  if (input.length > BENEFIT_PRESENTATION_TOKEN_MAX_LENGTH) {
    throw new InvalidBenefitPresentationException()
  }
  return input.trim()
}

function tokenFromRawBody(
  request: HttpRequest,
  allowedBodyTypes: ReadonlyArray<'json' | 'urlencoded'>
): unknown {
  const bodyType = request.bodyType
  if (bodyType !== 'json' && bodyType !== 'urlencoded') return undefined
  if (!allowedBodyTypes.includes(bodyType)) return undefined
  if (!hasCanonicalMediaType(request, bodyType)) return undefined

  const rawBody = request.raw()
  if (!rawBody) return undefined

  if (bodyType === 'json') {
    try {
      const parsed: unknown = JSON.parse(rawBody)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined
      return (parsed as Record<string, unknown>).token
    } catch {
      return undefined
    }
  }

  if (bodyType === 'urlencoded') {
    const parsedToken: unknown = request.body().token
    if (typeof parsedToken !== 'string') return parsedToken

    const fields = [...new URLSearchParams(rawBody)]
    const tokens = fields.filter(([key]) => key === 'token').map(([, value]) => value)
    const hasStructuralCollision = fields.some(
      ([key]) => key.startsWith('token[') || key.startsWith('token.')
    )
    if (tokens.length !== 1 || hasStructuralCollision) return tokens
    return tokens[0]
  }

  return undefined
}

function hasCanonicalMediaType(request: HttpRequest, bodyType: 'json' | 'urlencoded'): boolean {
  const mediaType = request.header('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
  const expectedMediaType =
    bodyType === 'json' ? 'application/json' : 'application/x-www-form-urlencoded'
  return mediaType === expectedMediaType
}
