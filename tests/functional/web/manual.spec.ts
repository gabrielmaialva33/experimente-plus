import { test } from '@japa/runner'

test.group('User manual', () => {
  test('serves the manual to anyone, rendered on the server', async ({ client, assert }) => {
    const response = await client.get('/manual')

    response.assertStatus(200)
    const page = response.text()
    assert.include(page, 'manual/index')
    // Server-rendered, so the text is there before any script runs.
    assert.include(page, 'Como usar o Experimente+')
    assert.include(page, 'Versão beta em homologação')
    assert.include(page, 'id="visitante-explorar"')
    assert.include(page, 'id="parceiro-validar"')
    assert.include(page, '/manual-media/manual-experimente-plus.pdf')
  })

  test('ships the PDF and the screenshots as static files', async ({ client, assert }) => {
    const pdf = await client.get('/manual-media/manual-experimente-plus.pdf')
    pdf.assertStatus(200)
    assert.include(pdf.header('content-type'), 'application/pdf')

    const screenshot = await client.get('/manual-media/visitante-busca.webp')
    screenshot.assertStatus(200)
    assert.include(screenshot.header('content-type'), 'image/webp')
  })
})
