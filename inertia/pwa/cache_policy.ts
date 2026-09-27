/**
 * What the service worker may keep, decided in one place and without touching
 * the browser, so every rule is unit-tested.
 *
 * The site shows private data: the wallet and its presentation QR codes,
 * orders, the partner portal, the back office and session tokens. The rule is
 * therefore an allowlist: only content-hashed build files and the offline page
 * are ever read from or written to Cache Storage. Pages (HTML navigations),
 * Inertia responses, the API and anything a session could personalize always
 * go to the network and are never stored.
 */

/** Every cache the worker owns starts with this, so it can find and delete its own. */
export const CACHE_PREFIX = 'experimente-'

/** The static page shown when a navigation fails for lack of network. */
export const OFFLINE_URL = '/offline.html'

/**
 * Personal or session-bound areas. The allowlist already refuses them; naming
 * them keeps the intent explicit and survives a careless widening of it.
 */
export const PRIVATE_PATH_PREFIXES = [
  '/api',
  '/wallet',
  '/carteira',
  '/portal',
  '/backoffice',
  '/settings',
  '/dashboard',
  '/organizations',
  '/users',
  '/roles',
  '/permissions',
  '/files',
  '/tenant',
  '/login',
  '/logout',
  '/register',
  '/forgot-password',
  '/reset-password',
] as const

/**
 * A file emitted by Vite into `/assets/`: one path segment (so never the SSR
 * bundle under `/assets/server/` or the manifest under `/assets/.vite/`), a
 * name, an 8-character content hash and a static extension. The hash makes the
 * file immutable: a new build writes a new name instead of changing this one.
 */
const HASHED_ASSET_PATH =
  /^\/assets\/[\w.-]+-[\w-]{8}\.(?:js|css|woff2?|ttf|otf|svg|png|jpe?g|webp|avif|gif|ico)$/

/** The parts of a `Request` the policy reads; a real `Request` satisfies it. */
export interface RequestFacts {
  method: string
  url: string
  mode?: string
  headers: { has(name: string): boolean }
}

/** The parts of a `Response` the policy reads; a real `Response` satisfies it. */
export interface ResponseFacts {
  status: number
  type: string
  redirected?: boolean
  headers: { get(name: string): string | null; has(name: string): boolean }
}

export function isPrivatePath(pathname: string): boolean {
  const path = pathname.toLowerCase()
  return PRIVATE_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}

export function isHashedAssetPath(pathname: string): boolean {
  return HASHED_ASSET_PATH.test(pathname)
}

/** A top-level page load. Always network-first, never stored. */
export function isNavigationRequest(request: Pick<RequestFacts, 'method' | 'mode'>): boolean {
  return request.method === 'GET' && request.mode === 'navigate'
}

/**
 * Whether a request may be answered from, and its response written to, the
 * cache. Everything that returns `false` passes through the worker untouched.
 */
export function mayCacheRequest(request: RequestFacts, origin: string): boolean {
  if (request.method !== 'GET') return false
  if (request.mode === 'navigate') return false
  // Inertia visits carry page props (the user, the wallet, flash messages).
  if (request.headers.has('x-inertia')) return false
  if (request.headers.has('authorization')) return false
  if (request.headers.has('range')) return false

  let url: URL
  try {
    url = new URL(request.url)
  } catch {
    return false
  }

  if (url.origin !== origin) return false
  // Build files never carry a query; one would only add a way to smuggle state into a key.
  if (url.search !== '' || url.username !== '' || url.password !== '') return false
  if (isPrivatePath(url.pathname)) return false

  return url.pathname === OFFLINE_URL || isHashedAssetPath(url.pathname)
}

/**
 * Whether a response to an allowed request may be stored. It rejects anything
 * a server marked as personal, anything that is not a plain same-origin 200
 * and any HTML other than the offline page.
 */
export function mayStoreResponse(url: string, response: ResponseFacts): boolean {
  if (response.status !== 200) return false
  // `basic` is a same-origin response in a browser; `default` is one built by hand.
  if (response.type !== 'basic' && response.type !== 'default') return false
  if (response.redirected) return false

  const cacheControl = (response.headers.get('cache-control') ?? '').toLowerCase()
  if (/(?:^|[\s,])(?:no-store|private)(?:$|[\s,=])/.test(cacheControl)) return false
  // Browsers hide Set-Cookie from scripts, so this is defence in depth, not the main guard.
  if (response.headers.has('set-cookie')) return false
  if ((response.headers.get('vary') ?? '').includes('*')) return false

  let pathname: string
  try {
    pathname = new URL(url).pathname
  } catch {
    return false
  }

  const contentType = (response.headers.get('content-type') ?? '').toLowerCase()
  if (contentType.startsWith('text/html') && pathname !== OFFLINE_URL) return false

  return true
}
