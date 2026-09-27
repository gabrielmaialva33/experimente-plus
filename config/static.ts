import { basename, dirname } from 'node:path'

import app from '@adonisjs/core/services/app'
import { defineConfig } from '@adonisjs/static'

/**
 * Files the browser must re-validate on every use: the service worker (a stale
 * copy would keep an old worker alive), the web app manifest and the offline
 * page it precaches. ETag keeps each check to a 304 when nothing changed.
 */
const REVALIDATED_FILES = new Set(['sw.js', 'manifest.webmanifest', 'offline.html'])

/** Vite's output under `public/assets`: a name, an 8-character content hash, an extension. */
const HASHED_ASSET = /^[\w.-]+-[\w-]{8}\.(?:js|css|woff2?|ttf|otf|svg|png|jpe?g|webp|avif|gif|ico)$/

/**
 * Caching headers for a file served from `public/`. Only files directly under
 * the public root or directly under `public/assets` are matched, never a
 * homonym in a subfolder (such as uploaded media).
 */
export function staticFileHeaders(path: string): Record<string, string> {
  const directory = dirname(path)
  const file = basename(path)

  if (directory === app.publicPath() && REVALIDATED_FILES.has(file)) {
    return { 'Cache-Control': 'no-cache' }
  }

  // A content-hashed name never changes content: a new build writes a new name.
  if (directory === app.publicPath('assets') && HASHED_ASSET.test(file)) {
    return { 'Cache-Control': 'public, max-age=31536000, immutable' }
  }

  return {}
}

/**
 * Configuration options to tweak the static files middleware.
 * The complete set of options are documented on the
 * official documentation website.
 *
 * https://docs.adonisjs.com/guides/static-assets
 */
const staticServerConfig = defineConfig({
  enabled: true,
  etag: true,
  lastModified: true,
  dotFiles: 'ignore',
  headers: staticFileHeaders,
})

export default staticServerConfig
