import type LucidRepositoryInterface from '#shared/lucid/lucid_repository_interface'
import type Role from '#modules/roles/models/role'

namespace IRole {
  export interface Repository extends LucidRepositoryInterface<typeof Role> {}

  export enum Slugs {
    ROOT = 'root',
    ADMIN = 'admin',
    MODERATOR = 'moderator',
    USER = 'user',
    GUEST = 'guest',
  }

  /**
   * Canonical partial order for platform roles. Entries list every role that
   * the key may dominate. Organization roles are deliberately outside this
   * global hierarchy.
   */
  export const ROLE_HIERARCHY: Readonly<Record<Slugs, readonly Slugs[]>> = {
    [Slugs.ROOT]: [Slugs.ADMIN, Slugs.MODERATOR, Slugs.USER, Slugs.GUEST],
    [Slugs.ADMIN]: [Slugs.MODERATOR, Slugs.USER, Slugs.GUEST],
    [Slugs.MODERATOR]: [Slugs.USER],
    [Slugs.USER]: [Slugs.GUEST],
    [Slugs.GUEST]: [],
  }

  export const CANONICAL_SLUGS = Object.freeze(Object.keys(ROLE_HIERARCHY) as Slugs[])

  export function isCanonicalSlug(slug: string): slug is Slugs {
    return Object.hasOwn(ROLE_HIERARCHY, slug)
  }

  /** ACL boundary for privileged platform mutations, evaluated from fresh roles. */
  export function isPlatformAdministrator(roleSlugs: readonly string[]): boolean {
    return (
      roleSlugs.length > 0 &&
      roleSlugs.every(isCanonicalSlug) &&
      roleSlugs.some((slug) => slug === Slugs.ROOT || slug === Slugs.ADMIN)
    )
  }

  export function dominates(actorRole: string, targetRole: string): boolean {
    if (!isCanonicalSlug(actorRole) || !isCanonicalSlug(targetRole)) {
      return false
    }

    return ROLE_HIERARCHY[actorRole].includes(targetRole)
  }
}

export default IRole
