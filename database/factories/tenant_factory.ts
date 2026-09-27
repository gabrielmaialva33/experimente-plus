import factory from '@adonisjs/lucid/factories'
import { type FactoryContextContract } from '@adonisjs/lucid/types/factory'

import { asciiSlug } from '#database/factories/support/pt_br'
import Tenant from '#modules/tenants/models/tenant'

const OPERATIONS = ['Norte do Paraná', 'Norte Pioneiro', 'Vale do Ivaí', 'Região de Maringá']

/** An operation. The slug is what the public resolver matches through the hostname. */
export const TenantFactory = factory
  .define(Tenant, async ({ faker }: FactoryContextContract) => {
    const name = `Experimente ${faker.helpers.arrayElement(OPERATIONS)}`
    return {
      name,
      slug: `${asciiSlug(name)}-${faker.string.alphanumeric(6).toLowerCase()}`,
      is_active: true,
    }
  })
  .state('inactive', (tenant) => {
    tenant.is_active = false
  })
  .build()
