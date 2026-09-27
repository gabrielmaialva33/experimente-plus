import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  recoverFromStaleAsset,
  registerServiceWorker,
  removeServiceWorker,
  setUpProgressiveWebApp,
} from '~/pwa/register'

const origin = window.location.origin

function registration(scriptURL: string | null) {
  return {
    active: scriptURL ? { scriptURL } : null,
    waiting: null,
    installing: null,
    unregister: vi.fn(async () => true),
    update: vi.fn(async () => undefined),
  }
}

function cacheList(names: string[]) {
  return { keys: vi.fn(async () => names), delete: vi.fn(async (_name: string) => true) }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('service worker registration', () => {
  it('registers /sw.js for the whole site and never trusts an HTTP-cached copy of it', async () => {
    const container = {
      register: vi.fn(async () => registration(`${origin}/sw.js`)),
      getRegistrations: vi.fn(async () => []),
    }

    await registerServiceWorker(container)

    expect(container.register).toHaveBeenCalledWith('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    })
  })

  it('looks for a new worker when an installed app comes back after an hour', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(0)
    const worker = registration(`${origin}/sw.js`)
    await registerServiceWorker({
      register: vi.fn(async () => worker),
      getRegistrations: vi.fn(async () => []),
    })

    now.mockReturnValue(10 * 60 * 1000)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(worker.update).not.toHaveBeenCalled()

    now.mockReturnValue(61 * 60 * 1000)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(worker.update).toHaveBeenCalledTimes(1)
  })

  it('removes only its own worker and its own caches', async () => {
    const ours = registration(`${origin}/sw.js`)
    const foreign = registration(`${origin}/outro/sw.js`)
    const caches = cacheList(['experimente-precache-abc', 'experimente-assets-v1', 'outra-coisa'])

    await removeServiceWorker(
      { getRegistrations: vi.fn(async () => [ours, foreign]) },
      caches,
      origin
    )

    expect(ours.unregister).toHaveBeenCalled()
    expect(foreign.unregister).not.toHaveBeenCalled()
    expect(caches.delete.mock.calls.map(([name]) => name)).toEqual([
      'experimente-precache-abc',
      'experimente-assets-v1',
    ])
  })

  it('outside production (or switched off) unregisters a leftover worker instead of registering', async () => {
    const ours = registration(`${origin}/sw.js`)
    const register = vi.fn()
    vi.stubGlobal('caches', cacheList([]))
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { register, getRegistrations: vi.fn(async () => [ours]) },
    })

    setUpProgressiveWebApp({ enabled: false })
    await vi.waitFor(() => expect(ours.unregister).toHaveBeenCalled())
    expect(register).not.toHaveBeenCalled()

    Reflect.deleteProperty(navigator, 'serviceWorker')
  })

  it('in production registers once the page has loaded', async () => {
    const register = vi.fn(async () => registration(`${origin}/sw.js`))
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { register, getRegistrations: vi.fn(async () => []) },
    })

    setUpProgressiveWebApp({ enabled: true })
    await vi.waitFor(() => expect(register).toHaveBeenCalledTimes(1))

    Reflect.deleteProperty(navigator, 'serviceWorker')
  })

  it('reloads once when a page asks for a build file removed by a deploy', () => {
    const reload = vi.fn()
    const session = new Map<string, string>()
    const storage = {
      getItem: (key: string) => session.get(key) ?? null,
      setItem: (key: string, value: string) => void session.set(key, value),
    }

    const first = new Event('vite:preloadError', { cancelable: true })
    recoverFromStaleAsset(first, storage, reload)
    const second = new Event('vite:preloadError', { cancelable: true })
    recoverFromStaleAsset(second, storage, reload)

    expect(reload).toHaveBeenCalledTimes(1)
    expect(first.defaultPrevented).toBe(true)
    // Within the guard window the error surfaces instead of reloading in a loop.
    expect(second.defaultPrevented).toBe(false)
  })

  it('does not reload when the session storage is unavailable', () => {
    const reload = vi.fn()
    const blocked = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {},
    }

    recoverFromStaleAsset(new Event('vite:preloadError', { cancelable: true }), blocked, reload)
    expect(reload).not.toHaveBeenCalled()
  })
})
