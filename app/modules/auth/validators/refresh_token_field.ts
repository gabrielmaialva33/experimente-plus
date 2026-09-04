import vine from '@vinejs/vine'

import { REFRESH_TOKEN_LENGTH, REFRESH_TOKEN_PATTERN } from '#modules/auth/utils/refresh_token'

/**
 * Do not trim opaque credentials. Whitespace changes the credential and must
 * be rejected instead of being normalized silently.
 */
export function refreshTokenField() {
  return vine.string().fixedLength(REFRESH_TOKEN_LENGTH).regex(REFRESH_TOKEN_PATTERN)
}
