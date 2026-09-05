import { test } from '@japa/runner'

import {
  credentialVersionMatches,
  isValidCredentialVersion,
  MAX_CREDENTIAL_VERSION,
} from '#shared/jwt/credential_version'

test.group('JWT credential version', () => {
  test('accepts only positive PostgreSQL int4 generations', ({ assert }) => {
    assert.isTrue(isValidCredentialVersion(1))
    assert.isTrue(isValidCredentialVersion(MAX_CREDENTIAL_VERSION))

    for (const invalid of [
      undefined,
      null,
      '1',
      0,
      -1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      MAX_CREDENTIAL_VERSION + 1,
    ]) {
      assert.isFalse(isValidCredentialVersion(invalid))
    }
  })

  test('matches only equal canonical generations', ({ assert }) => {
    assert.isTrue(credentialVersionMatches(7, 7))
    assert.isFalse(credentialVersionMatches(7, 8))
    assert.isFalse(credentialVersionMatches(undefined, 1))
    assert.isFalse(credentialVersionMatches(1, undefined))
  })
})
