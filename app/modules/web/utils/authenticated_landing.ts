import IRole from '#modules/roles/interfaces/role_interface'

export type AuthenticatedLandingPath =
  '/backoffice/today' | '/backoffice/moderation' | '/portal' | '/wallet' | '/cidades'

type AuthenticatedLandingContext = {
  activeTenantId?: number | null
  hasActiveOrganizationMembership?: boolean
  roleSlugs?: readonly string[]
}

/**
 * Returns one of the application's closed, server-authorized landing routes.
 * Partner access deliberately comes from an organization membership, never
 * from a global role or a broad permission such as `dashboard.read`.
 *
 * Administrators open on "Hoje", what the operation has to resolve today; the
 * indicator dashboard stays at `/dashboard`, one item away in the sidebar.
 */
export function authenticatedLandingPath({
  activeTenantId,
  hasActiveOrganizationMembership = false,
  roleSlugs = [],
}: AuthenticatedLandingContext): AuthenticatedLandingPath {
  if (!activeTenantId) return '/cidades'

  const roles = new Set(roleSlugs)
  if (roles.has(IRole.Slugs.ROOT) || roles.has(IRole.Slugs.ADMIN)) {
    return '/backoffice/today'
  }

  if (roles.has(IRole.Slugs.MODERATOR)) {
    return '/backoffice/moderation'
  }

  if (hasActiveOrganizationMembership) {
    return '/portal'
  }

  return '/wallet'
}
