/**
 * The Experimente+ service worker. The `experimente:service-worker` plugin in
 * `vite.config.ts` bundles this file into `public/sw.js` on every production
 * build, filling in its version and the precache list.
 *
 * It is deliberately small:
 * - pages are fetched from the network every time; when the network fails, the
 *   precached offline page answers instead. No page is ever stored;
 * - content-hashed build files are served cache-first, since a new build gives
 *   them new names instead of changing them;
 * - everything else (Inertia visits, the API, sign-in, the wallet, the portal,
 *   the back office) passes through untouched. See `cache_policy.ts`.
 *
 * A new version activates at once: nothing it keeps can go stale (pages always
 * come from the network, and they name the build files they need), so there is
 * no old shell to protect.
 */
import {
  CACHE_PREFIX,
  OFFLINE_URL,
  isNavigationRequest,
  mayCacheRequest,
  mayStoreResponse,
} from './cache_policy'
import { SERVICE_WORKER_ENABLED } from './config'

/* Filled in by the build: a hash of this worker and its inputs, and the paths to precache. */
declare const SW_BUILD_VERSION: string
declare const SW_PRECACHE_PATHS: readonly string[]

/* The few worker types used here; the web app's TypeScript project uses the DOM library. */
interface ExtendableEvent extends Event {
  waitUntil(promise: Promise<unknown>): void
}

interface FetchEvent extends ExtendableEvent {
  readonly request: Request
  readonly preloadResponse?: Promise<Response | undefined>
  respondWith(response: Promise<Response>): void
}

interface WorkerScope {
  readonly location: { readonly origin: string }
  readonly registration: {
    readonly navigationPreload?: { enable(): Promise<void> }
    unregister(): Promise<boolean>
  }
  readonly clients: { claim(): Promise<void> }
  skipWaiting(): Promise<void>
  addEventListener(type: 'install' | 'activate', listener: (event: ExtendableEvent) => void): void
  addEventListener(type: 'fetch', listener: (event: FetchEvent) => void): void
}

const worker = self as unknown as WorkerScope

/** Replaced whole on every version: the offline page and the app shell. */
const PRECACHE = `${CACHE_PREFIX}precache-${SW_BUILD_VERSION}`
/** Build files fetched as pages need them. Hashed names never go stale, so it spans versions. */
const ASSETS = `${CACHE_PREFIX}assets-v1`
const ASSETS_LIMIT = 150

async function ownCaches() {
  const names = await caches.keys()
  return names.filter((name) => name.startsWith(CACHE_PREFIX))
}

async function precache() {
  const cache = await caches.open(PRECACHE)
  await Promise.all(
    SW_PRECACHE_PATHS.map(async (path) => {
      const url = new URL(path, worker.location.origin).href
      // A hashed file kept by an earlier version is the very same file: reuse it.
      if (path !== OFFLINE_URL) {
        const kept = await caches.match(url)
        if (kept) return cache.put(url, kept)
      }
      // Past the HTTP cache: the worker's copy must be the server's current file.
      const response = await fetch(new Request(url, { cache: 'reload' }))
      if (!mayStoreResponse(url, response)) {
        throw new Error(`Service worker: refused to precache ${path} (${response.status})`)
      }
      await cache.put(url, response)
    })
  )
}

async function keepAsset(request: Request, response: Response) {
  const cache = await caches.open(ASSETS)
  await cache.put(request, response)
  const keys = await cache.keys()
  const excess = keys.length - ASSETS_LIMIT
  if (excess > 0) await Promise.all(keys.slice(0, excess).map((key) => cache.delete(key)))
}

/** Network-first without storing: the offline page only when the network is unreachable. */
async function navigate(event: FetchEvent): Promise<Response> {
  try {
    return (await event.preloadResponse) ?? (await fetch(event.request))
  } catch {
    return (await caches.match(OFFLINE_URL)) ?? Response.error()
  }
}

async function cacheFirst(event: FetchEvent): Promise<Response> {
  const cached = await caches.match(event.request)
  if (cached) return cached

  const response = await fetch(event.request)
  if (mayStoreResponse(event.request.url, response)) {
    event.waitUntil(keepAsset(event.request, response.clone()))
  }
  return response
}

function serve() {
  worker.addEventListener('install', (event) => {
    event.waitUntil(precache().then(() => worker.skipWaiting()))
  })

  worker.addEventListener('activate', (event) => {
    event.waitUntil(
      (async () => {
        const kept = new Set([PRECACHE, ASSETS])
        const stale = await ownCaches()
        await Promise.all(
          stale.filter((name) => !kept.has(name)).map((name) => caches.delete(name))
        )
        // Starts the page request while the worker boots, so network-first costs no extra time.
        await worker.registration.navigationPreload?.enable()
        await worker.clients.claim()
      })()
    )
  })

  worker.addEventListener('fetch', (event) => {
    const { request } = event
    if (isNavigationRequest(request)) {
      event.respondWith(navigate(event))
      return
    }
    // Anything else not on the allowlist is left to the browser, as if there were no worker.
    if (!mayCacheRequest(request, worker.location.origin)) return
    event.respondWith(cacheFirst(event))
  })
}

/** The kill switch: take over, forget everything, leave. No fetch handler at all. */
function retire() {
  worker.addEventListener('install', (event) => {
    event.waitUntil(worker.skipWaiting())
  })

  worker.addEventListener('activate', (event) => {
    event.waitUntil(
      (async () => {
        const names = await ownCaches()
        await Promise.all(names.map((name) => caches.delete(name)))
        await worker.registration.unregister()
      })()
    )
  })
}

if (SERVICE_WORKER_ENABLED) serve()
else retire()
