export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]*$/

export function canonicalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

export function canonicalizeUsername(value: string): string {
  return value.trim().toLowerCase()
}

export const canonicalizeLoginIdentifier = canonicalizeUsername
