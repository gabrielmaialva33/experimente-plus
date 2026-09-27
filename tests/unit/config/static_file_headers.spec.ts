import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'

import { staticFileHeaders } from '#config/static'

test.group('Static file caching headers', () => {
  test('makes the browser re-check the service worker, the manifest and the offline page', ({
    assert,
  }) => {
    for (const file of ['sw.js', 'manifest.webmanifest', 'offline.html']) {
      assert.deepEqual(staticFileHeaders(app.publicPath(file)), { 'Cache-Control': 'no-cache' })
    }
  })

  test('lets browsers keep content-hashed build files for a year', ({ assert }) => {
    for (const file of ['app-BVs8fzCS.js', 'app-BrLzkgRr.css', 'plus-53pMUJ-R.js']) {
      assert.deepEqual(staticFileHeaders(app.publicPath('assets', file)), {
        'Cache-Control': 'public, max-age=31536000, immutable',
      })
    }
  })

  test('leaves every other file to the defaults, homonyms in subfolders included', ({ assert }) => {
    for (const path of [
      app.publicPath('favicon.svg'),
      app.publicPath('apple-touch-icon.png'),
      app.publicPath('icons', 'icon-512.png'),
      // Uploaded media shares the public folder; a file named like ours is not ours.
      app.publicPath('uploads', 'sw.js'),
      app.publicPath('uploads', 'photo-abcdefgh.png'),
      // The SSR bundle and the Vite manifest sit below /assets without a content hash.
      app.publicPath('assets', 'server', 'ssr.js'),
      app.publicPath('assets', 'server', 'app-BVs8fzCS.js'),
      app.publicPath('assets', '.vite', 'manifest.json'),
      app.publicPath('assets', 'app.js'),
    ]) {
      assert.deepEqual(staticFileHeaders(path), {}, path)
    }
  })
})
