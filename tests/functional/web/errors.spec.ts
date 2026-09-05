import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

import User from '#modules/users/models/user'
import { JWT_COOKIE_NAME } from '#shared/jwt/constants'

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
})
