import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

import IRoles from '#modules/roles/interfaces/role_interface'
import { createEstablishmentScenario } from '#tests/functional/establishments/helpers'
import { createUser } from '#tests/functional/organizations/helpers'

async function admin(prefix: string) {
  const scenario = await createEstablishmentScenario(prefix)
  const user = await createUser({
    prefix: `${prefix}-admin`,
    tenant: scenario.tenant,
    tenantRole: 'admin',
    globalRole: IRoles.Slugs.ADMIN,
  })
  return { user, headers: { 'x-tenant-id': String(scenario.tenant.id) } }
}

/**
 * Validation messages in the web interface are Portuguese — web audit W7.
 *
 * An English browser got "The name field must be defined" inside a Portuguese
 * screen, and even a Portuguese one did, because no translation existed.
 */
test.group('Validation messages language', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('a web form answers in Portuguese whatever the browser prefers', async ({
    client,
    assert,
  }) => {
    const { user, headers } = await admin('locale-web')

    const response = await client
      .post('/backoffice/taxonomy/families')
      .headers({ ...headers, 'accept-language': 'en-US,en;q=0.9' })
      .header('x-inertia', 'true')
      .header('referer', '/backoffice/taxonomy')
      .loginAs(user)
      .withCsrfToken()
      .redirects(0)
      .json({ sort_order: 1 })

    response.assertStatus(302)
    const errors = response.flashMessages().inputErrorsBag as Record<string, string[]>
    assert.deepEqual(errors.name, ['Nome: campo obrigatório.'])
  })

  test('the API keeps the language the client asks for', async ({ client, assert }) => {
    const { user, headers } = await admin('locale-api')

    const english = await client
      .post('/api/v1/admin/taxonomy/families')
      .headers({ ...headers, 'accept-language': 'en' })
      .loginAs(user)
      .json({ sort_order: 1 })
    english.assertStatus(422)
    assert.equal(english.body().errors[0].message, 'The name field must be defined')

    const portuguese = await client
      .post('/api/v1/admin/taxonomy/families')
      .headers({ ...headers, 'accept-language': 'pt-BR' })
      .loginAs(user)
      .json({ sort_order: 1 })
    portuguese.assertStatus(422)
    assert.equal(portuguese.body().errors[0].message, 'Nome: campo obrigatório.')
  })
})
