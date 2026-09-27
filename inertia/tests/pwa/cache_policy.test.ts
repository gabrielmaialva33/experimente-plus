import { describe, expect, it } from 'vitest'

import {
  OFFLINE_URL,
  PRIVATE_PATH_PREFIXES,
  isHashedAssetPath,
  isNavigationRequest,
  isPrivatePath,
  mayCacheRequest,
  mayStoreResponse,
} from '~/pwa/cache_policy'

const origin = 'https://experimente.test'

function request(
  path: string,
  { method = 'GET', mode = 'cors', headers = {} as Record<string, string> } = {}
) {
  return { method, mode, url: new URL(path, origin).href, headers: new Headers(headers) }
}

function response(
  headers: Record<string, string> = { 'content-type': 'text/javascript' },
  { status = 200, type = 'basic', redirected = false } = {}
) {
  return { status, type, redirected, headers: new Headers(headers) }
}

describe('service worker cache policy', () => {
  describe('requests', () => {
    it.each([
      '/assets/app-BVs8fzCS.js',
      '/assets/app-BrLzkgRr.css',
      '/assets/rolldown-runtime-hePW80VL.js',
      '/assets/plus-53pMUJ-R.js',
      '/assets/data-grid-table-CML4L5FO.js',
      OFFLINE_URL,
    ])('allows the static file %s', (path) => {
      expect(mayCacheRequest(request(path), origin)).toBe(true)
    })

    it.each([
      // Personal or session-bound pages, as a browser would fetch them.
      '/wallet',
      '/wallet/history',
      '/wallet/redemptions/ABC123',
      '/wallet/accesses/1/offers/2/use',
      '/carteira',
      '/portal',
      '/portal/redemptions/validate',
      '/backoffice/today',
      '/backoffice/moderation/12',
      '/settings',
      '/dashboard',
      '/organizations/3/analytics',
      '/users/5/edit',
      '/roles',
      '/permissions',
      '/files',
      // Authentication.
      '/login',
      '/register',
      '/forgot-password',
      '/reset-password?token=secret',
      // The API, including the session context and the wallet's presentation QR.
      '/api/v1/me/context',
      '/api/v1/wallet',
      '/api/v1/auth/refresh',
      // Public pages are still pages: never stored either.
      '/',
      '/cidades',
      '/cidades/londrina',
      '/app',
      // Not build output.
      '/assets/server/app.js',
      '/assets/.vite/manifest.json',
      '/assets/app.js',
      '/sw.js',
      '/manifest.webmanifest',
      '/uploads/establishments/photo.jpg',
      '/favicon.svg',
    ])('refuses %s', (path) => {
      expect(mayCacheRequest(request(path), origin)).toBe(false)
    })

    it('refuses an Inertia visit even to a build-file-looking address', () => {
      const visit = request('/assets/app-BVs8fzCS.js', { headers: { 'X-Inertia': 'true' } })
      expect(mayCacheRequest(visit, origin)).toBe(false)
      expect(
        mayCacheRequest(request('/cidades', { headers: { 'X-Inertia': 'true' } }), origin)
      ).toBe(false)
    })

    it('refuses navigations, other methods, other origins and requests with credentials', () => {
      const asset = '/assets/app-BVs8fzCS.js'
      expect(mayCacheRequest(request(asset, { mode: 'navigate' }), origin)).toBe(false)
      expect(mayCacheRequest(request(asset, { method: 'POST' }), origin)).toBe(false)
      expect(mayCacheRequest(request(asset, { method: 'HEAD' }), origin)).toBe(false)
      expect(
        mayCacheRequest(request(asset, { headers: { Authorization: 'Bearer token' } }), origin)
      ).toBe(false)
      expect(mayCacheRequest(request(asset, { headers: { Range: 'bytes=0-10' } }), origin)).toBe(
        false
      )
      expect(mayCacheRequest(request(asset), 'https://outra.test')).toBe(false)
      expect(mayCacheRequest(request('https://fonts.bunny.net/css?family=x'), origin)).toBe(false)
    })

    it('refuses a query string, which a build file never has', () => {
      expect(mayCacheRequest(request('/assets/app-BVs8fzCS.js?user=1'), origin)).toBe(false)
      expect(mayCacheRequest(request(`${OFFLINE_URL}?v=1`), origin)).toBe(false)
    })

    it('treats only GET page loads as navigations', () => {
      expect(isNavigationRequest({ method: 'GET', mode: 'navigate' })).toBe(true)
      expect(isNavigationRequest({ method: 'POST', mode: 'navigate' })).toBe(false)
      expect(isNavigationRequest({ method: 'GET', mode: 'cors' })).toBe(false)
    })
  })

  describe('private areas', () => {
    it.each(PRIVATE_PATH_PREFIXES)('marks %s and everything under it as private', (prefix) => {
      expect(isPrivatePath(prefix)).toBe(true)
      expect(isPrivatePath(`${prefix}/anything`)).toBe(true)
      expect(isPrivatePath(prefix.toUpperCase())).toBe(true)
    })

    it('does not mistake a longer public name for a private area', () => {
      expect(isPrivatePath('/wallets-guide')).toBe(false)
      expect(isPrivatePath('/cidades')).toBe(false)
    })
  })

  describe('build file names', () => {
    it('accepts one hashed file directly under /assets', () => {
      expect(isHashedAssetPath('/assets/app-BVs8fzCS.js')).toBe(true)
      expect(isHashedAssetPath('/assets/app-BrLzkgRr.css')).toBe(true)
    })

    it('rejects nested, unhashed or non-static files', () => {
      expect(isHashedAssetPath('/assets/server/app-BVs8fzCS.js')).toBe(false)
      expect(isHashedAssetPath('/assets/app.js')).toBe(false)
      expect(isHashedAssetPath('/assets/app-BVs8fzCS.html')).toBe(false)
      expect(isHashedAssetPath('/wallet/app-BVs8fzCS.js')).toBe(false)
    })
  })

  describe('responses', () => {
    const asset = `${origin}/assets/app-BVs8fzCS.js`

    it('stores a plain same-origin 200 as the static server sends it', () => {
      expect(
        mayStoreResponse(
          asset,
          response({ 'content-type': 'text/javascript', 'cache-control': 'public, max-age=0' })
        )
      ).toBe(true)
      expect(
        mayStoreResponse(
          `${origin}${OFFLINE_URL}`,
          response({ 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' })
        )
      ).toBe(true)
    })

    it.each([
      ['private', { 'cache-control': 'private, max-age=60' }],
      ['no-store', { 'cache-control': 'no-store' }],
      ['NO-STORE in capitals', { 'cache-control': 'NO-STORE' }],
      ['a cookie', { 'set-cookie': 'session=abc' }],
      ['Vary: *', { vary: '*' }],
      ['an HTML page', { 'content-type': 'text/html; charset=utf-8' }],
    ])('refuses a response marked with %s', (_, headers) => {
      expect(mayStoreResponse(asset, response(headers))).toBe(false)
    })

    it('refuses errors, partial content, redirects and opaque or cross-origin responses', () => {
      expect(mayStoreResponse(asset, response(undefined, { status: 404 }))).toBe(false)
      expect(mayStoreResponse(asset, response(undefined, { status: 206 }))).toBe(false)
      expect(mayStoreResponse(asset, response(undefined, { redirected: true }))).toBe(false)
      expect(mayStoreResponse(asset, response(undefined, { type: 'opaque', status: 0 }))).toBe(
        false
      )
      expect(mayStoreResponse(asset, response(undefined, { type: 'cors' }))).toBe(false)
    })
  })
})
