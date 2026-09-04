import { test } from '@japa/runner'

import {
  benefitPresentationRequestValidator,
  benefitPresentationTokenValidator,
} from '#modules/benefits/validators/benefit_redemption_validator'

async function captureFailure(callback: () => Promise<unknown>): Promise<unknown> {
  try {
    await callback()
    return null
  } catch (error) {
    return error
  }
}

test.group('Benefit redemption validators', () => {
  test('strips unknown request fields and normalizes small token padding', async ({ assert }) => {
    const canonicalToken = `AQ.${'A'.repeat(43)}`

    assert.deepEqual(
      await benefitPresentationRequestValidator.validate({
        access_id: 10,
        offer_id: 20,
        ignored_transport_metadata: true,
      }),
      { access_id: 10, offer_id: 20 }
    )
    assert.deepEqual(
      await benefitPresentationTokenValidator.validate({
        token: ` ${canonicalToken} `,
        ignored_transport_metadata: true,
      }),
      { token: canonicalToken }
    )
  })

  test('checks the raw token length before trimming surrounding whitespace', async ({ assert }) => {
    const canonicalToken = `AQ.${'A'.repeat(43)}`
    const rawOversizedToken = `${' '.repeat(513 - canonicalToken.length)}${canonicalToken}`
    const failure = await captureFailure(() =>
      benefitPresentationTokenValidator.validate({ token: rawOversizedToken })
    )

    assert.lengthOf(rawOversizedToken, 513)
    assert.equal((failure as { code?: string })?.code, 'E_VALIDATION_ERROR')
    assert.deepInclude((failure as { messages?: unknown[] }).messages?.[0], {
      field: 'token',
      rule: 'maxLength',
    })
  })

  test('rejects non-canonical base64url pad-bit aliases', async ({ assert }) => {
    const canonicalPayload = 'AQ'
    const payloadAlias = 'AR'
    const canonicalSignature = 'A'.repeat(43)
    const signatureAlias = `${'A'.repeat(42)}B`

    assert.isTrue(
      Buffer.from(canonicalPayload, 'base64url').equals(Buffer.from(payloadAlias, 'base64url'))
    )
    assert.isTrue(
      Buffer.from(canonicalSignature, 'base64url').equals(Buffer.from(signatureAlias, 'base64url'))
    )

    for (const token of [
      `${payloadAlias}.${canonicalSignature}`,
      `${canonicalPayload}.${signatureAlias}`,
    ]) {
      const failure = await captureFailure(() =>
        benefitPresentationTokenValidator.validate({ token })
      )
      assert.equal((failure as { code?: string })?.code, 'E_VALIDATION_ERROR')
      assert.deepInclude((failure as { messages?: unknown[] }).messages?.[0], {
        field: 'token',
        rule: 'regex',
      })
    }
  })
})
