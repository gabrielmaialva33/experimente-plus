import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'

import User from '#modules/users/models/user'
import Role from '#modules/roles/models/role'

import IRole from '#modules/roles/interfaces/role_interface'

test.group('Sessions sign in', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(async () => {
    await limiter.clear()
    return () => limiter.clear()
  })

  test('should sign in with valid credentials', async ({ client, assert }) => {
    const password = 'password123'

    const user = await User.create({
      full_name: 'John Doe',
      email: 'john@example.com',
      username: 'johndoe',
      password: password,
    })

    const response = await client.post('/api/v1/sessions/sign-in').json({
      uid: 'JOHN@EXAMPLE.COM',
      password: password,
    })

    response.assertStatus(200)
    response.assertBodyContains({
      auth: {
        access_token: response.body().auth?.access_token,
        refresh_token: response.body().auth?.refresh_token,
        token_type: 'Bearer',
        expires_in: 900,
        refresh_expires_in: 259200,
      },
      id: user.id,
      email: user.email,
      username: user.username,
    })

    assert.isDefined(response.body().auth?.access_token)
    assert.isDefined(response.body().auth?.refresh_token)
    assert.deepEqual(Object.keys(response.body()).sort(), [
      'auth',
      'created_at',
      'email',
      'email_verified',
      'email_verified_at',
      'full_name',
      'id',
      'roles',
      'updated_at',
      'username',
    ])
    assert.notProperty(response.body(), 'email_verification_sent')
    response.assertHeader('cache-control', 'private, no-store')
    response.assertHeader('pragma', 'no-cache')
    response.assertHeader('x-robots-tag', 'noindex, nofollow')
    response.assertHeader('referrer-policy', 'no-referrer')
  })

  test('should fail with invalid email', async ({ client }) => {
    const response = await client.post('/api/v1/sessions/sign-in').json({
      uid: 'nonexistent@example.com',
      password: 'password123',
    })

    response.assertStatus(400)
    response.assertBody({
      errors: [
        {
          message: 'Invalid user credentials',
        },
      ],
    })
  })

  test('should read credentials only from the request body', async ({ client }) => {
    const user = await User.create({
      full_name: 'Body Credentials',
      email: 'body-credentials@example.com',
      username: 'body-credentials',
      password: 'password123',
    })

    const queryOnly = await client
      .post('/api/v1/sessions/sign-in')
      .qs({ uid: user.email, password: 'password123' })
      .json({})
    queryOnly.assertStatus(422)
    queryOnly.assertBodyContains({
      errors: [
        { field: 'uid', rule: 'required' },
        { field: 'password', rule: 'required' },
      ],
    })

    const bodyWins = await client
      .post('/api/v1/sessions/sign-in')
      .qs({ uid: 'query-attacker@example.com', password: 'wrong-password' })
      .json({ uid: user.email, password: 'password123' })
    bodyWins.assertStatus(200)
    bodyWins.assertBodyContains({ id: user.id, email: user.email })
  })

  test('should require canonical application/json for API sign in', async ({ client }) => {
    const user = await User.create({
      full_name: 'Canonical JSON Sign In',
      email: 'canonical-json-sign-in@example.com',
      username: 'canonical-json-sign-in',
      password: 'password123',
    })
    const payload = { uid: user.email, password: 'password123' }
    const rawPayload = JSON.stringify(payload)
    const rejected = [
      await client.post('/api/v1/sessions/sign-in').accept('json').form(payload),
      await client
        .post('/api/v1/sessions/sign-in')
        .accept('json')
        .field('uid', payload.uid)
        .field('password', payload.password),
    ]

    for (const contentType of ['application/json-patch+json', 'application/vnd.api+json']) {
      rejected.push(
        await client
          .post('/api/v1/sessions/sign-in')
          .accept('json')
          .unsafeJson(rawPayload)
          .header('content-type', contentType)
      )
    }

    for (const response of rejected) {
      response.assertStatus(422)
      response.assertBodyContains({
        errors: [
          { field: 'uid', rule: 'required' },
          { field: 'password', rule: 'required' },
        ],
      })
    }

    const canonicalWithCharset = await client
      .post('/api/v1/sessions/sign-in')
      .accept('json')
      .unsafeJson(rawPayload)
      .header('content-type', 'Application/JSON; charset=utf-8')

    canonicalWithCharset.assertStatus(200)
    canonicalWithCharset.assertBodyContains({ id: user.id, email: user.email })
  })

  test('should fail with invalid password', async ({ client }) => {
    const password = 'password123'

    await User.create({
      full_name: 'John Doe',
      email: 'john@example.com',
      username: 'johndoe',
      password: password,
    })

    const response = await client.post('/api/v1/sessions/sign-in').json({
      uid: 'john@example.com',
      password: 'wrongpassword',
    })

    response.assertStatus(400)
    response.assertBodyContains({
      errors: [
        {
          message: 'Invalid user credentials',
        },
      ],
    })
  })

  test('should validate required fields', async ({ client }) => {
    const response = await client
      .post('/api/v1/sessions/sign-in')
      .header('Accept', 'application/json')
      .json({})

    response.assertStatus(422)
    response.assertBodyContains({
      errors: [
        {
          field: 'uid',
          rule: 'required',
        },
        {
          field: 'password',
          rule: 'required',
        },
      ],
    })
  })

  test('should include user roles in response', async ({ client, assert }) => {
    const password = 'password123'

    const user = await User.create({
      full_name: 'John Doe',
      email: 'john@example.com',
      username: 'johndoe',
      password: password,
    })

    const role = await Role.firstOrCreate(
      { slug: IRole.Slugs.ADMIN },
      {
        name: 'Admin',
        slug: IRole.Slugs.ADMIN,
        description: 'Administrator role',
      }
    )

    await user.related('roles').sync([role.id])

    const response = await client.post('/api/v1/sessions/sign-in').json({
      uid: 'john@example.com',
      password: password,
    })

    response.assertStatus(200)
    response.assertBodyContains({
      roles: [
        {
          id: role.id,
          name: role.name,
          slug: role.slug,
        },
      ],
    })
    assert.deepEqual(Object.keys(response.body().roles[0]).sort(), [
      'created_at',
      'description',
      'id',
      'name',
      'slug',
      'updated_at',
    ])
  })
})
