import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import mail from '@adonisjs/mail/services/main'
import jwt from 'jsonwebtoken'

import { OrganizationFactory, OrganizationMemberFactory } from '#database/factories/index'
import PasswordResetToken from '#modules/auth/models/password_reset_token'
import PasswordResetNotification from '#modules/auth/services/password_reset_notification'
import VerifyEmailNotification from '#modules/auth/services/verify_email_notification'
import IRole from '#modules/roles/interfaces/role_interface'
import Role from '#modules/roles/models/role'
import Tenant from '#modules/tenants/models/tenant'
import User from '#modules/users/models/user'
import {
  JWT_AUDIENCE,
  JWT_COOKIE_NAME,
  JWT_ISSUER,
  WEB_ACCESS_TOKEN_EXPIRES_IN,
} from '#shared/jwt/constants'
import env from '#start/env'

interface TestInertiaPage {
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

function signedWebAccessCookie(user: User, tenantId?: unknown): string {
  return jwt.sign(
    {
      sub: String(user.id),
      userId: user.id,
      token_use: 'access',
      ...(tenantId === undefined ? {} : { tenantId }),
    },
    env.get('ACCESS_TOKEN_SECRET', env.get('APP_KEY')),
    {
      expiresIn: WEB_ACCESS_TOKEN_EXPIRES_IN,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }
  )
}

test.group('Web authentication', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(async () => {
    await limiter.clear()
    return () => limiter.clear()
  })

  async function attachDefaultRole(user: User) {
    const role = await Role.findByOrFail('slug', IRole.Slugs.USER)
    await user.related('roles').attach([role.id])
  }

  async function attachRole(user: User, roleSlug: IRole.Slugs) {
    const role = await Role.findByOrFail('slug', roleSlug)
    await user.related('roles').attach([role.id])
  }

  async function createUserWithOperation(label: string, roleSlug: IRole.Slugs) {
    const slug = label.toLowerCase().replaceAll(' ', '-')
    const user = await User.create({
      full_name: label,
      email: `${slug}@example.com`,
      username: slug,
      password: 'password123',
    })
    await attachRole(user, roleSlug)
    const tenant = await Tenant.create({
      name: `${label} Operation`,
      slug: `${slug}-operation`,
      is_active: true,
    })
    await user.related('tenants').attach({ [tenant.id]: { role: 'member' } })

    return { user, tenant }
  }

  test('should register and immediately authenticate the browser session', async ({
    client,
    assert,
    cleanup,
  }) => {
    mail.restore()
    mail.fake()
    cleanup(() => mail.restore())

    const response = await client.post('/register').withCsrfToken().redirects(0).json({
      full_name: 'Web Register',
      email: 'web-register@example.com',
      username: 'web-register',
      password: 'password123',
      password_confirmation: 'password123',
      terms_accepted: true,
    })

    response.assertStatus(302)
    assert.equal(response.header('location'), '/wallet')

    const tokenCookie = response.cookie(JWT_COOKIE_NAME)
    assert.exists(tokenCookie)
    assert.isNotEmpty(tokenCookie!.value)
    assert.isTrue(tokenCookie!.httpOnly)
    assert.equal(tokenCookie!.path, '/')

    const user = await User.findByOrFail('email', 'web-register@example.com')
    await user.load('roles')
    assert.include(
      user.roles.map((role) => role.slug),
      IRole.Slugs.USER
    )

    const wallet = await client.get('/wallet').cookie(JWT_COOKIE_NAME, tokenCookie!.value)
    wallet.assertStatus(200)
  })

  test('should treat the optional username sent blank by the registration form as omitted', async ({
    client,
    assert,
    cleanup,
  }) => {
    mail.restore()
    const { mails } = mail.fake()
    cleanup(() => mail.restore())

    const response = await client.post('/register').withCsrfToken().redirects(0).form({
      full_name: 'Web Blank Username',
      email: 'web-blank-username@example.com',
      username: '',
      password: 'password123',
      password_confirmation: 'password123',
      terms_accepted: true,
    })

    response.assertStatus(302)
    assert.equal(response.header('location'), '/wallet')
    mails.assertSentCount(VerifyEmailNotification, 1)

    const user = await User.findByOrFail('email', 'web-blank-username@example.com')
    assert.isNull(user.username)
  })

  test('should flash registration validation through the official Inertia error bag', async ({
    client,
  }) => {
    await User.create({
      full_name: 'Existing Web Registration',
      email: 'existing-web-registration@example.com',
      username: 'existing-web-registration',
      password: 'password123',
    })

    const response = await client
      .post('/register')
      .withCsrfToken()
      .header('x-inertia', 'true')
      .header('referer', '/register')
      .accept('html')
      .redirects(0)
      .form({
        full_name: 'Duplicate Web Registration',
        email: 'another-web-registration@example.com',
        username: 'existing-web-registration',
        password: 'password123',
        password_confirmation: 'password123',
        terms_accepted: true,
      })

    response.assertStatus(302)
    response.assertHeader('location', '/register')
    response.assertFlashMessage('inputErrorsBag', {
      username: ['The username has already been taken'],
    })
    response.assertFlashMissing('errors')
  })

  test('should read web registration and login credentials only from the request body', async ({
    client,
    assert,
    cleanup,
  }) => {
    mail.restore()
    mail.fake()
    cleanup(() => mail.restore())

    const queryRegistration = {
      full_name: 'Query Registration',
      email: 'query-registration@example.com',
      username: 'query-registration',
      password: 'password123',
      password_confirmation: 'password123',
      terms_accepted: true,
    }
    const queryOnlyRegistration = await client
      .post('/register')
      .header('referer', '/register')
      .withCsrfToken()
      .redirects(0)
      .qs(queryRegistration)
      .json({})

    queryOnlyRegistration.assertStatus(302)
    queryOnlyRegistration.assertHeader('location', '/register')
    assert.isNull(await User.findBy('email', queryRegistration.email))
    assert.notExists(queryOnlyRegistration.cookie(JWT_COOKIE_NAME))

    const bodyRegistration = {
      full_name: 'Body Registration',
      email: 'body-registration@example.com',
      username: 'body-registration',
      password: 'password123',
      password_confirmation: 'password123',
      terms_accepted: true,
    }
    const conflictingRegistration = await client
      .post('/register')
      .header('referer', '/register')
      .withCsrfToken()
      .redirects(0)
      .qs(queryRegistration)
      .json(bodyRegistration)

    conflictingRegistration.assertStatus(302)
    conflictingRegistration.assertHeader('location', '/wallet')
    assert.exists(conflictingRegistration.cookie(JWT_COOKIE_NAME))
    assert.exists(await User.findBy('email', bodyRegistration.email))
    assert.isNull(await User.findBy('email', queryRegistration.email))

    const queryOnlyLogin = await client
      .post('/login')
      .header('referer', '/login')
      .withCsrfToken()
      .redirects(0)
      .qs({ uid: bodyRegistration.email, password: bodyRegistration.password })
      .json({})

    queryOnlyLogin.assertStatus(302)
    queryOnlyLogin.assertHeader('location', '/login')
    assert.notExists(queryOnlyLogin.cookie(JWT_COOKIE_NAME))

    const conflictingLogin = await client
      .post('/login')
      .header('referer', '/login')
      .withCsrfToken()
      .redirects(0)
      .qs({ uid: bodyRegistration.email, password: 'query-password-cannot-win' })
      .json({ uid: bodyRegistration.email, password: bodyRegistration.password })

    conflictingLogin.assertStatus(302)
    conflictingLogin.assertHeader('location', '/wallet')
    assert.exists(conflictingLogin.cookie(JWT_COOKIE_NAME))
  })

  test('should read web password reset fields only from the request body', async ({
    client,
    assert,
    cleanup,
  }) => {
    mail.restore()
    const { mails } = mail.fake()
    cleanup(() => mail.restore())

    const bodyUser = await User.create({
      full_name: 'Body Password Reset',
      email: 'body-web-password-reset@example.com',
      username: 'body-web-password-reset',
      password: 'password123',
    })
    const queryUser = await User.create({
      full_name: 'Query Password Reset',
      email: 'query-web-password-reset@example.com',
      username: 'query-web-password-reset',
      password: 'password123',
    })

    const queryOnlyForgot = await client
      .post('/forgot-password')
      .header('referer', '/forgot-password')
      .withCsrfToken()
      .redirects(0)
      .qs({ email: queryUser.email })
      .json({})

    queryOnlyForgot.assertStatus(302)
    queryOnlyForgot.assertHeader('location', '/forgot-password')
    mails.assertSentCount(PasswordResetNotification, 0)
    assert.isNull(await PasswordResetToken.query().where('user_id', queryUser.id).first())

    const conflictingForgot = await client
      .post('/forgot-password')
      .header('referer', '/forgot-password')
      .withCsrfToken()
      .redirects(0)
      .qs({ email: queryUser.email })
      .json({ email: bodyUser.email })

    conflictingForgot.assertStatus(302)
    conflictingForgot.assertHeader('location', '/forgot-password')
    mails.assertSentCount(PasswordResetNotification, 1)
    assert.isNull(await PasswordResetToken.query().where('user_id', queryUser.id).first())
    const resetToken = (mails.sent()[0] as PasswordResetNotification).getResetToken()
    const storedToken = await PasswordResetToken.query().where('user_id', bodyUser.id).firstOrFail()

    const queryOnlyReset = await client
      .post('/reset-password')
      .header('referer', `/reset-password?token=${resetToken}`)
      .withCsrfToken()
      .redirects(0)
      .qs({
        token: resetToken,
        password: 'query-password123',
        password_confirmation: 'query-password123',
      })
      .json({})

    queryOnlyReset.assertStatus(302)
    queryOnlyReset.assertHeader('location', '/reset-password')
    assert.notInclude(queryOnlyReset.header('location') ?? '', resetToken)
    await storedToken.refresh()
    assert.isNull(storedToken.consumed_at)

    const conflictingReset = await client
      .post('/reset-password')
      .header('referer', `/reset-password?token=${resetToken}`)
      .withCsrfToken()
      .redirects(0)
      .qs({
        token: 'query-token-cannot-win',
        password: 'query-password123',
        password_confirmation: 'query-password123',
      })
      .json({
        token: resetToken,
        password: 'body-password123',
        password_confirmation: 'body-password123',
      })

    conflictingReset.assertStatus(302)
    conflictingReset.assertHeader('location', '/login')
    await storedToken.refresh()
    assert.isNotNull(storedToken.consumed_at)
    const authenticatedUser = await User.verifyCredentials(bodyUser.email, 'body-password123')
    assert.equal(authenticatedUser.id, bodyUser.id)
  })

  test('should throttle repeated web login attempts with an Inertia-safe redirect', async ({
    client,
  }) => {
    const user = await User.create({
      full_name: 'Web Login Throttle',
      email: 'web-login-throttle@example.com',
      username: 'web-login-throttle',
      password: 'password123',
    })

    for (let attempt = 0; attempt < 5; attempt++) {
      const response = await client
        .post('/login')
        .withCsrfToken()
        .header('x-inertia', 'true')
        .header('referer', '/login')
        .accept('html')
        .redirects(0)
        .form({ uid: user.email, password: 'wrong-password' })

      response.assertStatus(302)
      response.assertHeader('location', '/login')
      response.assertHeader('x-ratelimit-limit', '5')
    }

    const rateLimited = await client
      .post('/login')
      .withCsrfToken()
      .header('x-inertia', 'true')
      .header('referer', '/login')
      .accept('html')
      .redirects(0)
      .form({ uid: user.email, password: 'wrong-password' })

    rateLimited.assertStatus(302)
    rateLimited.assertHeader('location', '/login')
    rateLimited.assertHeader('cache-control', 'private, no-store')
    rateLimited.assertHeader('pragma', 'no-cache')
    rateLimited.assertHeader('x-robots-tag', 'noindex, nofollow')
    rateLimited.assertHeader('referrer-policy', 'no-referrer')
    rateLimited.assertHeader('x-ratelimit-limit', '5')
    rateLimited.assertHeader('x-ratelimit-remaining', '0')
    rateLimited.assertHeader('retry-after')
    rateLimited.assertFlashMessage('errors', {
      general: 'Too many authentication attempts. Please try again later.',
    })
  })

  test('should throttle repeated web registration attempts with an Inertia-safe redirect', async ({
    client,
    assert,
  }) => {
    const payload = {
      full_name: 'Web Registration Throttle',
      email: 'web-registration-throttle@example.com',
      username: 'web-registration-throttle',
      password: 'short',
      password_confirmation: 'short',
      terms_accepted: true,
    }

    for (let attempt = 0; attempt < 5; attempt++) {
      const response = await client
        .post('/register')
        .withCsrfToken()
        .header('x-inertia', 'true')
        .header('referer', '/register')
        .accept('html')
        .redirects(0)
        .form(payload)

      response.assertStatus(302)
      response.assertHeader('location', '/register')
      response.assertHeader('x-ratelimit-limit', '5')
    }

    const rateLimited = await client
      .post('/register')
      .withCsrfToken()
      .header('x-inertia', 'true')
      .header('referer', '/register')
      .accept('html')
      .redirects(0)
      .form(payload)

    rateLimited.assertStatus(302)
    rateLimited.assertHeader('location', '/register')
    rateLimited.assertHeader('cache-control', 'private, no-store')
    rateLimited.assertHeader('x-ratelimit-limit', '5')
    rateLimited.assertHeader('x-ratelimit-remaining', '0')
    rateLimited.assertHeader('retry-after')
    rateLimited.assertFlashMessage('errors', {
      general: 'Too many authentication attempts. Please try again later.',
    })
    assert.isNull(await User.findBy('email', payload.email))
  })

  test('should set an HTTP-only cookie on login and clear it on logout', async ({
    client,
    assert,
  }) => {
    const user = await User.create({
      full_name: 'Web Login',
      email: 'web-login@example.com',
      username: 'web-login',
      password: 'password123',
    })
    await attachDefaultRole(user)
    const tenant = await Tenant.create({
      name: 'Web Login Operation',
      slug: 'web-login-operation',
      is_active: true,
    })
    await user.related('tenants').attach({ [tenant.id]: { role: 'member' } })

    const login = await client
      .post('/login')
      .withCsrfToken()
      .redirects(0)
      .json({ uid: user.email, password: 'password123' })

    login.assertStatus(302)
    assert.equal(login.header('location'), '/wallet')

    const tokenCookie = login.cookie(JWT_COOKIE_NAME)
    assert.exists(tokenCookie)
    assert.isNotEmpty(tokenCookie!.value)
    assert.isTrue(tokenCookie!.httpOnly)

    const authenticatedHome = await client
      .get('/')
      .cookie(JWT_COOKIE_NAME, tokenCookie!.value)
      .redirects(0)
    authenticatedHome.assertStatus(302)
    assert.equal(authenticatedHome.header('location'), '/wallet')

    const guestOnlyLogin = await client
      .get('/login')
      .cookie(JWT_COOKIE_NAME, tokenCookie!.value)
      .redirects(0)
    guestOnlyLogin.assertStatus(302)
    guestOnlyLogin.assertHeader('cache-control', 'private, no-store')
    assert.equal(guestOnlyLogin.header('location'), '/wallet')

    const legacyWallet = await client
      .get('/carteira')
      .cookie(JWT_COOKIE_NAME, tokenCookie!.value)
      .redirects(0)
    legacyWallet.assertStatus(302)
    assert.equal(legacyWallet.header('location'), '/wallet')

    const logout = await client
      .post('/logout')
      .withCsrfToken()
      .cookie(JWT_COOKIE_NAME, tokenCookie!.value)
      .redirects(0)

    logout.assertStatus(302)
    assert.equal(logout.header('location'), '/')

    const clearedCookie = logout.cookie(JWT_COOKIE_NAME)
    assert.exists(clearedCookie)
    assert.equal(clearedCookie!.value, '')
    assert.equal(clearedCookie!.path, '/')

    // A browser hitting a protected page without a session belongs on the login
    // screen, not on a bare 401 — the API keeps the JSON 401 instead.
    const dashboard = await client
      .get('/dashboard')
      .cookie(JWT_COOKIE_NAME, clearedCookie!.value)
      .redirects(0)

    dashboard.assertStatus(302)
    assert.equal(dashboard.header('location'), '/login')
  })

  test('should reject web registration without acceptance of the legal documents', async ({
    client,
    assert,
  }) => {
    const response = await client
      .post('/register')
      .header('referer', '/register')
      .withCsrfToken()
      .redirects(0)
      .json({
        full_name: 'No Acceptance',
        email: 'web-no-acceptance@example.com',
        password: 'password123',
        password_confirmation: 'password123',
        terms_accepted: false,
      })

    response.assertStatus(302)
    assert.equal(response.header('location'), '/register')
    assert.notExists(response.cookie(JWT_COOKIE_NAME))
    assert.isNull(await User.findBy('email', 'web-no-acceptance@example.com'))
  })

  test('should send an authenticated account without an active operation to public discovery', async ({
    client,
    assert,
  }) => {
    const user = await User.create({
      full_name: 'No Operation',
      email: 'no-operation@example.com',
      password: 'password123',
    })
    await attachDefaultRole(user)

    const login = await client
      .post('/login')
      .withCsrfToken()
      .redirects(0)
      .json({ uid: user.email, password: 'password123' })

    login.assertStatus(302)
    assert.equal(login.header('location'), '/cidades')
  })

  test('should send Root with an active operation to the operational dashboard', async ({
    client,
    assert,
  }) => {
    const { user } = await createUserWithOperation('Root Landing', IRole.Slugs.ROOT)

    const login = await client
      .post('/login')
      .withCsrfToken()
      .redirects(0)
      .json({ uid: user.email, password: 'password123' })

    login.assertStatus(302)
    assert.equal(login.header('location'), '/dashboard')
  })

  test('should send Admin with an active operation to the operational dashboard', async ({
    client,
    assert,
  }) => {
    const { user } = await createUserWithOperation('Admin Landing', IRole.Slugs.ADMIN)

    const login = await client
      .post('/login')
      .withCsrfToken()
      .redirects(0)
      .json({ uid: user.email, password: 'password123' })

    login.assertStatus(302)
    assert.equal(login.header('location'), '/dashboard')
  })

  test('should send Moderator with an active operation to its authorized queue', async ({
    client,
    assert,
  }) => {
    const { user } = await createUserWithOperation('Moderator Landing', IRole.Slugs.MODERATOR)

    const login = await client
      .post('/login')
      .withCsrfToken()
      .redirects(0)
      .json({ uid: user.email, password: 'password123' })

    login.assertStatus(302)
    assert.equal(login.header('location'), '/backoffice/moderation')
  })

  test('should derive the partner landing from an active organization membership', async ({
    client,
    assert,
  }) => {
    const { user, tenant } = await createUserWithOperation('Partner Landing', IRole.Slugs.USER)
    const organization = await OrganizationFactory.apply('active')
      .merge({ tenant_id: tenant.id, created_by: user.id })
      .create()
    await OrganizationMemberFactory.apply('owner')
      .merge({
        tenant_id: tenant.id,
        organization_id: organization.id,
        user_id: user.id,
      })
      .create()

    const login = await client
      .post('/login')
      .withCsrfToken()
      .redirects(0)
      .json({ uid: user.email, password: 'password123' })

    login.assertStatus(302)
    assert.equal(login.header('location'), '/portal')

    const tokenCookie = login.cookie(JWT_COOKIE_NAME)
    assert.exists(tokenCookie)

    const authenticatedHome = await client
      .get('/')
      .cookie(JWT_COOKIE_NAME, tokenCookie!.value)
      .redirects(0)
    authenticatedHome.assertStatus(302)
    assert.equal(authenticatedHome.header('location'), '/portal')

    const guestOnlyLogin = await client
      .get('/login')
      .cookie(JWT_COOKIE_NAME, tokenCookie!.value)
      .redirects(0)
    guestOnlyLogin.assertStatus(302)
    assert.equal(guestOnlyLogin.header('location'), '/portal')

    const settings = await client.get('/settings').cookie(JWT_COOKIE_NAME, tokenCookie!.value)
    settings.assertStatus(200)
    assert.isTrue(
      (parseInertiaPage(settings).props.auth as { hasActiveOrganizationMembership: boolean })
        .hasActiveOrganizationMembership
    )
  })

  test('should not treat a suspended organization membership as partner access', async ({
    client,
    assert,
  }) => {
    const { user, tenant } = await createUserWithOperation(
      'Suspended Partner Landing',
      IRole.Slugs.USER
    )
    const organization = await OrganizationFactory.apply('active')
      .merge({ tenant_id: tenant.id, created_by: user.id })
      .create()
    await OrganizationMemberFactory.apply('suspended')
      .merge({
        tenant_id: tenant.id,
        organization_id: organization.id,
        user_id: user.id,
      })
      .create()

    const login = await client
      .post('/login')
      .withCsrfToken()
      .redirects(0)
      .json({ uid: user.email, password: 'password123' })

    login.assertStatus(302)
    assert.equal(login.header('location'), '/wallet')

    const tokenCookie = login.cookie(JWT_COOKIE_NAME)
    assert.exists(tokenCookie)
    const settings = await client.get('/settings').cookie(JWT_COOKIE_NAME, tokenCookie!.value)
    settings.assertStatus(200)
    assert.isFalse(
      (parseInertiaPage(settings).props.auth as { hasActiveOrganizationMembership: boolean })
        .hasActiveOrganizationMembership
    )
  })

  test('should share partner access for a platform moderator with an active organization membership', async ({
    client,
    assert,
  }) => {
    const { user, tenant } = await createUserWithOperation(
      'Hybrid Moderator Partner',
      IRole.Slugs.MODERATOR
    )
    const organization = await OrganizationFactory.apply('active')
      .merge({ tenant_id: tenant.id, created_by: user.id })
      .create()
    await OrganizationMemberFactory.apply('owner')
      .merge({
        tenant_id: tenant.id,
        organization_id: organization.id,
        user_id: user.id,
      })
      .create()

    const login = await client
      .post('/login')
      .withCsrfToken()
      .redirects(0)
      .json({ uid: user.email, password: 'password123' })

    login.assertStatus(302)
    assert.equal(login.header('location'), '/backoffice/moderation')

    const tokenCookie = login.cookie(JWT_COOKIE_NAME)
    assert.exists(tokenCookie)

    const settings = await client.get('/settings').cookie(JWT_COOKIE_NAME, tokenCookie!.value)
    settings.assertStatus(200)

    const authProps = parseInertiaPage(settings).props.auth as {
      platformAccess: string | null
      hasActiveOrganizationMembership: boolean
    }
    assert.equal(authProps.platformAccess, 'platform_moderator')
    assert.isTrue(authProps.hasActiveOrganizationMembership)
  })

  test('should share canonical platform access without requiring an active operation', async ({
    client,
    assert,
  }) => {
    const user = await User.create({
      full_name: 'Root Without Operation',
      email: 'root-without-operation@example.com',
      password: 'password123',
    })
    await attachRole(user, IRole.Slugs.ROOT)

    const login = await client
      .post('/login')
      .withCsrfToken()
      .redirects(0)
      .json({ uid: user.email, password: 'password123' })

    login.assertStatus(302)
    assert.equal(login.header('location'), '/cidades')

    const rootSettings = await client.get('/settings').loginAs(user)
    rootSettings.assertStatus(200)
    assert.equal(
      (parseInertiaPage(rootSettings).props.auth as { platformAccess: string | null })
        .platformAccess,
      'platform_admin'
    )

    const moderator = await User.create({
      full_name: 'Moderator Without Operation',
      email: 'moderator-without-operation@example.com',
      password: 'password123',
    })
    await attachRole(moderator, IRole.Slugs.MODERATOR)
    const moderatorSettings = await client.get('/settings').loginAs(moderator)
    moderatorSettings.assertStatus(200)
    assert.equal(
      (parseInertiaPage(moderatorSettings).props.auth as { platformAccess: string | null })
        .platformAccess,
      'platform_moderator'
    )
  })

  test('should honor an explicit tenant claim across landing and shared navigation', async ({
    client,
    assert,
  }) => {
    const user = await User.create({
      full_name: 'Claimed Operation',
      email: 'claimed-operation@example.com',
      password: 'password123',
    })
    await attachDefaultRole(user)

    const tenantA = await Tenant.create({
      name: 'Claimed Operation A',
      slug: 'claimed-operation-a',
      is_active: true,
    })
    const tenantB = await Tenant.create({
      name: 'Claimed Operation B',
      slug: 'claimed-operation-b',
      is_active: true,
    })
    await user.related('tenants').attach({
      [tenantA.id]: { role: 'member' },
      [tenantB.id]: { role: 'owner' },
    })

    const organization = await OrganizationFactory.apply('active')
      .merge({ tenant_id: tenantB.id, created_by: user.id })
      .create()
    await OrganizationMemberFactory.apply('owner')
      .merge({
        tenant_id: tenantB.id,
        organization_id: organization.id,
        user_id: user.id,
      })
      .create()

    const tenantBCookie = signedWebAccessCookie(user, tenantB.id)
    const publicOperationHeaders = {
      'host': `${tenantB.slug}.experimente.test`,
      'x-forwarded-host': `${tenantB.slug}.experimente.test`,
    }

    const authenticatedHome = await client
      .get('/')
      .cookie(JWT_COOKIE_NAME, tenantBCookie)
      .redirects(0)
    authenticatedHome.assertStatus(302)
    assert.equal(authenticatedHome.header('location'), '/portal')

    const guestOnlyLogin = await client
      .get('/login')
      .cookie(JWT_COOKIE_NAME, tenantBCookie)
      .redirects(0)
    guestOnlyLogin.assertStatus(302)
    guestOnlyLogin.assertHeader('cache-control', 'private, no-store')
    assert.equal(guestOnlyLogin.header('location'), '/portal')

    const catalog = await client
      .get('/cidades')
      .headers(publicOperationHeaders)
      .cookie(JWT_COOKIE_NAME, tenantBCookie)
    catalog.assertStatus(200)
    const authProps = parseInertiaPage(catalog).props.auth as {
      activeTenantId: number | null
      tenants: Array<{ id: number }>
    }
    assert.equal(authProps.activeTenantId, tenantB.id)
    assert.deepEqual(
      authProps.tenants.map((tenant) => tenant.id),
      [tenantA.id, tenantB.id]
    )

    await user.related('tenants').detach([tenantB.id])

    const staleHome = await client.get('/').cookie(JWT_COOKIE_NAME, tenantBCookie).redirects(0)
    staleHome.assertStatus(302)
    assert.equal(staleHome.header('location'), '/cidades')

    const staleGuestRoute = await client
      .get('/login')
      .cookie(JWT_COOKIE_NAME, tenantBCookie)
      .redirects(0)
    staleGuestRoute.assertStatus(302)
    staleGuestRoute.assertHeader('cache-control', 'private, no-store')
    assert.equal(staleGuestRoute.header('location'), '/cidades')

    const staleCatalog = await client
      .get('/cidades')
      .headers(publicOperationHeaders)
      .cookie(JWT_COOKIE_NAME, tenantBCookie)
    staleCatalog.assertStatus(200)
    const staleAuthProps = parseInertiaPage(staleCatalog).props.auth as {
      activeTenantId: number | null
      tenants: Array<{ id: number }>
    }
    assert.isNull(staleAuthProps.activeTenantId)
    assert.deepEqual(
      staleAuthProps.tenants.map((tenant) => tenant.id),
      [tenantA.id]
    )

    const tenantScopedPage = await client
      .get('/dashboard')
      .cookie(JWT_COOKIE_NAME, tenantBCookie)
      .redirects(0)
    tenantScopedPage.assertStatus(403)
  })

  test('should fail closed when a signed tenant claim is malformed', async ({ client, assert }) => {
    const user = await User.create({
      full_name: 'Malformed Tenant Claim',
      email: 'malformed-tenant-claim@example.com',
      password: 'password123',
    })
    await attachRole(user, IRole.Slugs.ROOT)

    const tenant = await Tenant.create({
      name: 'Malformed Claim Operation',
      slug: 'malformed-claim-operation',
      is_active: true,
    })
    await user.related('tenants').attach({ [tenant.id]: { role: 'owner' } })

    const publicOperationHeaders = {
      'host': `${tenant.slug}.experimente.test`,
      'x-forwarded-host': `${tenant.slug}.experimente.test`,
    }

    const missingClaimCookie = signedWebAccessCookie(user)
    const legacyTenantScopedPage = await client
      .get('/dashboard')
      .cookie(JWT_COOKIE_NAME, missingClaimCookie)
    legacyTenantScopedPage.assertStatus(200)

    const malformedCookie = signedWebAccessCookie(user, null)
    const explicitHeaderPage = await client
      .get('/dashboard')
      .header('x-tenant-id', String(tenant.id))
      .cookie(JWT_COOKIE_NAME, malformedCookie)
    explicitHeaderPage.assertStatus(200)

    const invalidHeaderPage = await client
      .get('/dashboard')
      .header('x-tenant-id', 'invalid')
      .cookie(JWT_COOKIE_NAME, missingClaimCookie)
    invalidHeaderPage.assertStatus(400)

    for (const invalidClaim of [null, String(tenant.id), 0, -1, 1.5]) {
      const cookie = signedWebAccessCookie(user, invalidClaim)

      const authenticatedHome = await client.get('/').cookie(JWT_COOKIE_NAME, cookie).redirects(0)
      authenticatedHome.assertStatus(302)
      assert.equal(authenticatedHome.header('location'), '/cidades')

      const guestOnlyLogin = await client.get('/login').cookie(JWT_COOKIE_NAME, cookie).redirects(0)
      guestOnlyLogin.assertStatus(302)
      assert.equal(guestOnlyLogin.header('location'), '/cidades')

      const catalog = await client
        .get('/cidades')
        .headers(publicOperationHeaders)
        .cookie(JWT_COOKIE_NAME, cookie)
      catalog.assertStatus(200)
      const authProps = parseInertiaPage(catalog).props.auth as {
        activeTenantId: number | null
      }
      assert.isNull(authProps.activeTenantId)

      const tenantScopedPage = await client
        .get('/dashboard')
        .cookie(JWT_COOKIE_NAME, cookie)
        .redirects(0)
      tenantScopedPage.assertStatus(403)
    }
  })

  test('should keep credential pages and their redirects out of caches', async ({
    client,
    assert,
  }) => {
    for (const path of [
      '/login',
      '/register',
      '/forgot-password',
      '/reset-password?token=opaque-reset-token',
    ]) {
      const response = await client.get(path).redirects(0)
      response.assertStatus(200)
      response.assertHeader('cache-control', 'private, no-store')
    }

    const invalidLogin = await client
      .post('/login')
      .withCsrfToken()
      .redirects(0)
      .json({ uid: 'missing@example.com', password: 'wrong-password' })
    invalidLogin.assertStatus(302)
    invalidLogin.assertHeader('cache-control', 'private, no-store')

    const terms = await client.get('/termos')
    const privacy = await client.get('/privacidade')
    assert.notEqual(terms.header('cache-control'), 'private, no-store')
    assert.notEqual(privacy.header('cache-control'), 'private, no-store')
  })

  test('should render the real legal documents without authentication', async ({
    client,
    assert,
  }) => {
    const terms = await client.get('/termos')
    const privacy = await client.get('/privacidade')

    terms.assertStatus(200)
    privacy.assertStatus(200)
    assert.include(terms.text(), 'legal/terms')
    assert.include(privacy.text(), 'legal/privacy')
  })
})
