import { BaseSeeder } from '@adonisjs/lucid/seeders'

import City from '#modules/geography/models/city'
import Region from '#modules/geography/models/region'
import IRole from '#modules/roles/interfaces/role_interface'
import Role from '#modules/roles/models/role'
import Category from '#modules/taxonomy/models/category'
import CategoryFamily from '#modules/taxonomy/models/category_family'
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

    const region = await Region.updateOrCreate(
      { tenant_id: tenant.id, slug: 'norte-do-parana' },
      {
        tenant_id: tenant.id,
        name: 'Norte do Paraná',
        slug: 'norte-do-parana',
        description: 'Região demonstrativa para desenvolvimento local.',
        sort_order: 0,
        is_active: true,
      }
    )

    await City.updateOrCreate(
      { tenant_id: tenant.id, slug: 'cornelio-procopio' },
      {
        tenant_id: tenant.id,
        region_id: region.id,
        name: 'Cornélio Procópio',
        slug: 'cornelio-procopio',
        state_code: 'PR',
        country_code: 'BR',
        ibge_code: null,
        timezone: 'America/Sao_Paulo',
        latitude: null,
        longitude: null,
        sort_order: 0,
        is_active: true,
      }
    )

    await City.updateOrCreate(
      { tenant_id: tenant.id, slug: 'londrina' },
      {
        tenant_id: tenant.id,
        region_id: region.id,
        name: 'Londrina',
        slug: 'londrina',
        state_code: 'PR',
        country_code: 'BR',
        ibge_code: null,
        timezone: 'America/Sao_Paulo',
        latitude: null,
        longitude: null,
        sort_order: 10,
        is_active: true,
      }
    )

    await City.updateOrCreate(
      { tenant_id: tenant.id, slug: 'bandeirantes' },
      {
        tenant_id: tenant.id,
        region_id: region.id,
        name: 'Bandeirantes',
        slug: 'bandeirantes',
        state_code: 'PR',
        country_code: 'BR',
        ibge_code: null,
        timezone: 'America/Sao_Paulo',
        latitude: null,
        longitude: null,
        sort_order: 20,
        is_active: true,
      }
    )

    const foodFamily = await CategoryFamily.updateOrCreate(
      { tenant_id: tenant.id, slug: 'comer-e-beber' },
      {
        tenant_id: tenant.id,
        name: 'Comer & Beber',
        slug: 'comer-e-beber',
        description: 'Gastronomia e experiências para comer e beber.',
        icon: 'utensils',
        sort_order: 0,
        is_active: true,
      }
    )

    const categories = [
      ['Restaurantes', 'restaurantes', 'utensils'],
      ['Bares', 'bares', 'glass-water'],
      ['Cafés', 'cafes', 'coffee'],
      ['Padarias', 'padarias', 'croissant'],
      ['Docerias', 'docerias', 'cake-slice'],
    ] as const

    for (const [name, slug, icon] of categories) {
      await Category.updateOrCreate(
        { tenant_id: tenant.id, slug },
        {
          tenant_id: tenant.id,
          family_id: foodFamily.id,
          parent_id: null,
          name,
          slug,
          description: null,
          icon,
          sort_order: categories.findIndex((category) => category[1] === slug) * 10,
          is_active: true,
        }
      )
    }

    await seedDevelopmentEstablishments(tenant, user)
  }
}
