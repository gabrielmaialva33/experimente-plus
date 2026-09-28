import factory from '@adonisjs/lucid/factories'

import { PermissionFactory } from '#database/factories/permission_factory'
import { asciiSlug } from '#database/factories/support/pt_br'
import type IRole from '#modules/roles/interfaces/role_interface'
import Role from '#modules/roles/models/role'

const ROLE_NAMES = ['Curadoria regional', 'Atendimento', 'Financeiro', 'Parcerias'] as const

/**
 * A custom role. The migrations seed the canonical ones (root, admin,
 * moderator, user, guest); tests that need those look them up by slug. The
 * `papel-` prefix and the random suffix keep this slug out of that set, so the
 * role never dominates another nor grants platform administration
 * (`IRole.isCanonicalSlug` is false for it). `with('permissions', n)` attaches
 * factory permissions through `role_permissions`.
 */
export const RoleFactory = factory
  .define(Role, ({ faker }) => {
    const name = faker.helpers.arrayElement(ROLE_NAMES)
    return {
      name,
      slug: `papel-${asciiSlug(name)}-${faker.string.alphanumeric(6).toLowerCase()}` as IRole.Slugs,
      description: `${name}: papel fictício criado para cenários de teste.`,
    }
  })
  .relation('permissions', () => PermissionFactory)
  .build()
