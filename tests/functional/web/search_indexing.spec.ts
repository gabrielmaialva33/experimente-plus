import { readFile } from 'node:fs/promises'
import { mock } from 'node:test'

import app from '@adonisjs/core/services/app'
import { test } from '@japa/runner'

import env from '#start/env'

/** Runs the rest of the test as another deployment, like the deployment policy specs. */
function deployment(value: string | undefined) {
  const original = env.get.bind(env)
  mock.method(env, 'get', (key: string, fallback?: unknown) =>
    key === 'DEPLOYMENT_ENV' ? value : original(key as never, fallback as never)
  )
}

function disallowed(robots: string): string[] {
  return robots
    .split('\n')
    .filter((line) => line.startsWith('Disallow:'))
    .map((line) => line.slice('Disallow:'.length).trim())
}

test.group('Search engine indexing', (group) => {
  group.each.teardown(() => mock.restoreAll())

  for (const environment of ['development', 'homologation']) {
    test(`closes the whole ${environment} site to crawlers and search results`, async ({
      client,
      assert,
    }) => {
      deployment(environment)

      const robots = await client.get('/robots.txt')
      robots.assertStatus(200)
      assert.match(robots.header('content-type') ?? '', /^text\/plain; charset=utf-8/)
      assert.equal(robots.text(), 'User-agent: *\nDisallow: /\n')
      // A crawl policy is public and the same for everyone: no session is opened.
      assert.isUndefined(robots.header('set-cookie'))

      // Pages, static files and the crawl policy itself all say noindex.
      for (const path of ['/termos', '/manifest.webmanifest', '/robots.txt']) {
        const response = await client.get(path)
        response.assertStatus(200)
        assert.equal(response.header('x-robots-tag'), 'noindex, nofollow', path)
      }
    })
  }

  test('opens public discovery in production and keeps crawlers out of the rest', async ({
    client,
    assert,
  }) => {
    deployment('production')

    const robots = await client.get('/robots.txt')
    robots.assertStatus(200)
    assert.isTrue(robots.text().startsWith('User-agent: *\n'))
    assert.isUndefined(robots.header('x-robots-tag'))

    const rules = disallowed(robots.text())
    assert.notInclude(rules, '/')
    for (const path of ['/go/', '/api/', '/portal', '/backoffice', '/wallet', '/settings']) {
      assert.include(rules, path)
    }
    for (const path of ['/login', '/register', '/forgot-password', '/reset-password']) {
      assert.include(rules, path)
    }
    // Discovery stays crawlable: the catalog, the legal pages, the app page and the manual.
    for (const path of ['/', '/cidades/londrina', '/termos', '/privacidade', '/app', '/manual']) {
      assert.isFalse(
        rules.some((rule) => path.startsWith(rule)),
        `${path} must stay open to crawlers`
      )
    }

    for (const path of ['/termos', '/manifest.webmanifest']) {
      const response = await client.get(path)
      response.assertStatus(200)
      assert.isUndefined(response.header('x-robots-tag'), path)
    }

    // Private answers keep their own noindex in production.
    const api = await client.get('/api/v1/me')
    api.assertStatus(401)
    assert.equal(api.header('x-robots-tag'), 'noindex, nofollow')
  })

  test('a missing deployment is production, as everywhere else', async ({ client, assert }) => {
    deployment(undefined)

    const robots = await client.get('/robots.txt')
    assert.include(disallowed(robots.text()), '/go/')
    assert.notInclude(disallowed(robots.text()), '/')
  })

  test('keeps every area the installable site treats as private out of the crawl', async ({
    client,
    assert,
  }) => {
    deployment('production')
    const robots = await client.get('/robots.txt')
    const rules = disallowed(robots.text())

    const cachePolicy = await readFile(app.makePath('inertia/pwa/cache_policy.ts'), 'utf8')
    const privatePrefixes = [
      ...cachePolicy
        .match(/PRIVATE_PATH_PREFIXES = \[([\s\S]*?)\] as const/)![1]
        .matchAll(/'([^']+)'/g),
    ].map(([, prefix]) => prefix)

    assert.isNotEmpty(privatePrefixes)
    for (const prefix of privatePrefixes) {
      assert.isTrue(
        rules.some((rule) => rule === prefix || rule === `${prefix}/`),
        `${prefix} is private for the service worker but open to crawlers`
      )
    }
  })
})
