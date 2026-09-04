import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import limiter from '@adonisjs/limiter/services/main'
import mail from '@adonisjs/mail/services/main'
import jwt from 'jsonwebtoken'

import User from '#modules/users/models/user'
import Role from '#modules/roles/models/role'
import Tenant from '#modules/tenants/models/tenant'

import PermissionService from '#modules/permissions/services/permission_service'
import IRole from '#modules/roles/interfaces/role_interface'
import env from '#start/env'

test.group('Sessions sign up', (group) => {
  group.each.setup(() => {
    mail.restore()
    mail.fake()
    return testUtils.db().withGlobalTransaction()
  })

  group.each.teardown(() => {
    mail.restore()
  })
  group.each.setup(async () => {
    await limiter.clear()
    return () => limiter.clear()
  })

  test('should create a new user with valid data', async ({ client, assert }) => {
    const userData = {
      full_name: 'Jane Doe',
      email: 'jane@example.com',
      username: 'janedoe',
      password: 'password123',
      password_confirmation: 'password123',
      terms_accepted: true,
    }

    const response = await client.post('/api/v1/sessions/sign-up').json(userData)

    response.assertStatus(201)
    response.assertBodyContains({
      auth: {
        access_token: response.body().auth?.access_token,
        refresh_token: response.body().auth?.refresh_token,
        token_type: 'Bearer',
        expires_in: 900,
        refresh_expires_in: 259200,
      },
      email: userData.email,
      username: userData.username,
      full_name: userData.full_name,
      email_verification_sent: true,
    })

    assert.isDefined(response.body().auth?.access_token)
    assert.isDefined(response.body().auth?.refresh_token)
    assert.deepEqual(Object.keys(response.body()).sort(), [
      'auth',
      'created_at',
      'email',
      'email_verification_sent',
      'email_verified',
      'email_verified_at',
      'full_name',
      'id',
      'roles',
      'updated_at',
      'username',
    ])
    response.assertHeader('cache-control', 'private, no-store')
    response.assertHeader('pragma', 'no-cache')
    response.assertHeader('x-robots-tag', 'noindex, nofollow')
    response.assertHeader('referrer-policy', 'no-referrer')

    const user = await User.findBy('email', userData.email)
    assert.isNotNull(user)

    const workspaces = await user!.related('tenants').query()
    assert.lengthOf(workspaces, 1)
    assert.equal(workspaces[0].$extras.pivot_role, 'owner')

    const payload = jwt.verify(
      response.body().auth.access_token,
      env.get('ACCESS_TOKEN_SECRET', env.get('APP_KEY'))
    ) as { tenantId?: number }
    assert.equal(payload.tenantId, workspaces[0].id)
  })

  test('should persist omitted, null, or blank usernames without reserving the email local-part', async ({
    client,
    assert,
  }) => {
    const registrations = [
      {
        full_name: 'Omitted Optional Username',
        email: 'shared-local-part@example.com',
      },
      {
        full_name: 'Empty Optional Username',
        email: 'shared-local-part@example.org',
        username: '',
      },
      {
        full_name: 'Whitespace Optional Username',
        email: 'shared-local-part@example.net',
        username: '   ',
      },
      {
        full_name: 'Null Optional Username',
        email: 'shared-local-part@example.dev',
        username: null,
      },
    ]

    for (const registration of registrations) {
      const response = await client.post('/api/v1/sessions/sign-up').json({
        ...registration,
        password: 'password123',
        password_confirmation: 'password123',
        terms_accepted: true,
      })

      response.assertStatus(201)
      assert.isNull(response.body().username)
    }

    const users = await User.query()
      .whereIn(
        'email',
        registrations.map(({ email }) => email)
      )
      .orderBy('email', 'asc')

    assert.lengthOf(users, 4)
    assert.isTrue(users.every((user) => user.username === null))
  })

  test('should canonicalize identity fields and reject an email-shaped username', async ({
    client,
    assert,
  }) => {
    const created = await client.post('/api/v1/sessions/sign-up').json({
      full_name: 'Canonical Identity',
      email: '  Canonical.User@Example.COM  ',
      username: '  Canonical.User  ',
      password: 'password123',
      password_confirmation: 'password123',
      terms_accepted: true,
    })

    created.assertStatus(201)
    created.assertBodyContains({
      email: 'canonical.user@example.com',
      username: 'canonical.user',
    })
    const stored = await User.findByOrFail('email', 'canonical.user@example.com')
    assert.equal(stored.username, 'canonical.user')

    const caseVariant = await client
      .post('/api/v1/sessions/sign-up')
      .header('Accept', 'application/json')
      .json({
        full_name: 'Duplicate Canonical Identity',
        email: 'CANONICAL.USER@EXAMPLE.COM',
        password: 'password123',
        password_confirmation: 'password123',
        terms_accepted: true,
      })
    caseVariant.assertStatus(422)
    caseVariant.assertBodyContains({ errors: [{ field: 'email', rule: 'database.unique' }] })

    const ambiguousUsername = await client
      .post('/api/v1/sessions/sign-up')
      .header('Accept', 'application/json')
      .json({
        full_name: 'Ambiguous Identity',
        email: 'ambiguous-identity@example.com',
        username: 'another@example.com',
        password: 'password123',
        password_confirmation: 'password123',
        terms_accepted: true,
      })
    ambiguousUsername.assertStatus(422)
    ambiguousUsername.assertBodyContains({ errors: [{ field: 'username', rule: 'regex' }] })
  })

  test('should attach a public registration to the configured operation atomically', async ({
    client,
    assert,
    cleanup,
  }) => {
    const previousMode = env.get('REGISTRATION_WORKSPACE_MODE', 'personal')
    env.set('REGISTRATION_WORKSPACE_MODE', 'operation')
    cleanup(() => env.set('REGISTRATION_WORKSPACE_MODE', previousMode))

    const operation = await Tenant.create({
      name: 'Public Test Operation',
      slug: 'public-test',
      is_active: true,
    })

    const response = await client.post('/api/v1/sessions/sign-up').json({
      full_name: 'Operation Member',
      email: 'operation-member@example.com',
      username: 'operation-member',
      password: 'password123',
      password_confirmation: 'password123',
      terms_accepted: true,
    })

    response.assertStatus(201)
    const user = await User.findByOrFail('email', 'operation-member@example.com')
    const workspaces = await user.related('tenants').query()
    assert.lengthOf(workspaces, 1)
    assert.equal(workspaces[0].id, operation.id)
    assert.equal(workspaces[0].$extras.pivot_role, 'member')

    const payload = jwt.verify(
      response.body().auth.access_token,
      env.get('ACCESS_TOKEN_SECRET', env.get('APP_KEY'))
    ) as { tenantId?: number }
    assert.equal(payload.tenantId, operation.id)
  })

  test('should keep a persisted registration successful when email delivery fails', async ({
    client,
    assert,
    cleanup,
  }) => {
    const mutableMail = mail as unknown as {
      send: typeof mail.send
    }
    const originalSend = mutableMail.send
    mutableMail.send = (() => Promise.reject(new Error('SMTP unavailable'))) as typeof mail.send
    cleanup(() => {
      mutableMail.send = originalSend
    })

    const response = await client.post('/api/v1/sessions/sign-up').json({
      full_name: 'Delivery Failure',
      email: 'delivery-failure@example.com',
      username: 'delivery-failure',
      password: 'password123',
      password_confirmation: 'password123',
      terms_accepted: true,
    })

    response.assertStatus(201)
    response.assertBodyContains({
      email: 'delivery-failure@example.com',
      email_verification_sent: false,
    })
    assert.isNotNull(await User.findBy('email', 'delivery-failure@example.com'))
  })

  test('should fail with duplicate email', async ({ client }) => {
    await User.create({
      full_name: 'John Doe',
      email: 'john@example.com',
      username: 'johndoe',
      password: 'hashedpassword',
    })

    const response = await client
      .post('/api/v1/sessions/sign-up')
      .header('Accept', 'application/json')
      .json({
        full_name: 'Jane Doe',
        email: 'john@example.com',
        username: 'janedoe',
        password: 'password123',
        password_confirmation: 'password123',
        terms_accepted: true,
      })

    response.assertStatus(422)
    response.assertBodyContains({
      errors: [
        {
          field: 'email',
          rule: 'database.unique',
        },
      ],
    })
  })

  test('should fail with duplicate username', async ({ client }) => {
    await User.create({
      full_name: 'John Doe',
      email: 'john@example.com',
      username: 'johndoe',
      password: 'hashedpassword',
    })

    const response = await client
      .post('/api/v1/sessions/sign-up')
      .header('Accept', 'application/json')
      .json({
        full_name: 'Jane Doe',
        email: 'jane@example.com',
        username: 'johndoe',
        password: 'password123',
        password_confirmation: 'password123',
        terms_accepted: true,
      })

    response.assertStatus(422)
    response.assertBodyContains({
      errors: [
        {
          field: 'username',
          rule: 'database.unique',
        },
      ],
    })
  })

  test('should validate required fields', async ({ client }) => {
    const response = await client
      .post('/api/v1/sessions/sign-up')
      .header('Accept', 'application/json')
      .json({})

    response.assertStatus(422)
    response.assertBodyContains({
      errors: [
        {
          field: 'full_name',
          rule: 'required',
          message: 'The full_name field must be defined',
        },
        {
          field: 'email',
          rule: 'required',
          message: 'The email field must be defined',
        },
        {
          field: 'password',
          rule: 'required',
          message: 'The password field must be defined',
        },
        {
          field: 'terms_accepted',
          rule: 'required',
        },
      ],
    })
  })

  test('should read registration fields only from the request body', async ({ client, assert }) => {
    const queryRegistration = {
      full_name: 'Query Registration',
      email: 'query-registration@example.com',
      username: 'query-registration',
      password: 'password123',
      password_confirmation: 'password123',
      terms_accepted: true,
    }
    const queryOnly = await client.post('/api/v1/sessions/sign-up').qs(queryRegistration).json({})

    queryOnly.assertStatus(422)
    queryOnly.assertBodyContains({
      errors: [
        { field: 'full_name', rule: 'required' },
        { field: 'email', rule: 'required' },
        { field: 'password', rule: 'required' },
        { field: 'terms_accepted', rule: 'required' },
      ],
    })

    const bodyRegistration = {
      full_name: 'Body Registration',
      email: 'body-registration@example.com',
      username: 'body-registration',
      password: 'password123',
      password_confirmation: 'password123',
      terms_accepted: true,
    }
    const bodyWins = await client
      .post('/api/v1/sessions/sign-up')
      .qs({
        ...queryRegistration,
        email: 'conflicting-query@example.com',
        username: 'conflicting-query',
      })
      .json(bodyRegistration)

    bodyWins.assertStatus(201)
    bodyWins.assertBodyContains({
      full_name: bodyRegistration.full_name,
      email: bodyRegistration.email,
      username: bodyRegistration.username,
    })
    assert.isNull(await User.findBy('email', 'conflicting-query@example.com'))
    assert.isNotNull(await User.findBy('email', bodyRegistration.email))
  })

  test('should require canonical application/json for API sign up', async ({ client, assert }) => {
    const payload = {
      full_name: 'Canonical JSON Sign Up',
      email: 'canonical-json-sign-up@example.com',
      username: 'canonical-json-sign-up',
      password: 'password123',
      password_confirmation: 'password123',
      terms_accepted: true,
    }
    const rawPayload = JSON.stringify(payload)
    const rejected = [
      await client.post('/api/v1/sessions/sign-up').accept('json').form(payload),
      await client
        .post('/api/v1/sessions/sign-up')
        .accept('json')
        .field('full_name', payload.full_name)
        .field('email', payload.email)
        .field('username', payload.username)
        .field('password', payload.password)
        .field('password_confirmation', payload.password_confirmation)
        .field('terms_accepted', 'true'),
    ]

    for (const contentType of ['application/json-patch+json', 'application/vnd.api+json']) {
      rejected.push(
        await client
          .post('/api/v1/sessions/sign-up')
          .accept('json')
          .unsafeJson(rawPayload)
          .header('content-type', contentType)
      )
    }

    for (const response of rejected) {
      response.assertStatus(422)
      response.assertBodyContains({
        errors: [
          { field: 'full_name', rule: 'required' },
          { field: 'email', rule: 'required' },
          { field: 'password', rule: 'required' },
          { field: 'terms_accepted', rule: 'required' },
        ],
      })
    }
    assert.isNull(await User.findBy('email', payload.email))

    const canonicalWithCharset = await client
      .post('/api/v1/sessions/sign-up')
      .accept('json')
      .unsafeJson(rawPayload)
      .header('content-type', 'Application/JSON; charset=utf-8')

    canonicalWithCharset.assertStatus(201)
    canonicalWithCharset.assertBodyContains({ email: payload.email, username: payload.username })
    assert.isNotNull(await User.findBy('email', payload.email))
  })

  test('should validate email format', async ({ client }) => {
    const response = await client
      .post('/api/v1/sessions/sign-up')
      .header('Accept', 'application/json')
      .json({
        full_name: 'Jane Doe',
        email: 'invalid-email',
        username: 'janedoe',
        password: 'password123',
        password_confirmation: 'password123',
        terms_accepted: true,
      })

    response.assertStatus(422)
    response.assertBodyContains({
      errors: [
        {
          field: 'email',
          rule: 'email',
        },
      ],
    })
  })

  test('should validate password minimum length', async ({ client }) => {
    const response = await client
      .post('/api/v1/sessions/sign-up')
      .header('Accept', 'application/json')
      .json({
        full_name: 'Jane Doe',
        email: 'jane@example.com',
        username: 'janedoe',
        password: '12345',
        password_confirmation: '12345',
        terms_accepted: true,
      })

    response.assertStatus(422)
    response.assertBodyContains({
      errors: [
        {
          field: 'password',
          rule: 'minLength',
        },
      ],
    })
  })

  test('should assign a least-privilege default permission set', async ({ client, assert }) => {
    const response = await client.post('/api/v1/sessions/sign-up').json({
      full_name: 'Least Privilege',
      email: 'least-privilege@example.com',
      username: 'least-privilege',
      password: 'password123',
      password_confirmation: 'password123',
      terms_accepted: true,
    })

    response.assertStatus(201)
    const user = await User.findByOrFail('email', 'least-privilege@example.com')
    const permissionService = await app.container.make(PermissionService)
    const permissions = await permissionService.getEffectivePermissionNames(user.id)

    assert.includeMembers(permissions, [
      'files.create',
      'files.read',
      'files.list',
      'files.delete.own',
      'tenants.read',
      'tenants.list',
      'establishments.create',
      'establishments.read',
      'establishments.update',
      'establishments.list',
      'establishments.archive',
    ])
    assert.notInclude(permissions, 'users.list')
    assert.notInclude(permissions, 'users.read')
    assert.notInclude(permissions, 'users.update')
    assert.notInclude(permissions, 'users.delete')
    assert.notInclude(permissions, 'roles.list')
    assert.notInclude(permissions, 'permissions.list')
    assert.notInclude(permissions, 'tenants.create')
    assert.notInclude(permissions, 'dashboard.read')

    const dashboard = await client.get('/dashboard').loginAs(user)
    dashboard.assertStatus(403)
  })

  test('should assign default user role', async ({ client, assert }) => {
    // Create the 'user' role first
    await Role.firstOrCreate(
      { slug: IRole.Slugs.USER },
      {
        name: 'User',
        slug: IRole.Slugs.USER,
        description: 'Regular user role',
      }
    )

    const userData = {
      full_name: 'Jane Doe',
      email: 'janeuser@example.com',
      username: 'janeuser',
      password: 'password123',
      password_confirmation: 'password123',
      terms_accepted: true,
    }

    const response = await client.post('/api/v1/sessions/sign-up').json(userData)

    response.assertStatus(201)

    const user = await User.findBy('email', userData.email)
    assert.isNotNull(user)

    const userRoles = await db
      .from('user_roles')
      .where('user_id', user!.id)
      .join('roles', 'roles.id', '=', 'user_roles.role_id')
      .select('roles.slug')

    assert.lengthOf(userRoles, 1)
    assert.equal(userRoles[0].slug, 'user')
  })

  test('should reject public registration when legal documents are not accepted', async ({
    client,
  }) => {
    const response = await client
      .post('/api/v1/sessions/sign-up')
      .header('Accept', 'application/json')
      .json({
        full_name: 'No Legal Acceptance',
        email: 'no-legal-acceptance@example.com',
        password: 'password123',
        password_confirmation: 'password123',
        terms_accepted: false,
      })

    response.assertStatus(422)
    response.assertBodyContains({
      errors: [
        {
          field: 'terms_accepted',
          rule: 'accepted',
        },
      ],
    })
  })
})
