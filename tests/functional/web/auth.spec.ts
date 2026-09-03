import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import mail from '@adonisjs/mail/services/main'

import { OrganizationFactory, OrganizationMemberFactory } from '#database/factories/index'
import IRole from '#modules/roles/interfaces/role_interface'
import Role from '#modules/roles/models/role'
import Tenant from '#modules/tenants/models/tenant'
import User from '#modules/users/models/user'
import { JWT_COOKIE_NAME } from '#shared/jwt/constants'

test.group('Web authentication', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

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
  })

  test('should keep a platform role without an active operation in public discovery', async ({
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
