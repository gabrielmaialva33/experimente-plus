import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'

import JwtAuthTokensService from '#modules/auth/services/jwt_auth_tokens_service'
import type IOrganization from '#modules/organizations/interfaces/organization_interface'
import {
  addOrganizationMember,
  createOperation,
  createOrganization,
  createUser,
} from '#tests/functional/organizations/helpers'
import IRole from '#modules/roles/interfaces/role_interface'

test.group('Authenticated mobile context', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('returns an exact allowlisted consumer context for the active operation', async ({
    client,
    assert,
  }) => {
    const operation = await createOperation('mobile-consumer')
    const consumer = await createUser({ prefix: 'mobile-consumer', tenant: operation })

    const response = await client.get('/api/v1/me/context').loginAs(consumer)

    response.assertStatus(200)
    response.assertHeader('cache-control', 'private, no-store')
    response.assertHeader('x-robots-tag', 'noindex, nofollow')
    response.assertHeader('referrer-policy', 'no-referrer')
    response.assertHeader('x-ratelimit-limit', '100')
    assert.deepEqual(response.body(), {
      user: {
        id: consumer.id,
        full_name: consumer.full_name,
        email: consumer.email,
        username: consumer.username,
        email_verified: false,
        email_verified_at: null,
      },
      active_operation: {
        id: operation.id,
        name: operation.name,
        slug: operation.slug,
      },
      operations: [
        {
          id: operation.id,
          name: operation.name,
          slug: operation.slug,
          role: 'member',
          is_current: true,
        },
      ],
      capabilities: {
        consumer: { wallet: { read: true } },
        partner: {
          enabled: false,
          redemptions: { read: false, validate: false },
        },
        platform_access: null,
      },
    })
  })

  test('projects owner and editor validation while keeping analysts read-only', async ({
    client,
    assert,
  }) => {
    const operation = await createOperation('mobile-organization-roles')
    const organization = await createOrganization({ tenant: operation, owner: null })
    const cases: Array<{
      role: IOrganization.Role
      read: boolean
      validate: boolean
    }> = [
      { role: 'owner', read: true, validate: true },
      { role: 'editor', read: true, validate: true },
      { role: 'analyst', read: true, validate: false },
    ]

    for (const expected of cases) {
      const actor = await createUser({
        prefix: `mobile-${expected.role}`,
        tenant: operation,
      })
      await addOrganizationMember({
        tenant: operation,
        organization,
        user: actor,
        role: expected.role,
      })

      const response = await client.get('/api/v1/me/context').loginAs(actor)
      response.assertStatus(200)
      assert.deepEqual(response.body().capabilities, {
        consumer: { wallet: { read: true } },
        partner: {
          enabled: true,
          redemptions: { read: expected.read, validate: expected.validate },
        },
        platform_access: null,
      })
    }
  })

  test('does not infer partner access from moderation and preserves hybrid membership', async ({
    client,
    assert,
  }) => {
    const operation = await createOperation('mobile-moderator')
    const organization = await createOrganization({ tenant: operation, owner: null })
    const moderator = await createUser({
      prefix: 'mobile-moderator-only',
      tenant: operation,
      globalRole: IRole.Slugs.MODERATOR,
    })
    const hybrid = await createUser({
      prefix: 'mobile-moderator-hybrid',
      tenant: operation,
      globalRole: IRole.Slugs.MODERATOR,
    })
    await addOrganizationMember({
      tenant: operation,
      organization,
      user: hybrid,
      role: 'editor',
    })

    const moderatorResponse = await client.get('/api/v1/me/context').loginAs(moderator)
    moderatorResponse.assertStatus(200)
    assert.deepEqual(moderatorResponse.body().capabilities.partner, {
      enabled: false,
      redemptions: { read: false, validate: false },
    })
    assert.equal(moderatorResponse.body().capabilities.platform_access, 'platform_moderator')

    const hybridResponse = await client.get('/api/v1/me/context').loginAs(hybrid)
    hybridResponse.assertStatus(200)
    assert.deepEqual(hybridResponse.body().capabilities.partner, {
      enabled: true,
      redemptions: { read: true, validate: true },
    })
    assert.equal(hybridResponse.body().capabilities.platform_access, 'platform_moderator')
  })

  test('preserves operation-wide redemption access without inventing Root or Admin partnership', async ({
    client,
    assert,
  }) => {
    const operation = await createOperation('mobile-platform-admin')

    for (const globalRole of [IRole.Slugs.ROOT, IRole.Slugs.ADMIN]) {
      const actor = await createUser({
        prefix: `mobile-${globalRole}`,
        tenant: operation,
        globalRole,
      })

      const response = await client.get('/api/v1/me/context').loginAs(actor)
      response.assertStatus(200)
      assert.deepEqual(response.body().capabilities, {
        consumer: { wallet: { read: true } },
        partner: {
          enabled: false,
          redemptions: { read: true, validate: true },
        },
        platform_access: 'platform_admin',
      })
    }
  })

  test('recognizes Root and Admin as partners only when they also have an active membership', async ({
    client,
    assert,
  }) => {
    const operation = await createOperation('mobile-platform-partner')
    const organization = await createOrganization({ tenant: operation, owner: null })

    for (const globalRole of [IRole.Slugs.ROOT, IRole.Slugs.ADMIN]) {
      const actor = await createUser({
        prefix: `mobile-${globalRole}-partner`,
        tenant: operation,
        globalRole,
      })
      await addOrganizationMember({
        tenant: operation,
        organization,
        user: actor,
        role: 'analyst',
      })

      const response = await client.get('/api/v1/me/context').loginAs(actor)
      response.assertStatus(200)
      assert.deepEqual(response.body().capabilities, {
        consumer: { wallet: { read: true } },
        partner: {
          enabled: true,
          redemptions: { read: true, validate: true },
        },
        platform_access: 'platform_admin',
      })
    }
  })

  test('uses and revalidates token selection and the explicit operation override', async ({
    client,
    assert,
  }) => {
    const operationA = await createOperation('mobile-token-a')
    const operationB = await createOperation('mobile-token-b')
    const foreignOperation = await createOperation('mobile-token-foreign')
    const actor = await createUser({ prefix: 'mobile-token-actor', tenant: operationA })
    await actor.related('tenants').attach({ [operationB.id]: { role: 'owner' } })

    const tokensService = await app.container.make(JwtAuthTokensService)
    const tokens = await tokensService.run({ userId: actor.id, tenantId: operationA.id })

    const selected = await client.get('/api/v1/me/context').bearerToken(tokens.access_token)
    selected.assertStatus(200)
    assert.equal(selected.body().active_operation.id, operationA.id)
    assert.deepEqual(
      selected.body().operations.map((operation: { id: number; is_current: boolean }) => ({
        id: operation.id,
        is_current: operation.is_current,
      })),
      [
        { id: operationA.id, is_current: true },
        { id: operationB.id, is_current: false },
      ]
    )

    const overridden = await client
      .get('/api/v1/me/context')
      .bearerToken(tokens.access_token)
      .header('x-tenant-id', String(operationB.id))
    overridden.assertStatus(200)
    assert.equal(overridden.body().active_operation.id, operationB.id)

    const foreignOverride = await client
      .get('/api/v1/me/context')
      .bearerToken(tokens.access_token)
      .header('x-tenant-id', String(foreignOperation.id))
    foreignOverride.assertStatus(403)

    await actor.related('tenants').detach([operationA.id])
    const staleClaim = await client.get('/api/v1/me/context').bearerToken(tokens.access_token)
    staleClaim.assertStatus(403)
  })

  test('requires authentication and an active operation', async ({ client }) => {
    const anonymous = await client.get('/api/v1/me/context')
    anonymous.assertStatus(401)

    const actor = await createUser({ prefix: 'mobile-without-operation' })
    const withoutOperation = await client.get('/api/v1/me/context').loginAs(actor)
    withoutOperation.assertStatus(400)
  })
})
