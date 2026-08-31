import { BaseSeeder } from '@adonisjs/lucid/seeders'

import IRole from '#modules/roles/interfaces/role_interface'
import Role from '#modules/roles/models/role'
import { seedDevelopmentBenefits } from '#database/support/development_benefits'
import { seedDevelopmentCatalog } from '#database/support/development_catalog'
import { seedDevelopmentEstablishments } from '#database/support/development_establishments'
import Tenant from '#modules/tenants/models/tenant'
import User from '#modules/users/models/user'
import env from '#start/env'

export default class extends BaseSeeder {
  static environment = ['development']

  async run() {
    const user = await User.updateOrCreate(
      { email: env.get('DEV_ADMIN_EMAIL', 'admin@experimente.local') },
      {
        full_name: env.get('DEV_ADMIN_NAME', 'Experimente+ Admin'),
        username: env.get('DEV_ADMIN_USERNAME', 'admin'),
        password: env.get('DEV_ADMIN_PASSWORD', 'experimente123'),
        is_deleted: false,
      }
    )

    const rootRole = await Role.findByOrFail('slug', IRole.Slugs.ROOT)
    await user.related('roles').sync([rootRole.id])

    const partner = await User.updateOrCreate(
      { email: env.get('DEV_PARTNER_EMAIL', 'partner@experimente.local') },
      {
        full_name: env.get('DEV_PARTNER_NAME', 'Parceiro Experimente+'),
        username: env.get('DEV_PARTNER_USERNAME', 'partner'),
        password: env.get('DEV_PARTNER_PASSWORD', 'experimente123'),
        is_deleted: false,
      }
    )
    const holder = await User.updateOrCreate(
      { email: env.get('DEV_CUSTOMER_EMAIL', 'cliente@experimente.local') },
      {
        full_name: env.get('DEV_CUSTOMER_NAME', 'Cliente Experimente+'),
        username: env.get('DEV_CUSTOMER_USERNAME', 'cliente'),
        password: env.get('DEV_CUSTOMER_PASSWORD', 'experimente123'),
        is_deleted: false,
      }
    )
    const userRole = await Role.findByOrFail('slug', IRole.Slugs.USER)
    await partner.related('roles').sync([userRole.id])
    await holder.related('roles').sync([userRole.id])

    const tenant = await Tenant.updateOrCreate(
      { slug: 'development' },
      {
        name: env.get('DEV_WORKSPACE_NAME', 'Experimente+ Development'),
        slug: 'development',
        is_active: true,
      }
    )

    await user.related('tenants').sync({
      [tenant.id]: { role: 'owner' },
    })
    await partner.related('tenants').sync({ [tenant.id]: { role: 'member' } })
    await holder.related('tenants').sync({ [tenant.id]: { role: 'member' } })

    await seedDevelopmentCatalog(tenant)
    await seedDevelopmentEstablishments(tenant, user)
    await seedDevelopmentBenefits(tenant, user, partner, holder)
  }
}
