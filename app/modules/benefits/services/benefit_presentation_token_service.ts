import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

import InvalidBenefitPresentationException from '#exceptions/invalid_benefit_presentation_exception'
import {
  BENEFIT_PRESENTATION_TOKEN_MAX_LENGTH,
  BENEFIT_PRESENTATION_TOKEN_MIN_LENGTH,
  BENEFIT_PRESENTATION_TOKEN_PATTERN,
} from '#modules/benefits/constants/benefit_redemption'
import type IBenefitRedemption from '#modules/benefits/interfaces/benefit_redemption_interface'
import env from '#start/env'

const TOKEN_PURPOSE = 'experimente-plus:benefit-redemption:v1'
const TOKEN_TTL_SECONDS = 5 * 60

export default class BenefitPresentationTokenService {
  issue(input: { tenantId: number; accessId: number; offerId: number; userId: number }): {
    token: string
    claims: IBenefitRedemption.PresentationClaims
  } {
    const issuedAt = Math.floor(Date.now() / 1000)
    const claims: IBenefitRedemption.PresentationClaims = {
      version: 1,
      tenant_id: input.tenantId,
      access_id: input.accessId,
      offer_id: input.offerId,
      user_id: input.userId,
      nonce: randomBytes(24).toString('base64url'),
      issued_at: issuedAt,
      expires_at: issuedAt + TOKEN_TTL_SECONDS,
    }
    const payload = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url')
    const signature = this.sign(payload)

    return { token: `${payload}.${signature}`, claims }
  }

  verify(token: string): IBenefitRedemption.PresentationClaims {
    if (typeof token !== 'string') {
      throw this.invalidToken()
    }

    const normalizedToken = token.trim()
    if (
      normalizedToken.length < BENEFIT_PRESENTATION_TOKEN_MIN_LENGTH ||
      normalizedToken.length > BENEFIT_PRESENTATION_TOKEN_MAX_LENGTH ||
      !BENEFIT_PRESENTATION_TOKEN_PATTERN.test(normalizedToken)
    ) {
      throw this.invalidToken()
    }

    const [payload, signature, extra] = normalizedToken.split('.')
    if (!payload || !signature || extra) {
      throw this.invalidToken()
    }

    const expected = this.sign(payload)
    const providedBuffer = Buffer.from(signature)
    const expectedBuffer = Buffer.from(expected)
    if (
      providedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
      throw this.invalidToken()
    }

    let claims: IBenefitRedemption.PresentationClaims
    try {
      claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    } catch {
      throw this.invalidToken()
    }

    const now = Math.floor(Date.now() / 1000)
    if (
      claims.version !== 1 ||
      !Number.isInteger(claims.tenant_id) ||
      !Number.isInteger(claims.access_id) ||
      !Number.isInteger(claims.offer_id) ||
      !Number.isInteger(claims.user_id) ||
      typeof claims.nonce !== 'string' ||
      claims.nonce.length < 20 ||
      !Number.isInteger(claims.issued_at) ||
      !Number.isInteger(claims.expires_at) ||
      claims.expires_at <= now ||
      claims.issued_at > now + 30
    ) {
      throw this.invalidToken()
    }

    return claims
  }

  hashNonce(nonce: string): string {
    return createHash('sha256').update(`${TOKEN_PURPOSE}:${nonce}`).digest('hex')
  }

  private sign(payload: string): string {
    return createHmac('sha256', env.get('APP_KEY'))
      .update(`${TOKEN_PURPOSE}.${payload}`)
      .digest('base64url')
  }

  private invalidToken(): InvalidBenefitPresentationException {
    return new InvalidBenefitPresentationException()
  }
}
