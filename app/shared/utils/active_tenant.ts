type TenantIdentity = {
  id: number
}

export function isValidTenantId(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0
}

/**
 * Resolves the tenant selected by an authenticated access token.
 *
 * An absent claim keeps the legacy deterministic fallback used by tokens
 * issued before tenant selection existed. Once a token explicitly carries a
 * claim, however, it is authoritative: an invalid or inaccessible tenant must
 * not silently select a different operation.
 */
export function resolveActiveTenantId(
  activeTenants: readonly TenantIdentity[],
  claimedTenantId: unknown = undefined
): number | null {
  if (claimedTenantId === undefined) {
    return activeTenants[0]?.id ?? null
  }

  if (
    !isValidTenantId(claimedTenantId) ||
    !activeTenants.some((tenant) => tenant.id === claimedTenantId)
  ) {
    return null
  }

  return Number(claimedTenantId)
}
