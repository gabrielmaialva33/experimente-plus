/**
 * Refresh credentials are 32 random bytes encoded as unpadded base64url.
 *
 * Besides constraining the alphabet and length, the final character class
 * enforces the zero pad bits required by the canonical 32-byte encoding.
 */
export const REFRESH_TOKEN_BYTES = 32
export const REFRESH_TOKEN_LENGTH = 43
export const REFRESH_TOKEN_PATTERN = /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/
export const REFRESH_TOKEN_OPENAPI_PATTERN = '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'

export function isCanonicalRefreshToken(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length === REFRESH_TOKEN_LENGTH &&
    REFRESH_TOKEN_PATTERN.test(value)
  )
}
