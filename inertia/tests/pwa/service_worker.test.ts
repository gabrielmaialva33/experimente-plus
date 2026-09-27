import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Runs the real worker module against an in-memory Cache Storage and a mocked
 * network, to check what it answers and, above all, what it stores.
 */

const origin = 'https://experimente.test'
const shell = ['/offline.html', '/assets/app-BVs8fzCS.js', '/assets/app-BrLzkgRr.css']

const absolute = (input: string | { url: string }) =>
  new URL(typeof input === 'string' ? input : input.url, origin).href

class MemoryCache {
  readonly entries = new Map<string, Response>()

  async match(input: string | { url: string }) {
    return this.entries.get(absolute(input))?.clone()
  }

  async put(input: string | { url: string }, response: Response) {
    this.entries.set(absolute(input), response)
  }

  async keys() {
    return [...this.entries.keys()].map((url) => ({ url }))
  }

  async delete(input: string | { url: string }) {
    return this.entries.delete(absolute(input))
  }
}

class MemoryCacheStorage {
  readonly stores = new Map<string, MemoryCache>()

  async open(name: string) {
    if (!this.stores.has(name)) this.stores.set(name, new MemoryCache())
    return this.stores.get(name)!
  }

  async keys() {
    return [...this.stores.keys()]
  }

  async delete(name: string) {
    return this.stores.delete(name)
  }

  async match(input: string | { url: string }) {
    for (const store of this.stores.values()) {
      const found = await store.match(input)
      if (found) return found
    }
    return undefined
  }

  /** Every URL stored in any cache. */
  storedUrls() {
    return [...this.stores.values()].flatMap((store) => [...store.entries.keys()])
  }
}

type Listener = (event: any) => void

function workerScope() {
  const listeners = new Map<string, Listener>()
  return {
    listeners,
    location: { origin },
    registration: {
      navigationPreload: { enable: vi.fn(async () => {}) },
      unregister: vi.fn(async () => true),
    },
    clients: { claim: vi.fn(async () => {}) },
    skipWaiting: vi.fn(async () => {}),
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
  }
}

function extendable() {
  const pending: Promise<unknown>[] = []
  return {
    pending,
    waitUntil: (promise: Promise<unknown>) => pending.push(promise),
    settle: () => Promise.all(pending),
  }
}

function fetchEvent(
  path: string,
  { mode = 'cors', headers = {} as Record<string, string>, preload = undefined as any } = {}
) {
  const lifetime = extendable()
  let answer: Promise<Response> | undefined
  return {
    ...lifetime,
    request: { method: 'GET', mode, url: absolute(path), headers: new Headers(headers) },
    preloadResponse: preload,
    respondWith: (response: Promise<Response>) => {
      answer = response
    },
    answer: () => answer,
  }
}

const file = (body: string, headers: Record<string, string> = {}) =>
  new Response(body, {
    status: 200,
    headers: {
      'content-type': 'text/javascript',
      'cache-control': 'public, max-age=0',
      ...headers,
    },
  })

let scope: ReturnType<typeof workerScope>
let storage: MemoryCacheStorage
let network: ReturnType<typeof vi.fn>

async function loadWorker(enabled = true) {
  vi.resetModules()
  vi.doMock('~/pwa/config', () => ({
    SERVICE_WORKER_ENABLED: enabled,
    SERVICE_WORKER_URL: '/sw.js',
  }))
  await import('~/pwa/service_worker')
}

async function install() {
  const event = extendable()
  scope.listeners.get('install')!(event)
  await event.settle()
}

async function activate() {
  const event = extendable()
  scope.listeners.get('activate')!(event)
  await event.settle()
}

async function dispatch(event: ReturnType<typeof fetchEvent>) {
  scope.listeners.get('fetch')!(event)
  const response = await event.answer()
  await event.settle()
  return response
}

beforeEach(() => {
  scope = workerScope()
  storage = new MemoryCacheStorage()
  network = vi.fn(async (input: { url: string } | string) => {
    const url = absolute(input)
    if (url.endsWith('/offline.html')) {
      return new Response('<h1>Sem conexão</h1>', {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' },
      })
    }
    return file(`/* ${url} */`)
  })
  vi.stubGlobal('self', scope)
  vi.stubGlobal('caches', storage)
  vi.stubGlobal('fetch', network)
  vi.stubGlobal('SW_BUILD_VERSION', 'v2')
  vi.stubGlobal('SW_PRECACHE_PATHS', shell)
})

afterEach(() => {
  vi.doUnmock('~/pwa/config')
  vi.unstubAllGlobals()
})

describe('service worker', () => {
  it('precaches the offline page and the app shell, then takes over at once', async () => {
    await loadWorker()
    await install()

    expect(await storage.keys()).toEqual(['experimente-precache-v2'])
    expect(storage.storedUrls().sort()).toEqual(shell.map((path) => absolute(path)).sort())
    expect(network.mock.calls.every(([request]) => request.cache === 'reload')).toBe(true)
    expect(scope.skipWaiting).toHaveBeenCalled()
  })

  it('fails the install, keeping the previous worker, when a shell file cannot be fetched', async () => {
    network.mockImplementation(async () => new Response('missing', { status: 404 }))
    await loadWorker()

    await expect(install()).rejects.toThrow(/refused to precache/)
    expect(scope.skipWaiting).not.toHaveBeenCalled()
  })

  it('reuses a hashed file kept by the previous version instead of downloading it again', async () => {
    const previous = await storage.open('experimente-precache-v1')
    await previous.put('/assets/app-BVs8fzCS.js', file('kept'))
    await loadWorker()
    await install()

    const downloaded = network.mock.calls.map(([request]) => absolute(request))
    expect(downloaded).not.toContain(absolute('/assets/app-BVs8fzCS.js'))
    // The offline page is not content-hashed, so it is always fetched again.
    expect(downloaded).toContain(absolute('/offline.html'))
  })

  it('on activation deletes its older caches only, and claims the open pages', async () => {
    await storage.open('experimente-precache-v1')
    await storage.open('another-app')
    await loadWorker()
    await install()
    await activate()

    const names = await storage.keys()
    expect(names.sort()).toEqual(['another-app', 'experimente-precache-v2'])
    expect(scope.registration.navigationPreload.enable).toHaveBeenCalled()
    expect(scope.clients.claim).toHaveBeenCalled()
  })

  it('loads pages from the network and never stores them', async () => {
    await loadWorker()
    await install()
    const before = storage.storedUrls()

    for (const path of ['/', '/cidades', '/wallet', '/portal', '/backoffice/today', '/settings']) {
      const response = await dispatch(fetchEvent(path, { mode: 'navigate' }))
      expect(await response!.text()).toBe(`/* ${absolute(path)} */`)
    }

    expect(storage.storedUrls()).toEqual(before)
  })

  it('uses the navigation preload when the browser started one', async () => {
    await loadWorker()
    const preloaded = new Response('preloaded page')
    const response = await dispatch(
      fetchEvent('/wallet', { mode: 'navigate', preload: Promise.resolve(preloaded) })
    )

    expect(await response!.text()).toBe('preloaded page')
    expect(network).not.toHaveBeenCalled()
  })

  it('answers a page with the offline page only when the network is unreachable', async () => {
    await loadWorker()
    await install()
    network.mockRejectedValue(new TypeError('Failed to fetch'))

    const response = await dispatch(fetchEvent('/wallet', { mode: 'navigate' }))
    expect(await response!.text()).toContain('Sem conexão')
  })

  it('passes a server error through instead of the offline page', async () => {
    await loadWorker()
    await install()
    network.mockResolvedValue(new Response('erro', { status: 500 }))

    const response = await dispatch(fetchEvent('/cidades', { mode: 'navigate' }))
    expect(response!.status).toBe(500)
  })

  it.each([
    ['an Inertia visit', '/wallet', { 'X-Inertia': 'true' }],
    ['an Inertia visit to a public page', '/cidades', { 'X-Inertia': 'true' }],
    ['the API', '/api/v1/me/context', {}],
    ['the wallet QR', '/api/v1/wallet/accesses/1/presentation', {}],
    ['a sign-in', '/login', {}],
    ['uploaded media', '/uploads/photo.jpg', {}],
  ])('leaves %s to the browser, untouched', async (_, path, headers) => {
    await loadWorker()
    const event = fetchEvent(path, { headers })
    scope.listeners.get('fetch')!(event)

    expect(event.answer()).toBeUndefined()
    expect(storage.storedUrls()).toEqual([])
  })

  it('serves build files cache-first and keeps them across pages', async () => {
    await loadWorker()
    const path = '/assets/establishment-qRXMTcj0.js'

    await dispatch(fetchEvent(path))
    await dispatch(fetchEvent(path))

    expect(network).toHaveBeenCalledTimes(1)
    expect(storage.storedUrls()).toEqual([absolute(path)])
    expect(await storage.keys()).toEqual(['experimente-assets-v1'])
  })

  it('does not keep a build file the server marked as not storable', async () => {
    network.mockResolvedValue(file('secret', { 'cache-control': 'no-store' }))
    await loadWorker()

    await dispatch(fetchEvent('/assets/establishment-qRXMTcj0.js'))
    expect(storage.storedUrls()).toEqual([])
  })

  it('switched off, it deletes its caches and unregisters instead of serving', async () => {
    await storage.open('experimente-precache-v1')
    await storage.open('experimente-assets-v1')
    await storage.open('another-app')
    await loadWorker(false)
    await install()
    await activate()

    expect(scope.listeners.has('fetch')).toBe(false)
    expect(await storage.keys()).toEqual(['another-app'])
    expect(scope.registration.unregister).toHaveBeenCalled()
  })
})
