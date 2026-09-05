import { test } from '@japa/runner'

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
})
