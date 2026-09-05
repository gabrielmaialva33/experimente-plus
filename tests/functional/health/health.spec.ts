import { test } from '@japa/runner'
import type { HttpContext } from '@adonisjs/core/http'

import HealthChecksController from '#modules/health/controllers/health_checks_controller'

test.group('Health check', () => {
  test('should return ok status', async ({ client }) => {
    const response = await client.get('/api/v1/health')

    response.assertStatus(200)
    response.assertBodyContains({ healthy: true })
  })

  test('should include required fields in response', async ({ client, assert }) => {
    const response = await client.get('/api/v1/health')

    response.assertStatus(200)
    assert.properties(response.body(), ['healthy', 'services'])
    assert.notProperty(response.body(), 'checks')

    // Check that services object exists and has database key
    assert.properties(response.body().services, ['database'])
    assert.properties(response.body().services.database, ['healthy'])
  })

  test('should not expose internal check diagnostics', async ({ client, assert }) => {
    const response = await client.get('/api/v1/health')

    response.assertStatus(200)
    assert.deepEqual(Object.keys(response.body()).sort(), ['healthy', 'services'])
    assert.notProperty(response.body(), 'checks')
  })

  test('should be accessible without authentication', async ({ client }) => {
    const response = await client.get('/api/v1/health')

    response.assertStatus(200)
  })

  test('does not issue cookies when healthy', async ({ client, assert }) => {
    const response = await client.get('/api/v1/health')

    response.assertStatus(200)
    assert.equal(response.header('cache-control'), 'no-store')
    assert.notExists(response.header('set-cookie'))
  })

  test('does not issue cookies for HEAD readiness probes', async ({ client, assert }) => {
    const response = await client.head('/api/v1/health')

    response.assertStatus(200)
    assert.equal(response.header('cache-control'), 'no-store')
    assert.notExists(response.header('set-cookie'))
  })

  test('does not issue cookies when unavailable', async ({ client, assert, cleanup }) => {
    const originalHandle = HealthChecksController.prototype.handle

    HealthChecksController.prototype.handle = async function ({ response }: HttpContext) {
      return response.serviceUnavailable({
        healthy: false,
        services: { database: { healthy: false } },
      })
    }
    cleanup(() => {
      HealthChecksController.prototype.handle = originalHandle
    })

    const response = await client.get('/api/v1/health')

    response.assertStatus(503)
    assert.equal(response.header('cache-control'), 'no-store')
    assert.notExists(response.header('set-cookie'))
  })

  test('keeps cookies emitted by non-health routes', async ({ client, assert }) => {
    const response = await client.get('/login')

    response.assertStatus(200)
    assert.exists(response.header('set-cookie'))
  })
})
