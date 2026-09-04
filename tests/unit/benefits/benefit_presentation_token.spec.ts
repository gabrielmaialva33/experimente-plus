import { test } from '@japa/runner'

import InvalidBenefitPresentationException, {
  INVALID_BENEFIT_PRESENTATION_MESSAGE,
} from '#exceptions/invalid_benefit_presentation_exception'
import {
  BENEFIT_PRESENTATION_TOKEN_MAX_LENGTH,
  BENEFIT_PRESENTATION_TOKEN_MIN_LENGTH,
  BENEFIT_PRESENTATION_TOKEN_PATTERN,
} from '#modules/benefits/constants/benefit_redemption'
import BenefitPresentationTokenService from '#modules/benefits/services/benefit_presentation_token_service'

function captureFailure(callback: () => unknown): unknown {
  try {
    callback()
    return null
  } catch (error) {
    return error
  }
}

const BASE64URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

function withNonCanonicalPadBits(segment: string): string {
  const remainder = segment.length % 4
  if (remainder !== 2 && remainder !== 3) {
    throw new Error('A pad-bit alias requires a two- or three-character base64url tail')
  }

  const lastIndex = BASE64URL_ALPHABET.indexOf(segment.at(-1)!)
  const unusedBits = remainder === 2 ? 4 : 2
  if (lastIndex < 0 || (lastIndex & ((1 << unusedBits) - 1)) !== 0) {
    throw new Error('Expected a canonical base64url segment')
  }

  return `${segment.slice(0, -1)}${BASE64URL_ALPHABET[lastIndex + 1]}`
}

test.group('Benefit presentation token', () => {
  test('issues and verifies the canonical payload.signature format', ({ assert }) => {
    const service = new BenefitPresentationTokenService()
    const presentation = service.issue({ tenantId: 1, accessId: 2, offerId: 3, userId: 4 })

    assert.match(presentation.token, BENEFIT_PRESENTATION_TOKEN_PATTERN)
    assert.isAtLeast(presentation.token.length, BENEFIT_PRESENTATION_TOKEN_MIN_LENGTH)
    assert.isAtMost(presentation.token.length, BENEFIT_PRESENTATION_TOKEN_MAX_LENGTH)
    assert.deepEqual(service.verify(presentation.token), presentation.claims)
  })

  test('rejects malformed and oversized input before cryptographic verification', ({ assert }) => {
    const service = new BenefitPresentationTokenService()
    const { token: issuedToken } = service.issue({
      tenantId: 1,
      accessId: 2,
      offerId: 3,
      userId: 4,
    })
    const signature = 'A'.repeat(43)
    const nonCanonicalBase64UrlTokens = [`A.${signature}`, `AAAAA.${signature}`]
    const malformedTokens = [
      '',
      'not-a-presentation-token',
      ` ${issuedToken} `,
      ...nonCanonicalBase64UrlTokens,
      `payload.${'A'.repeat(42)}`,
      `payload.${'A'.repeat(44)}`,
      `payload!.${'A'.repeat(43)}`,
      `${'A'.repeat(BENEFIT_PRESENTATION_TOKEN_MAX_LENGTH - 43)}.${'A'.repeat(43)}`,
    ]

    for (const token of nonCanonicalBase64UrlTokens) {
      assert.notMatch(token, BENEFIT_PRESENTATION_TOKEN_PATTERN)
    }

    for (const token of malformedTokens) {
      const failure = captureFailure(() => service.verify(token))
      assert.instanceOf(failure, InvalidBenefitPresentationException)
      assert.equal((failure as Error).message, INVALID_BENEFIT_PRESENTATION_MESSAGE)
    }
  })

  test('uses the same generic error for a well-formed token with an invalid signature', ({
    assert,
  }) => {
    const service = new BenefitPresentationTokenService()
    const { token } = service.issue({ tenantId: 1, accessId: 2, offerId: 3, userId: 4 })
    const signatureStart = token.indexOf('.') + 1
    const replacement = token[signatureStart] === 'A' ? 'B' : 'A'
    const tampered = `${token.slice(0, signatureStart)}${replacement}${token.slice(signatureStart + 1)}`

    const failure = captureFailure(() => service.verify(tampered))
    assert.instanceOf(failure, InvalidBenefitPresentationException)
    assert.equal((failure as Error).message, INVALID_BENEFIT_PRESENTATION_MESSAGE)
  })

  test('rejects decodable pad-bit aliases in both token segments', ({ assert }) => {
    const service = new BenefitPresentationTokenService()
    const token = [1, 10, 100]
      .map((tenantId) => service.issue({ tenantId, accessId: 2, offerId: 3, userId: 4 }).token)
      .find((candidate) => candidate.split('.')[0].length % 4 !== 0)
    if (!token) throw new Error('Expected an issued payload with canonical base64url pad bits')
    const [payload, signature] = token.split('.') as [string, string]
    const payloadAlias = withNonCanonicalPadBits(payload)
    const signatureAlias = withNonCanonicalPadBits(signature)
    const aliasedTokens = [`${payloadAlias}.${signature}`, `${payload}.${signatureAlias}`]

    assert.isTrue(Buffer.from(payload, 'base64url').equals(Buffer.from(payloadAlias, 'base64url')))
    assert.isTrue(
      Buffer.from(signature, 'base64url').equals(Buffer.from(signatureAlias, 'base64url'))
    )

    for (const aliasedToken of aliasedTokens) {
      assert.notMatch(aliasedToken, BENEFIT_PRESENTATION_TOKEN_PATTERN)
      const failure = captureFailure(() => service.verify(aliasedToken))
      assert.instanceOf(failure, InvalidBenefitPresentationException)
      assert.equal((failure as Error).message, INVALID_BENEFIT_PRESENTATION_MESSAGE)
    }
  })
})
