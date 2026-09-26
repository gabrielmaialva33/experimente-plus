import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

import IRoles from '#modules/roles/interfaces/role_interface'
import User from '#modules/users/models/user'
import { JWT_COOKIE_NAME } from '#shared/jwt/constants'
import { createEstablishmentScenario } from '#tests/functional/establishments/helpers'
import { createUser } from '#tests/functional/organizations/helpers'

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

test.group('Web error pages', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('renders an unknown route as a private 404 without exposing the route error', async ({
    client,
    assert,
  }) => {
    const response = await client.get('/pagina-que-nao-existe').accept('html')

    response.assertStatus(404)
    response.assertHeader('cache-control', 'private, no-store')
    response.assertHeader('x-robots-tag', 'noindex, nofollow')
    response.assertHeader('strict-transport-security', 'max-age=15552000')
    response.assertHeader('x-frame-options', 'DENY')
    response.assertHeader('x-content-type-options', 'nosniff')

    const page = parseInertiaPage(response)
    assert.equal(page.component, 'errors/not_found')
    assert.notProperty(page.props, 'error')
    assert.notInclude(JSON.stringify(page.props), 'Cannot GET')
    assert.isNull((page.props.auth as { user?: unknown } | undefined)?.user ?? null)
  })

  test('keeps an authenticated unknown route in a neutral error shell', async ({
    client,
    assert,
  }) => {
    const user = await User.create({
      full_name: 'Authenticated Error Visitor',
      email: 'authenticated-error-visitor@example.com',
      username: 'authenticated-error-visitor',
      password: 'password123',
    })
    const login = await client
      .post('/login')
      .withCsrfToken()
      .redirects(0)
      .json({ uid: user.email, password: 'password123' })
    login.assertStatus(302)
    const accessCookie = login.cookie(JWT_COOKIE_NAME)?.value
    assert.isString(accessCookie)

    const response = await client
      .get('/rota-autenticada-que-nao-existe')
      .cookie(JWT_COOKIE_NAME, accessCookie!)
      .accept('html')

    response.assertStatus(404)
    response.assertHeader('cache-control', 'private, no-store')
    response.assertHeader('x-frame-options', 'DENY')
    assert.notInclude(response.text(), 'href="/login"')
    assert.notInclude(response.text(), 'Cadastrar negócio')
    assert.include(response.text(), 'Página não encontrada')
  })

  // Web audit W27: a stale link on a web route showed
  // {"status":404,"message":"Establishment revision not found"} in English.
  test('a web route with an unknown id renders the not-found page; the API keeps JSON', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('missing-id')
    const moderator = await createUser({
      prefix: 'missing-id-mod',
      tenant: scenario.tenant,
      globalRole: IRoles.Slugs.MODERATOR,
    })
    const headers = { 'x-tenant-id': String(scenario.tenant.id) }

    const visit = await client
      .get('/backoffice/moderation/999999')
      .headers(headers)
      .loginAs(moderator)
      .accept('html')
    visit.assertStatus(404)
    assert.equal(parseInertiaPage(visit).component, 'errors/not_found')
    assert.notInclude(visit.text(), 'Establishment revision not found')

    const api = await client
      .get('/api/v1/admin/establishment-revisions/999999')
      .headers(headers)
      .loginAs(moderator)
    api.assertStatus(404)
    api.assertBody({ status: 404, message: 'Establishment revision not found' })
  })

  // Web audit W28: the edit screen received `user: null` and crashed reading
  // `full_name`.
  test('editing an unknown user renders the not-found page', async ({ client, assert }) => {
    const scenario = await createEstablishmentScenario('missing-user')
    const admin = await createUser({
      prefix: 'missing-user-admin',
      tenant: scenario.tenant,
      globalRole: IRoles.Slugs.ADMIN,
    })

    const response = await client.get('/users/99999999/edit').loginAs(admin).accept('html')

    response.assertStatus(404)
    assert.equal(parseInertiaPage(response).component, 'errors/not_found')
  })
})
