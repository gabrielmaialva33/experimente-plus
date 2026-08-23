import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'

import Region from '#modules/geography/models/region'
import Role from '#modules/roles/models/role'
import Tenant from '#modules/tenants/models/tenant'
import User from '#modules/users/models/user'

async function createOperationAdmin() {
  const tenant = await Tenant.create({
    name: 'Public Test Operation',
    slug: 'public-test',
    is_active: true,
  })
  const user = await User.create({
    full_name: 'Geography Admin',
    username: 'geography-admin',
    email: 'geography-admin@example.com',
    password: 'password123',
    is_deleted: false,
  })
  const role = await Role.findByOrFail('slug', 'admin')

  await user.related('roles').sync([role.id])
  await user.related('tenants').sync({ [tenant.id]: { role: 'owner' } })

  return { tenant, user }
}

test.group('Geography', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('admin creates regions and cities that become publicly discoverable', async ({
    client,
    assert,
  }) => {
    const { tenant } = await createOperationAdmin()
    const signInResponse = await client.post('/api/v1/sessions/sign-in').json({
      uid: 'geography-admin@example.com',
      password: 'password123',
    })
    signInResponse.assertStatus(200)
    const accessToken = signInResponse.body().auth.access_token as string

    const regionResponse = await client
      .post('/api/v1/admin/geography/regions')
      .header('Authorization', `Bearer ${accessToken}`)
      .header('x-tenant-id', String(tenant.id))
      .json({ name: 'Norte do Paraná' })
    regionResponse.assertStatus(201)
    assert.equal(regionResponse.body().slug, 'norte-do-parana')

    const cityResponse = await client
      .post('/api/v1/admin/geography/cities')
      .header('Authorization', `Bearer ${accessToken}`)
      .header('x-tenant-id', String(tenant.id))
      .json({
        region_id: regionResponse.body().id,
        name: 'Cornélio Procópio',
        state_code: 'pr',
        timezone: 'America/Sao_Paulo',
      })
    cityResponse.assertStatus(201)
    assert.equal(cityResponse.body().slug, 'cornelio-procopio')
    assert.equal(cityResponse.body().state_code, 'PR')

    const publicResponse = await client.get('/api/v1/catalog/cities')
    publicResponse.assertStatus(200)
    assert.lengthOf(publicResponse.body(), 1)
    assert.equal(publicResponse.body()[0].slug, 'cornelio-procopio')
  })

  test('public geography excludes inactive regions and cities', async ({ client, assert }) => {
    const { tenant } = await createOperationAdmin()
    const activeRegion = await Region.create({
      tenant_id: tenant.id,
      name: 'Ativa',
      slug: 'ativa',
      description: null,
      sort_order: 0,
      is_active: true,
    })
    const inactiveRegion = await Region.create({
      tenant_id: tenant.id,
      name: 'Inativa',
      slug: 'inativa',
      description: null,
      sort_order: 10,
      is_active: false,
    })

    await db.table('cities').multiInsert([
      {
        tenant_id: tenant.id,
        region_id: activeRegion.id,
        name: 'Cidade Ativa',
        slug: 'cidade-ativa',
        state_code: 'PR',
        country_code: 'BR',
        timezone: 'America/Sao_Paulo',
        sort_order: 0,
        is_active: true,
      },
      {
        tenant_id: tenant.id,
        region_id: activeRegion.id,
        name: 'Cidade Inativa',
        slug: 'cidade-inativa',
        state_code: 'PR',
        country_code: 'BR',
        timezone: 'America/Sao_Paulo',
        sort_order: 10,
        is_active: false,
      },
      {
        tenant_id: tenant.id,
        region_id: inactiveRegion.id,
        name: 'Cidade em Região Inativa',
        slug: 'cidade-regiao-inativa',
        state_code: 'PR',
        country_code: 'BR',
        timezone: 'America/Sao_Paulo',
        sort_order: 20,
        is_active: true,
      },
    ])

    const response = await client.get('/api/v1/catalog/cities')
    response.assertStatus(200)
    assert.deepEqual(
      response.body().map((city: { slug: string }) => city.slug),
      ['cidade-ativa']
    )
  })

  test('rejects cross-operation region references at database level', async ({ assert }) => {
    const firstTenant = await Tenant.create({ name: 'First', slug: 'first', is_active: true })
    const secondTenant = await Tenant.create({ name: 'Second', slug: 'second', is_active: true })
    const region = await Region.create({
      tenant_id: firstTenant.id,
      name: 'First Region',
      slug: 'first-region',
      description: null,
      sort_order: 0,
      is_active: true,
    })

    await assert.rejects(() =>
      db.table('cities').insert({
        tenant_id: secondTenant.id,
        region_id: region.id,
        name: 'Invalid City',
        slug: 'invalid-city',
        state_code: 'PR',
        country_code: 'BR',
        timezone: 'America/Sao_Paulo',
        sort_order: 0,
        is_active: true,
      })
    )
  })

  test('rejects partial coordinates and invalid timezones', async ({ client }) => {
    const { tenant } = await createOperationAdmin()
    const region = await Region.create({
      tenant_id: tenant.id,
      name: 'Region',
      slug: 'region',
      description: null,
      sort_order: 0,
      is_active: true,
    })
    const signInResponse = await client.post('/api/v1/sessions/sign-in').json({
      uid: 'geography-admin@example.com',
      password: 'password123',
    })
    const accessToken = signInResponse.body().auth.access_token as string

    const partialCoordinates = await client
      .post('/api/v1/admin/geography/cities')
      .header('Authorization', `Bearer ${accessToken}`)
      .header('x-tenant-id', String(tenant.id))
      .json({
        region_id: region.id,
        name: 'Partial Coordinates',
        state_code: 'PR',
        latitude: -23.18,
      })
    partialCoordinates.assertStatus(400)

    const invalidTimezone = await client
      .post('/api/v1/admin/geography/cities')
      .header('Authorization', `Bearer ${accessToken}`)
      .header('x-tenant-id', String(tenant.id))
      .json({
        region_id: region.id,
        name: 'Invalid Timezone',
        state_code: 'PR',
        timezone: 'Parana/Invalid',
      })
    invalidTimezone.assertStatus(400)
  })
})
