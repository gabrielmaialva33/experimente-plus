import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { build, defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import adonisjs from '@adonisjs/vite/client'
import tailwindcss from '@tailwindcss/vite'

import { OFFLINE_URL, isHashedAssetPath } from './inertia/pwa/cache_policy.ts'

const APP_ENTRY = 'inertia/app/app.tsx'

interface ManifestChunk {
  file: string
  css?: string[]
  imports?: string[]
}

/**
 * Builds the service worker (`inertia/pwa/service_worker.ts`) into
 * `public/sw.js` after the client bundle is written, so it can precache the
 * app shell by its hashed names. The file lands next to the other public files,
 * which the AdonisJS build copies into `build/public`, and is served from the
 * root so its scope is the whole site. It is generated, hence git-ignored.
 */
function serviceWorker(): Plugin {
  const placeholder = '__EXPERIMENTE_SW_VERSION__'

  return {
    name: 'experimente:service-worker',
    apply: 'build',
    applyToEnvironment: (environment) => environment.name === 'client',
    async writeBundle(_options, bundle) {
      const { root, base } = this.environment.config
      const manifestFile = bundle['.vite/manifest.json']
      if (manifestFile?.type !== 'asset') this.error('the Vite manifest is required')
      const manifest = JSON.parse(String(manifestFile.source)) as Record<string, ManifestChunk>

      // The entry, the chunks it imports statically and their CSS: what every page loads.
      const shell = new Set<string>()
      const collect = (key: string) => {
        const chunk = manifest[key]
        if (!chunk || shell.has(`${base}${chunk.file}`)) return
        shell.add(`${base}${chunk.file}`)
        for (const css of chunk.css ?? []) shell.add(`${base}${css}`)
        for (const imported of chunk.imports ?? []) collect(imported)
      }
      collect(APP_ENTRY)
      if (shell.size === 0) this.error(`${APP_ENTRY} is missing from the Vite manifest`)
      const unhashed = [...shell].filter((path) => !isHashedAssetPath(path))
      if (unhashed.length > 0) this.error(`not content-hashed, cannot precache: ${unhashed}`)

      const offlinePage = await readFile(resolve(root, `public${OFFLINE_URL}`))
      const result = await build({
        configFile: false,
        root,
        logLevel: 'warn',
        publicDir: false,
        define: {
          SW_BUILD_VERSION: JSON.stringify(placeholder),
          SW_PRECACHE_PATHS: JSON.stringify([OFFLINE_URL, ...shell]),
        },
        build: {
          write: false,
          emptyOutDir: false,
          copyPublicDir: false,
          minify: false,
          sourcemap: false,
          lib: {
            entry: resolve(root, 'inertia/pwa/service_worker.ts'),
            formats: ['iife'],
            name: 'ExperimenteServiceWorker',
            fileName: () => 'sw.js',
          },
        },
      })
      const outputs = Array.isArray(result) ? result : [result]
      const chunk = outputs
        .flatMap((output) => ('output' in output ? output.output : []))
        .find((file) => file.type === 'chunk')
      if (!chunk || chunk.type !== 'chunk') this.error('the service worker bundle is empty')

      // Any change to the worker, the shell or the offline page yields new bytes, which is
      // what makes browsers install the new version.
      const version = createHash('sha256')
        .update(chunk.code)
        .update(offlinePage)
        .digest('hex')
        .slice(0, 12)
      const code = chunk.code.replaceAll(placeholder, version)
      await writeFile(
        resolve(root, 'public/sw.js'),
        `/* Experimente+ service worker ${version}. Generated from inertia/pwa/service_worker.ts by vite.config.ts; do not edit. */\n${code}`
      )
      this.environment.logger.info(`service worker ${version}: ${shell.size + 1} files precached`)
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    adonisjs({
      entryPoints: [APP_ENTRY],
      serverEntryPoints: ['inertia/app/ssr.tsx'],
      reload: ['resources/views/**/*.edge'],
    }),
    tailwindcss(),
    serviceWorker(),
  ],

  server: {
    allowedHosts: ['.experimente.test'],
  },

  /**
   * Define aliases for importing modules from
   * your frontend code
   */
  resolve: {
    alias: {
      '~/': `${import.meta.dirname}/inertia/`,
    },
  },
})
