import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'

import IRole from '#modules/roles/interfaces/role_interface'
import User from '#modules/users/models/user'
import { createOperation, createUser } from '#tests/functional/organizations/helpers'

interface TestInertiaPage {
  component: string
  props: Record<string, unknown>
}

function parseInertiaPage(response: { text(): string }): TestInertiaPage {
  const match = response
    .text()
    .match(/<script data-page="app" type="application\/json">([\s\S]*?)<\/script>/)

  if (!match?.[1]) {
    throw new Error('The response does not contain an Inertia page payload')
  }

  return JSON.parse(match[1]) as TestInertiaPage
}

async function operationLinks(userId: number) {
  return db
    .from('user_tenants')
    .where('user_id', userId)
    .select('tenant_id', 'role')
    .orderBy('tenant_id')
}

/**
 * Accounts created in "Pessoas e acesso" used to get the global `user` role
 * and no operation, so they landed on /cidades without a wallet and could
 * not be invited by an organization.
 */
test.group('Back-office accounts and the active operation', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('links an account created in the back office to the operation in use', async ({
    client,
    assert,
  }) => {
    const tenant = await createOperation('backoffice-created')
    const admin = await createUser({
      prefix: 'backoffice-admin',
      tenant,
      globalRole: IRole.Slugs.ADMIN,
    })

    const createPage = parseInertiaPage(
      await client.get('/users/create').header('x-tenant-id', String(tenant.id)).loginAs(admin)
    )
    assert.deepEqual(createPage.props.operation, { id: tenant.id, name: tenant.name })

    const response = await client
      .post('/users')
      .header('x-tenant-id', String(tenant.id))
      .withCsrfToken()
      .redirects(0)
      .loginAs(admin)
      .json({
        full_name: 'Pessoa Criada',
        email: 'pessoa-criada@example.com',
        password: 'password123',
        password_confirmation: 'password123',
      })

    response.assertStatus(302)
    assert.equal(response.header('location'), '/users')
    response.assertFlashMessage(
      'success',
      `Conta de Pessoa Criada criada e vinculada à operação ${tenant.name} como membro.`
    )
    const created = await User.findByOrFail('email', 'pessoa-criada@example.com')
    assert.deepEqual(await operationLinks(created.id), [{ tenant_id: tenant.id, role: 'member' }])

    // With the link, sign-in opens the wallet of that operation.
    const login = await client
      .post('/login')
      .withCsrfToken()
      .redirects(0)
      .json({ uid: 'pessoa-criada@example.com', password: 'password123' })
    login.assertStatus(302)
    assert.equal(login.header('location'), '/wallet')
  })

  test('links an existing account once and never rewrites an existing link', async ({
    client,
    assert,
  }) => {
    const tenant = await createOperation('backoffice-existing')
    const admin = await createUser({
      prefix: 'backoffice-existing-admin',
      tenant,
      globalRole: IRole.Slugs.ADMIN,
    })
    const orphan = await createUser({ prefix: 'backoffice-orphan' })
    const operationOwner = await createUser({
      prefix: 'backoffice-owner',
      tenant,
      tenantRole: 'owner',
    })
    const headers = { 'x-tenant-id': String(tenant.id) }

    const before = parseInertiaPage(
      await client.get(`/users/${orphan.id}/edit`).headers(headers).loginAs(admin)
    )
    assert.deepEqual(before.props.operation, { id: tenant.id, name: tenant.name, linked: false })

    const link = await client
      .post(`/users/${orphan.id}/operation`)
      .headers(headers)
      .withCsrfToken()
      .redirects(0)
      .loginAs(admin)
    link.assertStatus(302)
    assert.equal(link.header('location'), `/users/${orphan.id}/edit`)
    link.assertFlashMessage('success', `Conta vinculada à operação ${tenant.name} como membro.`)
    assert.deepEqual(await operationLinks(orphan.id), [{ tenant_id: tenant.id, role: 'member' }])

    const again = await client
      .post(`/users/${orphan.id}/operation`)
      .headers(headers)
      .withCsrfToken()
      .redirects(0)
      .loginAs(admin)
    again.assertFlashMessage('success', `A conta já estava vinculada à operação ${tenant.name}.`)
    assert.lengthOf(await operationLinks(orphan.id), 1)

    await client
      .post(`/users/${operationOwner.id}/operation`)
      .headers(headers)
      .withCsrfToken()
      .redirects(0)
      .loginAs(admin)
    assert.deepEqual(await operationLinks(operationOwner.id), [
      { tenant_id: tenant.id, role: 'owner' },
    ])

    const after = parseInertiaPage(
      await client.get(`/users/${orphan.id}/edit`).headers(headers).loginAs(admin)
    )
    assert.deepEqual(after.props.operation, { id: tenant.id, name: tenant.name, linked: true })
  })

  test('keeps linking behind the permission to update accounts', async ({ client, assert }) => {
    const tenant = await createOperation('backoffice-forbidden')
    const person = await createUser({ prefix: 'backoffice-plain', tenant })
    const orphan = await createUser({ prefix: 'backoffice-forbidden-orphan' })

    const response = await client
      .post(`/users/${orphan.id}/operation`)
      .header('x-tenant-id', String(tenant.id))
      .withCsrfToken()
      .redirects(0)
      .loginAs(person)
    response.assertStatus(403)
    assert.lengthOf(await operationLinks(orphan.id), 0)
  })
})
