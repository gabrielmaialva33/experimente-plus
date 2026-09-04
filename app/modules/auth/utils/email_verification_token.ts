/**
 * Email verification credentials are 32 random bytes encoded as unpadded
 * base64url. The final character class enforces the zero pad bits required by
 * the canonical encoding, avoiding multiple strings for the same byte value.
 */
export const EMAIL_VERIFICATION_TOKEN_BYTES = 32
export const EMAIL_VERIFICATION_TOKEN_LENGTH = 43
export const EMAIL_VERIFICATION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/

export function isCanonicalEmailVerificationToken(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length === EMAIL_VERIFICATION_TOKEN_LENGTH &&
    EMAIL_VERIFICATION_TOKEN_PATTERN.test(value)
  )
}
