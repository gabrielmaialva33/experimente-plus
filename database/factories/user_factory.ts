import factory from '@adonisjs/lucid/factories'
import type { FactoryContextContract } from '@adonisjs/lucid/types/factory'
import hash from '@adonisjs/core/services/hash'

import { emailFor, personName } from '#database/factories/support/pt_br'
import IRole from '#modules/roles/interfaces/role_interface'
import Role from '#modules/roles/models/role'
import User from '#modules/users/models/user'

/**
 * A person with a pt-BR name and a unique `example.test` address. Every user
 * gets the regular `user` role, as a public registration would; the `deleted`
 * state is the soft deletion accounts actually go through.
 */
export const UserFactory = factory
  .define(User, async ({ faker }: FactoryContextContract) => {
    const fullName = personName(faker)
    return {
      full_name: fullName,
      email: emailFor(faker, fullName),
      password: await hash.make(faker.internet.password()),
    }
  })
  .state('deleted', (user) => {
    user.is_deleted = true
  })
  .after('create', async (_builder, user, context) => {
    const defaultRole = await Role.query(context.$trx ? { client: context.$trx } : undefined)
      .where('slug', IRole.Slugs.USER)
      .first()
    if (defaultRole) {
      await user.related('roles').attach([defaultRole.id], context.$trx)
    }
  })
  .build()
