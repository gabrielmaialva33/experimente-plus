import type User from '#modules/users/models/user'

/**
 * The platform roles an actor holds: the access source that sits beside
 * organization membership in the organization policy and in the landing page
 * chosen after sign-in.
 */
export default class PlatformAccessRepository {
  /** Every role slug of the actor, or only those among `slugs` when given. */
  async listRoleSlugs(actor: User, slugs?: readonly string[]): Promise<string[]> {
    const query = actor.related('roles').query()
    if (slugs) {
      query.whereIn('roles.slug', [...slugs])
    }
    const roles = await query.select('roles.slug')

    return roles.map((role) => role.slug)
  }
}
