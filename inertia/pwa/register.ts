import { CACHE_PREFIX } from '~/pwa/cache_policy'
import { SERVICE_WORKER_ENABLED, SERVICE_WORKER_URL } from '~/pwa/config'
import { captureInstallPrompt } from '~/pwa/install_prompt'

/** An installed app can stay open for days; look for a new worker when it comes back, hourly at most. */
const UPDATE_INTERVAL_MS = 60 * 60 * 1000
const RELOAD_GUARD_KEY = 'experimente:stale-asset-reload'
const RELOAD_GUARD_MS = 30 * 1000

/** The parts of the browser's registration objects used here. */
interface WorkerRegistration {
  active?: { scriptURL: string } | null
  waiting?: { scriptURL: string } | null
  installing?: { scriptURL: string } | null
  unregister(): Promise<boolean>
  update(): Promise<unknown>
}

interface WorkerContainer {
  register(url: string, options: RegistrationOptions): Promise<WorkerRegistration>
  getRegistrations(): Promise<readonly WorkerRegistration[]>
}

type CacheList = Pick<CacheStorage, 'keys' | 'delete'>

function isOurs(registration: WorkerRegistration, origin: string) {
  const script = registration.active ?? registration.waiting ?? registration.installing
  if (!script) return false
  const url = new URL(script.scriptURL)
  return url.origin === origin && url.pathname === SERVICE_WORKER_URL
}

/**
 * Removes this site's worker and everything it cached. Runs on every page load
 * while the worker is switched off, and in development, where a worker left by
 * a local production run would otherwise keep answering on the same origin.
 */
export async function removeServiceWorker(
  container: Pick<WorkerContainer, 'getRegistrations'>,
  cacheList: CacheList | undefined,
  origin: string
) {
  const registrations = await container.getRegistrations()
  await Promise.all(
    registrations
      .filter((registration) => isOurs(registration, origin))
      .map((registration) => registration.unregister())
  )
  if (!cacheList) return
  const names = await cacheList.keys()
  await Promise.all(
    names.filter((name) => name.startsWith(CACHE_PREFIX)).map((name) => cacheList.delete(name))
  )
}

export async function registerServiceWorker(container: WorkerContainer) {
  // `none`: the browser always asks the server for /sw.js instead of trusting its HTTP cache.
  const registration = await container.register(SERVICE_WORKER_URL, {
    scope: '/',
    updateViaCache: 'none',
  })

  let lastCheck = Date.now()
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || Date.now() - lastCheck < UPDATE_INTERVAL_MS) {
      return
    }
    lastCheck = Date.now()
    registration.update().catch(() => {})
  })

  return registration
}

/**
 * A page opened before a deploy may ask for a build file the server no longer
 * has. Vite reports that as `vite:preloadError`; reloading fetches the current
 * page and its current files. The guard stops a reload loop when the file is
 * missing for another reason (the network dropped, the server is failing): the
 * error then surfaces as it would without this.
 */
export function recoverFromStaleAsset(
  event: Event,
  session: Pick<Storage, 'getItem' | 'setItem'>,
  reload: () => void
) {
  try {
    const last = Number(session.getItem(RELOAD_GUARD_KEY)) || 0
    if (Date.now() - last < RELOAD_GUARD_MS) return
    session.setItem(RELOAD_GUARD_KEY, String(Date.now()))
  } catch {
    return
  }
  event.preventDefault()
  reload()
}

const BOUND_FLAG = '__experimenteStaleAssetRecovery'

function reloadOnStaleAssets() {
  // On `window`, not in module state, so a hot reload of this module never binds it twice.
  const scope = window as typeof window & Record<string, unknown>
  if (scope[BOUND_FLAG]) return
  scope[BOUND_FLAG] = true

  window.addEventListener('vite:preloadError', (event) => {
    let session: Storage
    try {
      session = window.sessionStorage
    } catch {
      return
    }
    recoverFromStaleAsset(event, session, () => window.location.reload())
  })
}

interface SetUpOptions {
  /** Only production builds register the worker; see `SERVICE_WORKER_ENABLED` for the kill switch. */
  enabled?: boolean
}

/** Browser-side PWA wiring, called once from the client entry (never during SSR). */
export function setUpProgressiveWebApp({
  enabled = SERVICE_WORKER_ENABLED && import.meta.env.PROD,
}: SetUpOptions = {}) {
  if (typeof window === 'undefined') return

  captureInstallPrompt(window)
  reloadOnStaleAssets()

  if (!('serviceWorker' in navigator)) return
  const container = navigator.serviceWorker as unknown as WorkerContainer
  const cacheList = typeof caches === 'undefined' ? undefined : caches

  if (!enabled) {
    removeServiceWorker(container, cacheList, window.location.origin).catch(() => {})
    return
  }

  const register = () => {
    registerServiceWorker(container).catch(() => {})
  }
  // After the page has loaded, so installing the worker never competes with the first paint.
  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register, { once: true })
}
