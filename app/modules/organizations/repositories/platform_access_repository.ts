import type User from '#modules/users/models/user'

/**
 * The platform roles an actor holds: the access source that sits beside
 * organization membership in the organization policy.
 */
export default class PlatformAccessRepository {
  async listRoleSlugs(actor: User, slugs: readonly string[]): Promise<string[]> {
    const roles = await actor
      .related('roles')
      .query()
      .whereIn('roles.slug', [...slugs])
      .select('roles.slug')

    return roles.map((role) => role.slug)
  }
}
