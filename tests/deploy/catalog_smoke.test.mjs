import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { test } from 'node:test'

const exec = promisify(execFile)
const smokePath = fileURLToPath(new URL('../../scripts/smoke_catalog.sh', import.meta.url))

// Deliberately uses node:test rather than the Japa bootstrap, which migrates and
// seeds the database even for unit tests. Only this loopback HTTP fixture is used.
async function runSmoke({
  override,
  city = 'londrina',
  host = 'catalog.example.test',
  environment = {},
} = {}) {
  const requests = []
  const server = createServer((request, response) => {
    requests.push({ url: request.url, headers: request.headers })
    const isJson = request.url.startsWith('/api/') || request.headers['x-inertia'] === 'true'
    const result = override?.(request) ?? {}
    response.writeHead(result.status ?? 200, {
      'content-type':
        result.contentType ?? (isJson ? 'application/json' : 'text/html; charset=utf-8'),
      ...result.headers,
    })
    response.end(result.body ?? (isJson ? '{}' : '<html>Catálogo</html>'))
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))

  try {
    const output = await exec('bash', [smokePath], {
      timeout: 10000,
      env: {
        PATH: process.env.PATH,
        CATALOG_SMOKE_BASE_URL: `http://127.0.0.1:${server.address().port}`,
        CATALOG_SMOKE_HOST: host,
        CATALOG_SMOKE_CITY_SLUG: city,
        ...environment,
      },
    })
    return { code: 0, ...output, requests }
  } catch (error) {
    if (typeof error.code !== 'number') throw error
    return { code: error.code, stdout: error.stdout, stderr: error.stderr, requests }
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

test('checks home, cities, SSR, Inertia, establishments and filters with the trusted host', async () => {
  const result = await runSmoke()
  assert.equal(result.code, 0, result.stderr)
  assert.deepEqual(
    result.requests.map((request) => request.url),
    [
      '/',
      '/cidades',
      '/cidades/londrina',
      '/cidades/londrina',
      '/api/v1/catalog/cities/londrina/establishments?per_page=1',
      '/api/v1/catalog/cities/londrina/filters',
    ]
  )
  for (const request of result.requests) {
    assert.equal(request.headers.host, 'catalog.example.test')
    assert.equal(request.headers['cache-control'], 'no-cache')
    assert.equal(request.headers.authorization, undefined)
    assert.equal(request.headers.cookie, undefined)
  }
  assert.equal(result.requests[2].headers['x-inertia'], undefined)
  assert.equal(result.requests[3].headers['x-inertia'], 'true')
  assert.equal(result.requests[3].headers['x-requested-with'], 'XMLHttpRequest')
  assert.equal(result.requests[4].headers.accept, 'application/json')
  assert.equal(result.requests[5].headers.accept, 'application/json')
})

test('bypasses inherited proxy variables for loopback smoke requests', async () => {
  const proxyRequests = []
  const proxy = createServer((request, response) => {
    proxyRequests.push(request.url)
    response.writeHead(502, { 'content-type': 'text/plain' })
    response.end('false proxy')
  })
  await new Promise((resolve) => proxy.listen(0, '127.0.0.1', resolve))

  try {
    const proxyUrl = `http://127.0.0.1:${proxy.address().port}`
    const result = await runSmoke({
      environment: {
        HTTP_PROXY: proxyUrl,
        http_proxy: proxyUrl,
        ALL_PROXY: proxyUrl,
      },
    })

    assert.equal(result.code, 0, result.stderr)
    assert.equal(result.requests.length, 6)
    assert.deepEqual(proxyRequests, [])
  } finally {
    await new Promise((resolve) => proxy.close(resolve))
  }
})

for (const [name, matches] of [
  ['city SSR', (request) => request.url === '/cidades/londrina' && !request.headers['x-inertia']],
  ['city Inertia', (request) => request.headers['x-inertia'] === 'true'],
  ['establishments', (request) => request.url.includes('/establishments')],
  ['filters', (request) => request.url.endsWith('/filters')],
]) {
  test(`fails when home is healthy but ${name} returns 500, without logging SQL`, async () => {
    const rawSql = 'select attribute_slugs from catalog_establishments; PG 42703'
    const result = await runSmoke({
      override: (request) =>
        matches(request)
          ? { status: 500, contentType: 'application/json', body: rawSql }
          : undefined,
    })
    assert.equal(result.code, 1)
    assert.match(result.stderr, /HTTP 500/)
    assert.equal(result.requests.filter(matches).length, 1)
    assert.equal(`${result.stdout}${result.stderr}`.includes(rawSql), false)
  })
}

test('rejects redirects instead of following them to a successful login page', async () => {
  const result = await runSmoke({
    override: (request) =>
      request.url.includes('/establishments')
        ? { status: 302, headers: { location: '/login' } }
        : undefined,
  })
  assert.equal(result.code, 1)
  assert.match(result.stderr, /HTTP 302/)
  assert.equal(
    result.requests.some((request) => request.url === '/login'),
    false
  )
})

test('rejects an HTML 200 response from a JSON catalog endpoint', async () => {
  const result = await runSmoke({
    override: (request) =>
      request.url.endsWith('/filters') ? { contentType: 'text/html' } : undefined,
  })
  assert.equal(result.code, 1)
  assert.match(result.stderr, /esperado 200 com application\/json/)
})

test('accepts the configured city and operation instead of hardcoding their data', async () => {
  const result = await runSmoke({ city: 'cornelio-procopio', host: 'another.example.test' })
  assert.equal(result.code, 0, result.stderr)
  assert.equal(result.requests[2].url, '/cidades/cornelio-procopio')
  assert.equal(result.requests[5].url, '/api/v1/catalog/cities/cornelio-procopio/filters')
  assert.equal(
    result.requests.every((request) => request.headers.host === 'another.example.test'),
    true
  )
})

test('rejects an invalid city before making any request', async () => {
  const result = await runSmoke({ city: '../login' })
  assert.equal(result.code, 1)
  assert.equal(result.requests.length, 0)
})
