export const MAX_CREDENTIAL_VERSION = 2_147_483_647

/** JWT credential generations are positive PostgreSQL int4 values. */
export function isValidCredentialVersion(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value > 0 &&
    value <= MAX_CREDENTIAL_VERSION
  )
}

export function credentialVersionMatches(
  claimedVersion: unknown,
  currentVersion: unknown
): boolean {
  return (
    isValidCredentialVersion(claimedVersion) &&
    isValidCredentialVersion(currentVersion) &&
    claimedVersion === currentVersion
  )
}
