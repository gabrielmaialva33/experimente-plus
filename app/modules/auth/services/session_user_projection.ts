import type User from '#modules/users/models/user'

export type SessionUserProjection = {
  id: number
  full_name: string
  email: string
  username: string | null
  email_verified: boolean
  email_verified_at: string | null
  created_at: string
  updated_at: string | null
  roles: Array<{
    id: number
    name: string
    description: string | null
    slug: string
    created_at: string
    updated_at: string
  }>
}

/** Keeps session responses stable when the Lucid model gains new columns. */
export function projectSessionUser(user: User): SessionUserProjection {
  return {
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    username: user.username ?? null,
    email_verified: user.email_verified,
    email_verified_at: user.email_verified_at,
    created_at: user.created_at.toISO()!,
    updated_at: user.updated_at?.toISO() ?? null,
    roles: user.roles.map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description,
      slug: role.slug,
      created_at: role.created_at.toISO()!,
      updated_at: role.updated_at.toISO()!,
    })),
  }
}
