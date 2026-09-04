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
  allowedBodyTypes: readonly Array<'json' | 'urlencoded'>
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
  allowedBodyTypes: readonly Array<'json' | 'urlencoded'>
): unknown {
  if (!allowedBodyTypes.includes(request.bodyType as 'json' | 'urlencoded')) return undefined

  const rawBody = request.raw()
  if (!rawBody) return undefined

  if (request.bodyType === 'json') {
    try {
      const parsed: unknown = JSON.parse(rawBody)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined
      return (parsed as Record<string, unknown>).token
    } catch {
      return undefined
    }
  }

  if (request.bodyType === 'urlencoded') {
    const parsedToken: unknown = request.body().token
    if (typeof parsedToken !== 'string') return parsedToken
    const tokens = new URLSearchParams(rawBody).getAll('token')
    if (tokens.length > 1) return tokens
    return tokens.length === 1 ? tokens[0] : undefined
  }

  return undefined
}
