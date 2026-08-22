import { BaseSeeder } from '@adonisjs/lucid/seeders'

import IRole from '#modules/roles/interfaces/role_interface'
import Role from '#modules/roles/models/role'
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
  }
}
