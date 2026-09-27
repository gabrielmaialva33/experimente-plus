import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

import IRole from '#modules/roles/interfaces/role_interface'
import type Tenant from '#modules/tenants/models/tenant'
import type User from '#modules/users/models/user'
import {
  addOrganizationMember,
  createOperation,
  createOrganization,
  createUser,
} from '#tests/functional/organizations/helpers'

function parseSharedAuth(response: { text(): string }) {
  const match = response
    .text()
    .match(/<script data-page="app" type="application\/json">([\s\S]*?)<\/script>/)
  if (!match?.[1]) {
    throw new Error('The response does not contain an Inertia page payload')
  }

  return (JSON.parse(match[1]) as { props: { auth: Record<string, unknown> } }).props.auth
}

type PortalActions = {
  redemptions: { read: boolean; validate: boolean }
  analytics: { read: boolean }
  establishments: { read: boolean }
  team: { read: boolean; manage: boolean }
}

async function roleScenario(prefix: string) {
  const tenant = await createOperation(prefix)
  const owner = await createUser({ prefix: `${prefix}-owner`, tenant })
  const organization = await createOrganization({
    tenant,
    owner,
    status: 'active',
    prefix: 'Menu',
  })
  const users = {
    owner,
    admin: await createUser({ prefix: `${prefix}-admin`, tenant }),
    editor: await createUser({ prefix: `${prefix}-editor`, tenant }),
    analyst: await createUser({ prefix: `${prefix}-analyst`, tenant }),
  }
  for (const role of ['admin', 'editor', 'analyst'] as const) {
    await addOrganizationMember({ tenant, organization, user: users[role], role })
  }

  return { tenant, organization, users }
}

/**
 * The audit found the Portal menu filtered only by global permissions: an
 * editor was offered "Desempenho" and bounced, an analyst was offered
 * "Validar benefício" and refused. The shared `auth.portalActions` now
 * carries what the organization role allows.
 */
test.group('Portal menu by organization role', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('shares the Portal actions each organization role allows', async ({ client, assert }) => {
    const { tenant, users } = await roleScenario('menu-actions')
    const nobody = await createUser({ prefix: 'menu-actions-none', tenant })
    const platformAdmin = await createUser({
      prefix: 'menu-actions-platform',
      tenant,
      globalRole: IRole.Slugs.ADMIN,
    })

    const menuOf = async (user: User) => {
      const response = await client
        .get('/settings')
        .header('x-tenant-id', String(tenant.id))
        .loginAs(user)
      response.assertStatus(200)
      const actions = parseSharedAuth(response).portalActions as PortalActions
      return {
        validate: actions.redemptions.validate,
        redemptions: actions.redemptions.read,
        places: actions.establishments.read,
        performance: actions.analytics.read,
        team: actions.team.manage,
      }
    }

    const everything = {
      validate: true,
      redemptions: true,
      places: true,
      performance: true,
      team: true,
    }
    assert.deepEqual(await menuOf(users.owner), everything)
    assert.deepEqual(await menuOf(users.admin), everything)
    assert.deepEqual(await menuOf(platformAdmin), everything)
    assert.deepEqual(await menuOf(users.editor), {
      validate: true,
      redemptions: true,
      places: true,
      performance: false,
      team: false,
    })
    assert.deepEqual(await menuOf(users.analyst), {
      validate: false,
      redemptions: true,
      places: true,
      performance: true,
      team: false,
    })
    assert.deepEqual(await menuOf(nobody), {
      validate: false,
      redemptions: false,
      places: false,
      performance: false,
      team: false,
    })
  })

  test('shares no Portal actions without an active operation', async ({ client, assert }) => {
    const loner = await createUser({ prefix: 'menu-actions-loner' })

    const response = await client.get('/settings').loginAs(loner)
    response.assertStatus(200)

    assert.isNull(parseSharedAuth(response).portalActions)
  })

  test('explains the landing when a role without analytics opens Desempenho', async ({
    client,
    assert,
  }) => {
    const { tenant, organization, users } = await roleScenario('menu-performance')
    const headers = (value: Tenant) => ({ 'x-tenant-id': String(value.id) })

    const performance = await client
      .get('/portal/performance')
      .headers(headers(tenant))
      .redirects(0)
      .loginAs(users.editor)
    performance.assertStatus(302)
    assert.equal(performance.header('location'), '/portal')
    performance.assertFlashMessage(
      'warning',
      'O desempenho fica disponível para proprietários, administradores e analistas da organização.'
    )

    const staleLink = await client
      .get(`/organizations/${organization.id}/analytics`)
      .headers(headers(tenant))
      .redirects(0)
      .loginAs(users.editor)
    staleLink.assertStatus(302)
    assert.equal(staleLink.header('location'), `/portal/organizations/${organization.id}`)
    staleLink.assertFlashMessage(
      'warning',
      'O desempenho fica disponível para proprietários, administradores e analistas da organização.'
    )

    const analyst = await client
      .get(`/organizations/${organization.id}/analytics`)
      .headers(headers(tenant))
      .loginAs(users.analyst)
    analyst.assertStatus(200)
  })
})
