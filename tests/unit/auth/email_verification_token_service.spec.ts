import { test } from '@japa/runner'

import EmailVerificationTokenService from '#modules/auth/services/email_verification_token_service'
import {
  EMAIL_VERIFICATION_TOKEN_BYTES,
  EMAIL_VERIFICATION_TOKEN_LENGTH,
  isCanonicalEmailVerificationToken,
} from '#modules/auth/utils/email_verification_token'

test.group('EmailVerificationTokenService', () => {
  test('generates canonical 32-byte base64url credentials', ({ assert }) => {
    const service = new EmailVerificationTokenService()

    for (let sample = 0; sample < 64; sample++) {
      const { token, tokenHash } = service.generate()

      assert.lengthOf(token, EMAIL_VERIFICATION_TOKEN_LENGTH)
      assert.lengthOf(Buffer.from(token, 'base64url'), EMAIL_VERIFICATION_TOKEN_BYTES)
      assert.isTrue(isCanonicalEmailVerificationToken(token))
      assert.match(tokenHash, /^[0-9a-f]{64}$/)
    }
  })

  test('rejects non-canonical encodings without normalizing them', ({ assert }) => {
    const canonical = `${'A'.repeat(42)}A`

    assert.isTrue(isCanonicalEmailVerificationToken(canonical))
    assert.isFalse(isCanonicalEmailVerificationToken(` ${canonical}`))
    assert.isFalse(isCanonicalEmailVerificationToken(`${canonical} `))
    assert.isFalse(isCanonicalEmailVerificationToken(`${canonical}=`))
    assert.isFalse(isCanonicalEmailVerificationToken(`${'A'.repeat(42)}B`))
    assert.isFalse(isCanonicalEmailVerificationToken(`${'A'.repeat(42)}+`))
  })
})
