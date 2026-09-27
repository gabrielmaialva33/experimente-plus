import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

import {
  createOperation,
  createOrganization,
  createUser,
} from '#tests/functional/organizations/helpers'

/**
 * "Desempenho" in the Portal menu opens the organization's analytics, or, with
 * several organizations, the places list where each one has its own link. That
 * landing says so in the address, so its "Ajuda desta página" can open the
 * performance task of the manual instead of the places one.
 */
test.group('Portal performance landing', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('goes straight to the analytics of the only organization', async ({ client, assert }) => {
    const tenant = await createOperation('performance-one')
    const owner = await createUser({ prefix: 'performance-one-owner', tenant })
    const organization = await createOrganization({ tenant, owner, status: 'active' })

    const response = await client
      .get('/portal/performance')
      .header('x-tenant-id', String(tenant.id))
      .redirects(0)
      .loginAs(owner)

    response.assertStatus(302)
    assert.equal(response.header('location'), `/organizations/${organization.id}/analytics`)
  })

  test('marks the places list it opens for several organizations', async ({ client, assert }) => {
    const tenant = await createOperation('performance-many')
    const owner = await createUser({ prefix: 'performance-many-owner', tenant })
    await createOrganization({ tenant, owner, status: 'active', prefix: 'Primeira' })
    await createOrganization({ tenant, owner, status: 'active', prefix: 'Segunda' })

    const response = await client
      .get('/portal/performance')
      .header('x-tenant-id', String(tenant.id))
      .redirects(0)
      .loginAs(owner)

    response.assertStatus(302)
    assert.equal(response.header('location'), '/portal/establishments?para=desempenho')
  })
})
