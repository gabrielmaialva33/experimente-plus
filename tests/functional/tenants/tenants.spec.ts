import { randomUUID } from 'node:crypto'

import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import db from '@adonisjs/lucid/services/db'
import type { Assert } from '@japa/assert'
import type { ApiClient, ApiResponse } from '@japa/api-client'
import { test } from '@japa/runner'
import jwt from 'jsonwebtoken'

import RefreshToken from '#modules/auth/models/refresh_token'
import { isCanonicalRefreshToken } from '#modules/auth/utils/refresh_token'
import IRole from '#modules/roles/interfaces/role_interface'
import Role from '#modules/roles/models/role'
import Tenant from '#modules/tenants/models/tenant'
import User from '#modules/users/models/user'
import { JWT_AUDIENCE, JWT_ISSUER } from '#shared/jwt/constants'
import env from '#start/env'

type AuthPair = {
  access_token: string
  refresh_token: string
  token_type: 'Bearer'
  expires_in: number
  refresh_expires_in: number
}

function assertPrivateCredentialResponse(response: ApiResponse): void {
  response.assertHeader('cache-control', 'private, no-store')
  response.assertHeader('pragma', 'no-cache')
  response.assertHeader('x-robots-tag', 'noindex, nofollow')
  response.assertHeader('referrer-policy', 'no-referrer')
}

async function signIn(client: ApiClient, user: User): Promise<AuthPair> {
  const response = await client.post('/api/v1/sessions/sign-in').json({
    uid: user.email,
    password: 'password123',
  })
  response.assertStatus(200)
  assertPrivateCredentialResponse(response)
  return response.body().auth as AuthPair
}

async function createUser(
  values: { email: string; username: string; fullName?: string },
  role?: IRole.Slugs
): Promise<User> {
  const user = await User.create({
    full_name: values.fullName ?? 'Tenant Session User',
    email: values.email,
    username: values.username,
    password: 'password123',
  })

  if (role) {
    const model = await Role.findByOrFail('slug', role)
    await user.related('roles').attach([model.id])
  }

  return user
}

function verifyTenantClaim(accessToken: string): number | undefined {
  const payload = jwt.verify(accessToken, env.get('ACCESS_TOKEN_SECRET', env.get('APP_KEY')), {
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  }) as jwt.JwtPayload & { tenantId?: number }

  return payload.tenantId
}

async function assertSingleRotation(assert: Assert, userId: number): Promise<void> {
  const records = await RefreshToken.query().where('user_id', userId).orderBy('id', 'asc')
  assert.lengthOf(records, 2)
  assert.isNotNull(records[0].revoked_at)
  assert.isNull(records[1].revoked_at)
  assert.equal(records[1].rotated_from_id, records[0].id)
}

test.group('Tenants', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(async () => {
    await limiter.clear()
    return () => limiter.clear()
  })

  test('POST / atomically creates an operation and rotates a bound refresh credential', async ({
    client,
    assert,
  }) => {
    const user = await createUser(
      {
        email: 'workspace-creator@example.com',
        username: 'workspace-creator',
        fullName: 'Workspace Creator',
      },
      IRole.Slugs.ADMIN
    )
    const originalAuth = await signIn(client, user)

    const response = await client
      .post('/api/v1/tenants')
      .bearerToken(originalAuth.access_token)
      .json({ name: 'Creator Workspace', refresh_token: originalAuth.refresh_token })

    response.assertStatus(201)
    assertPrivateCredentialResponse(response)
    assert.equal(response.body().tenant.name, 'Creator Workspace')
    assert.equal(response.body().tenant.role, 'owner')
    assert.deepInclude(response.body().auth, {
      token_type: 'Bearer',
      expires_in: 900,
      refresh_expires_in: 259200,
    })
    assert.isTrue(isCanonicalRefreshToken(response.body().auth.refresh_token))

    const tenant = await Tenant.findOrFail(response.body().tenant.id)
    const members = await tenant.related('users').query()
    assert.lengthOf(members, 1)
    assert.equal(members[0].id, user.id)
    assert.equal(members[0].$extras.pivot_role, 'owner')
    assert.equal(verifyTenantClaim(response.body().auth.access_token), tenant.id)
    await assertSingleRotation(assert, user.id)
  })

  test('POST / denies operation creation without permission and preserves the refresh token', async ({
    client,
    assert,
  }) => {
    const user = await createUser(
      {
        email: 'consumer-no-operation@example.com',
        username: 'consumer-no-operation',
      },
      IRole.Slugs.USER
    )
    const auth = await signIn(client, user)

    const response = await client
      .post('/api/v1/tenants')
      .bearerToken(auth.access_token)
      .json({ name: 'Unauthorized operation', refresh_token: auth.refresh_token })

    response.assertStatus(403)
    assertPrivateCredentialResponse(response)
    assert.isNull(await Tenant.findBy('name', 'Unauthorized operation'))
    const stored = await RefreshToken.query().where('user_id', user.id).firstOrFail()
    assert.isNull(stored.revoked_at)
  })

  test('GET /me lists tenant memberships using a real access JWT', async ({ client, assert }) => {
    const user = await createUser({ email: 'owner@example.com', username: 'owner' })
    const tenantA = await Tenant.create({ name: 'Alpha', slug: 'alpha', is_active: true })
    const tenantB = await Tenant.create({ name: 'Beta', slug: 'beta', is_active: true })
    await user.related('tenants').attach({
      [tenantA.id]: { role: 'owner' },
      [tenantB.id]: { role: 'member' },
    })
    const auth = await signIn(client, user)

    const response = await client.get('/api/v1/tenants/me').bearerToken(auth.access_token)

    response.assertStatus(200)
    const body = response.body() as { data: Array<{ id: number; slug: string; role: string }> }
    assert.lengthOf(body.data, 2)
    assert.equal(body.data.find((tenant) => tenant.slug === 'alpha')?.role, 'owner')
    assert.equal(body.data.find((tenant) => tenant.slug === 'beta')?.role, 'member')
  })

  test('POST /switch rotates once and scopes both child credentials to the target tenant', async ({
    client,
    assert,
  }) => {
    const user = await createUser({ email: 'switch@example.com', username: 'switcher' })
    const tenantA = await Tenant.create({ name: 'Alpha', slug: 'alpha', is_active: true })
    const tenantB = await Tenant.create({ name: 'Beta', slug: 'beta', is_active: true })
    await user.related('tenants').attach({
      [tenantA.id]: { role: 'owner' },
      [tenantB.id]: { role: 'member' },
    })
    const originalAuth = await signIn(client, user)

    const response = await client
      .post('/api/v1/tenants/switch')
      .bearerToken(originalAuth.access_token)
      .json({ tenant_id: tenantB.id, refresh_token: originalAuth.refresh_token })

    response.assertStatus(200)
    assertPrivateCredentialResponse(response)
    const body = response.body() as { tenant: { id: number; role: string }; auth: AuthPair }
    assert.equal(body.tenant.id, tenantB.id)
    assert.equal(body.tenant.role, 'member')
    assert.equal(verifyTenantClaim(body.auth.access_token), tenantB.id)
    assert.notEqual(body.auth.refresh_token, originalAuth.refresh_token)
    await assertSingleRotation(assert, user.id)

    const replay = await client
      .post('/api/v1/tenants/switch')
      .bearerToken(originalAuth.access_token)
      .json({ tenant_id: tenantA.id, refresh_token: originalAuth.refresh_token })
    replay.assertStatus(401)
    assertPrivateCredentialResponse(replay)
    replay.assertBody({ status: 401, message: 'Invalid or expired refresh token' })
  })

  test('requires a canonical refresh credential on both tenant mutation endpoints', async ({
    client,
  }) => {
    const user = await createUser(
      { email: 'tenant-validation@example.com', username: 'tenant-validation' },
      IRole.Slugs.ADMIN
    )
    const target = await Tenant.create({
      name: 'Validation Target',
      slug: 'validation-target',
      is_active: true,
    })
    await user.related('tenants').attach({ [target.id]: { role: 'owner' } })
    const auth = await signIn(client, user)

    const missingRequests = [
      client
        .post('/api/v1/tenants')
        .bearerToken(auth.access_token)
        .json({ name: 'Missing Refresh' }),
      client
        .post('/api/v1/tenants/switch')
        .bearerToken(auth.access_token)
        .json({ tenant_id: target.id }),
    ]
    for (const request of missingRequests) {
      const response = await request
      response.assertStatus(422)
      assertPrivateCredentialResponse(response)
      response.assertBodyContains({ errors: [{ field: 'refresh_token', rule: 'required' }] })
    }

    const malformedTokens = [
      'A'.repeat(42),
      `${auth.refresh_token}=`,
      ` ${auth.refresh_token}`,
      `${auth.refresh_token} `,
      `${'A'.repeat(42)}B`,
    ]
    for (const refreshToken of malformedTokens) {
      const malformedRequests = [
        client
          .post('/api/v1/tenants')
          .bearerToken(auth.access_token)
          .unsafeJson(JSON.stringify({ name: 'Malformed Refresh', refresh_token: refreshToken })),
        client
          .post('/api/v1/tenants/switch')
          .bearerToken(auth.access_token)
          .unsafeJson(JSON.stringify({ tenant_id: target.id, refresh_token: refreshToken })),
      ]
      for (const request of malformedRequests) {
        const response = await request
        response.assertStatus(422)
        assertPrivateCredentialResponse(response)
        response.assertBodyContains({ errors: [{ field: 'refresh_token' }] })
      }
    }
  })

  test('requires canonical application/json on both tenant mutation endpoints', async ({
    client,
    assert,
  }) => {
    const user = await createUser(
      { email: 'tenant-media-type@example.com', username: 'tenant-media-type' },
      IRole.Slugs.ADMIN
    )
    const target = await Tenant.create({
      name: 'Media Type Target',
      slug: 'media-type-target',
      is_active: true,
    })
    await user.related('tenants').attach({ [target.id]: { role: 'owner' } })
    const auth = await signIn(client, user)
    const paths = [
      {
        path: '/api/v1/tenants',
        body: { name: 'Rejected Media Type', refresh_token: auth.refresh_token },
      },
      {
        path: '/api/v1/tenants/switch',
        body: { tenant_id: target.id, refresh_token: auth.refresh_token },
      },
    ]

    for (const { path, body } of paths) {
      const responses = [
        await client.post(path).bearerToken(auth.access_token).accept('json').form(body),
        await Object.entries(body).reduce(
          (request, [name, value]) => request.field(name, String(value)),
          client.post(path).bearerToken(auth.access_token).accept('json')
        ),
      ]
      for (const contentType of [
        'application/json-patch+json',
        'application/vnd.api+json',
        'application/csp-report',
        'text/plain',
        'application/octet-stream',
      ]) {
        responses.push(
          await client
            .post(path)
            .bearerToken(auth.access_token)
            .header('content-type', contentType)
            .accept('json')
            .setup((request) => {
              request.request.send(JSON.stringify(body))
            })
        )
      }

      for (const response of responses) {
        response.assertStatus(422)
        response.assertBodyContains({
          errors: [{ field: 'refresh_token', rule: 'required' }],
        })
        assertPrivateCredentialResponse(response)
      }
    }

    assert.isNull(await Tenant.findBy('name', 'Rejected Media Type'))
    const stored = await RefreshToken.query().where('user_id', user.id).firstOrFail()
    assert.isNull(stored.revoked_at)
  })

  test('accepts canonical JSON with a charset parameter when switching operations', async ({
    client,
    assert,
  }) => {
    const user = await createUser({
      email: 'tenant-json-charset@example.com',
      username: 'tenant-json-charset',
    })
    const target = await Tenant.create({
      name: 'JSON Charset Target',
      slug: 'json-charset-target',
      is_active: true,
    })
    await user.related('tenants').attach({ [target.id]: { role: 'owner' } })
    const auth = await signIn(client, user)

    const response = await client
      .post('/api/v1/tenants/switch')
      .bearerToken(auth.access_token)
      .header('content-type', 'Application/JSON; charset=utf-8')
      .accept('json')
      .setup((request) => {
        request.request.send(
          JSON.stringify({ tenant_id: target.id, refresh_token: auth.refresh_token })
        )
      })

    response.assertStatus(200)
    assertPrivateCredentialResponse(response)
    assert.equal(response.body().tenant.id, target.id)
    await assertSingleRotation(assert, user.id)
  })

  test('sanitizes malformed JSON without creating an operation or consuming its refresh token', async ({
    client,
    assert,
  }) => {
    const user = await createUser(
      { email: 'tenant-malformed-json@example.com', username: 'tenant-malformed-json' },
      IRole.Slugs.ADMIN
    )
    const auth = await signIn(client, user)

    const response = await client
      .post('/api/v1/tenants')
      .bearerToken(auth.access_token)
      .accept('json')
      .unsafeJson(`{"name":"Malformed JSON Operation","refresh_token":"${auth.refresh_token}"`)

    response.assertStatus(400)
    response.assertBody({ status: 400, message: 'Malformed JSON request body' })
    assertPrivateCredentialResponse(response)
    assert.notInclude(response.text(), auth.refresh_token)
    assert.isNull(await Tenant.findBy('name', 'Malformed JSON Operation'))

    const stored = await RefreshToken.query().where('user_id', user.id).firstOrFail()
    assert.isNull(stored.revoked_at)
  })

  test('does not source tenant mutation fields from the query string', async ({ client }) => {
    const user = await createUser(
      { email: 'tenant-query-input@example.com', username: 'tenant-query-input' },
      IRole.Slugs.ADMIN
    )
    const target = await Tenant.create({
      name: 'Query Input Target',
      slug: 'query-input-target',
      is_active: true,
    })
    await user.related('tenants').attach({ [target.id]: { role: 'owner' } })
    const auth = await signIn(client, user)

    const create = await client
      .post('/api/v1/tenants')
      .qs({ name: 'Query Operation', refresh_token: auth.refresh_token })
      .bearerToken(auth.access_token)
      .json({})
    create.assertStatus(422)
    create.assertBodyContains({ errors: [{ field: 'name', rule: 'required' }] })

    const switchTenant = await client
      .post('/api/v1/tenants/switch')
      .qs({ tenant_id: target.id, refresh_token: auth.refresh_token })
      .bearerToken(auth.access_token)
      .json({})
    switchTenant.assertStatus(422)
    switchTenant.assertBodyContains({ errors: [{ field: 'tenant_id', rule: 'required' }] })
  })

  test('rejects a refresh token owned by another bearer without consuming it', async ({
    client,
    assert,
  }) => {
    const userA = await createUser({ email: 'access-a@example.com', username: 'access-a' })
    const userB = await createUser({ email: 'refresh-b@example.com', username: 'refresh-b' })
    const target = await Tenant.create({
      name: 'Access A Target',
      slug: 'access-a-target',
      is_active: true,
    })
    await userA.related('tenants').attach({ [target.id]: { role: 'owner' } })
    const authA = await signIn(client, userA)
    const authB = await signIn(client, userB)

    const response = await client
      .post('/api/v1/tenants/switch')
      .bearerToken(authA.access_token)
      .json({ tenant_id: target.id, refresh_token: authB.refresh_token })

    response.assertStatus(401)
    assertPrivateCredentialResponse(response)
    response.assertBody({ status: 401, message: 'Invalid or expired refresh token' })
    const storedB = await RefreshToken.query().where('user_id', userB.id).firstOrFail()
    assert.isNull(storedB.revoked_at)
  })

  test('rejects a foreign tenant without consuming the submitted refresh token', async ({
    client,
    assert,
  }) => {
    const user = await createUser({ email: 'noaccess@example.com', username: 'noaccess' })
    const foreign = await Tenant.create({ name: 'Foreign', slug: 'foreign', is_active: true })
    const auth = await signIn(client, user)

    const response = await client
      .post('/api/v1/tenants/switch')
      .bearerToken(auth.access_token)
      .json({ tenant_id: foreign.id, refresh_token: auth.refresh_token })

    response.assertStatus(403)
    assertPrivateCredentialResponse(response)
    const stored = await RefreshToken.query().where('user_id', user.id).firstOrFail()
    assert.isNull(stored.revoked_at)
  })

  test('rejects an inactive tenant without consuming the submitted refresh token', async ({
    client,
    assert,
  }) => {
    const user = await createUser({
      email: 'inactive-member@example.com',
      username: 'inactive-member',
    })
    const inactive = await Tenant.create({
      name: 'Inactive',
      slug: 'inactive-switch',
      is_active: false,
    })
    await user.related('tenants').attach({ [inactive.id]: { role: 'owner' } })
    const auth = await signIn(client, user)

    const response = await client
      .post('/api/v1/tenants/switch')
      .bearerToken(auth.access_token)
      .json({ tenant_id: inactive.id, refresh_token: auth.refresh_token })

    response.assertStatus(403)
    assertPrivateCredentialResponse(response)
    const stored = await RefreshToken.query().where('user_id', user.id).firstOrFail()
    assert.isNull(stored.revoked_at)
  })

  test('validates tenant_id with 422 and leaves the refresh credential usable', async ({
    client,
    assert,
  }) => {
    const user = await createUser({
      email: 'invalid-switch@example.com',
      username: 'invalid-switch',
    })
    const auth = await signIn(client, user)

    for (const tenantId of ['abc', '1', 0, -1, 1.5, 2_147_483_648]) {
      const response = await client
        .post('/api/v1/tenants/switch')
        .bearerToken(auth.access_token)
        .json({ tenant_id: tenantId, refresh_token: auth.refresh_token })

      response.assertStatus(422)
      assertPrivateCredentialResponse(response)
    }
    const stored = await RefreshToken.query().where('user_id', user.id).firstOrFail()
    assert.isNull(stored.revoked_at)
  })

  test('does not persist an operation when validation or refresh authentication fails', async ({
    client,
    assert,
  }) => {
    const user = await createUser(
      { email: 'atomic-create@example.com', username: 'atomic-create' },
      IRole.Slugs.ADMIN
    )
    const auth = await signIn(client, user)

    const invalidName = await client
      .post('/api/v1/tenants')
      .bearerToken(auth.access_token)
      .json({ name: 'x', refresh_token: auth.refresh_token })
    invalidName.assertStatus(422)
    assert.isNull(await Tenant.findBy('name', 'x'))

    const invalidRefresh = await client
      .post('/api/v1/tenants')
      .bearerToken(auth.access_token)
      .json({ name: 'Must Roll Back', refresh_token: 'A'.repeat(43) })
    invalidRefresh.assertStatus(401)
    assertPrivateCredentialResponse(invalidRefresh)
    assert.isNull(await Tenant.findBy('name', 'Must Roll Back'))
    const stored = await RefreshToken.query().where('user_id', user.id).firstOrFail()
    assert.isNull(stored.revoked_at)
  })

  test('requires bearer authentication for tenant endpoints', async ({ client }) => {
    const response = await client.get('/api/v1/tenants/me')
    response.assertStatus(401)

    const create = await client
      .post('/api/v1/tenants')
      .json({ name: 'No Bearer', refresh_token: 'A'.repeat(43) })
    create.assertStatus(401)
    assertPrivateCredentialResponse(create)
  })
})

test.group('Tenant session rotation concurrency', () => {
  test('allows exactly one switch for concurrent reuse of the same refresh token', async ({
    client,
    assert,
    cleanup,
  }) => {
    assert.equal(db.connectionGlobalTransactions.size, 0)
    const suffix = randomUUID()
    const user = await createUser({
      email: `tenant-concurrency-${suffix}@example.com`,
      username: `tenant-concurrency-${suffix}`,
    })
    const target = await Tenant.create({
      name: `Tenant Concurrency ${suffix}`,
      slug: `tenant-concurrency-${suffix}`,
      is_active: true,
    })
    await user.related('tenants').attach({ [target.id]: { role: 'owner' } })
    cleanup(async () => {
      await db.from('users').where('id', user.id).delete()
      await db.from('tenants').where('id', target.id).delete()
    })
    const auth = await signIn(client, user)

    const switchTenant = () =>
      client
        .post('/api/v1/tenants/switch')
        .bearerToken(auth.access_token)
        .json({ tenant_id: target.id, refresh_token: auth.refresh_token })

    const responses = await Promise.all([switchTenant(), switchTenant()])
    assert.deepEqual(responses.map((response) => response.status()).sort(), [200, 401])
    responses.forEach(assertPrivateCredentialResponse)

    const records = await RefreshToken.query().where('user_id', user.id).orderBy('id', 'asc')
    assert.lengthOf(records, 2)
    assert.isNotNull(records[0].revoked_at)
    assert.isNull(records[1].revoked_at)
    assert.equal(records[1].rotated_from_id, records[0].id)
  })
})
