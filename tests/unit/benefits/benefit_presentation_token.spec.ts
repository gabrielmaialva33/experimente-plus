import { test } from '@japa/runner'

import InvalidBenefitPresentationException, {
  INVALID_BENEFIT_PRESENTATION_MESSAGE,
} from '#exceptions/invalid_benefit_presentation_exception'
import {
  BENEFIT_PRESENTATION_TOKEN_MAX_LENGTH,
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

test.group('Benefit presentation token', () => {
  test('issues and verifies the canonical payload.signature format', ({ assert }) => {
    const service = new BenefitPresentationTokenService()
    const presentation = service.issue({ tenantId: 1, accessId: 2, offerId: 3, userId: 4 })

    assert.match(presentation.token, BENEFIT_PRESENTATION_TOKEN_PATTERN)
    assert.isAtMost(presentation.token.length, BENEFIT_PRESENTATION_TOKEN_MAX_LENGTH)
    assert.deepEqual(service.verify(presentation.token), presentation.claims)
  })

  test('rejects malformed and oversized input before cryptographic verification', ({ assert }) => {
    const service = new BenefitPresentationTokenService()
    const malformedTokens = [
      '',
      'not-a-presentation-token',
      `payload.${'A'.repeat(42)}`,
      `payload.${'A'.repeat(44)}`,
      `payload!.${'A'.repeat(43)}`,
      `${'A'.repeat(BENEFIT_PRESENTATION_TOKEN_MAX_LENGTH - 43)}.${'A'.repeat(43)}`,
    ]

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
    const replacement = token.endsWith('A') ? 'B' : 'A'
    const tampered = `${token.slice(0, -1)}${replacement}`

    const failure = captureFailure(() => service.verify(tampered))
    assert.instanceOf(failure, InvalidBenefitPresentationException)
    assert.equal((failure as Error).message, INVALID_BENEFIT_PRESENTATION_MESSAGE)
  })
})
