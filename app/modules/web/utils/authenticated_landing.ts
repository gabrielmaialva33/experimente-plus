import type User from '#modules/users/models/user'
import OrganizationMember from '#modules/organizations/models/organization_member'
import IRole from '#modules/roles/interfaces/role_interface'

export type AuthenticatedLandingPath =
  '/dashboard' | '/backoffice/moderation' | '/portal' | '/wallet' | '/cidades'

type AuthenticatedLandingContext = {
  activeTenantId?: number | null
  hasActiveOrganizationMembership?: boolean
  roleSlugs?: readonly string[]
}

/**
 * Returns one of the application's closed, server-authorized landing routes.
 * Partner access deliberately comes from an organization membership, never
 * from a global role or a broad permission such as `dashboard.read`.
 */
export function authenticatedLandingPath({
  activeTenantId,
  hasActiveOrganizationMembership = false,
  roleSlugs = [],
}: AuthenticatedLandingContext): AuthenticatedLandingPath {
  if (!activeTenantId) return '/cidades'

  const roles = new Set(roleSlugs)
  if (roles.has(IRole.Slugs.ROOT) || roles.has(IRole.Slugs.ADMIN)) {
    return '/dashboard'
  }

  if (roles.has(IRole.Slugs.MODERATOR)) {
    return '/backoffice/moderation'
  }

  if (hasActiveOrganizationMembership) {
    return '/portal'
  }

  return '/wallet'
}

export async function resolveAuthenticatedLandingPath(
  user: User,
  claimedActiveTenantId?: number | null
): Promise<AuthenticatedLandingPath> {
  const activeTenants = await user
    .related('tenants')
    .query()
    .where('tenants.is_active', true)
    .orderBy('tenants.id', 'asc')

  const activeTenantId =
    claimedActiveTenantId && activeTenants.some((tenant) => tenant.id === claimedActiveTenantId)
      ? claimedActiveTenantId
      : activeTenants[0]?.id

  if (!activeTenantId) {
    return authenticatedLandingPath({ activeTenantId: null })
  }

  const roles = await user.related('roles').query().select('roles.slug')
  const activeOrganizationMembership = await OrganizationMember.query()
    .where('tenant_id', activeTenantId)
    .where('user_id', user.id)
    .where('status', 'active')
    .first()

  return authenticatedLandingPath({
    activeTenantId,
    hasActiveOrganizationMembership: Boolean(activeOrganizationMembership),
    roleSlugs: roles.map((role) => role.slug),
  })
}
