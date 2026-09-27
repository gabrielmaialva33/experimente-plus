import { test } from '@japa/runner'

interface ManifestIcon {
  src: string
  sizes: string
  type: string
}

test.group('Installable site', () => {
  test('serves the web app manifest as JSON the browser re-validates', async ({
    client,
    assert,
  }) => {
    const response = await client.get('/manifest.webmanifest')

    response.assertStatus(200)
    assert.match(response.header('content-type') ?? '', /^application\/manifest\+json/)
    response.assertHeader('cache-control', 'no-cache')
    assert.isDefined(response.header('etag'))
    // Static files never open a session.
    assert.isUndefined(response.header('set-cookie'))

    const manifest = JSON.parse(response.text())
    assert.equal(manifest.start_url, '/')
    assert.equal(manifest.display, 'standalone')
  })

  test('serves every image the manifest and the page head point to', async ({ client, assert }) => {
    const manifestResponse = await client.get('/manifest.webmanifest')
    const manifest = JSON.parse(manifestResponse.text())
    const icons: ManifestIcon[] = [
      ...manifest.icons,
      ...manifest.shortcuts.flatMap((shortcut: { icons: ManifestIcon[] }) => shortcut.icons),
      ...manifest.screenshots,
      { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ]

    for (const icon of icons) {
      const response = await client.get(icon.src)
      response.assertStatus(200)
      assert.equal(response.header('content-type'), icon.type, icon.src)
    }
  })

  test('serves the offline page the service worker precaches', async ({ client, assert }) => {
    const response = await client.get('/offline.html')

    response.assertStatus(200)
    assert.match(response.header('content-type') ?? '', /^text\/html/)
    response.assertHeader('cache-control', 'no-cache')
    assert.include(response.text(), 'Sem conexão')
  })

  test('links the manifest and the iOS tags from the rendered pages', async ({
    client,
    assert,
  }) => {
    const response = await client.get('/app').accept('html')

    response.assertStatus(200)
    const html = response.text()
    assert.include(html, '<link rel="manifest" href="/manifest.webmanifest" />')
    assert.include(html, 'href="/apple-touch-icon.png"')
    assert.include(html, 'viewport-fit=cover')
    assert.include(html, '<meta name="apple-mobile-web-app-status-bar-style" content="default" />')
  })
})
