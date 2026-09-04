/**
 * Password reset credentials are 48 random bytes encoded as unpadded
 * base64url. Since 48 is divisible by three, every canonical encoding has
 * exactly 64 characters and no final pad-bit restriction is necessary.
 */
export const PASSWORD_RESET_TOKEN_BYTES = 48
export const PASSWORD_RESET_TOKEN_LENGTH = 64
export const PASSWORD_RESET_TOKEN_PATTERN = /^[A-Za-z0-9_-]{64}$/

export function isCanonicalPasswordResetToken(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length === PASSWORD_RESET_TOKEN_LENGTH &&
    PASSWORD_RESET_TOKEN_PATTERN.test(value)
  )
}
