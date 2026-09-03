import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  isNavigationHrefActive,
  matchNavigationItem,
  navigationItemsForSurface,
  NAVIGATION_ITEMS,
  PUBLIC_NAVIGATION,
  publicNavigationItemsFor,
  ROUTE_METADATA,
  resolveRouteMetadata,
} from '~/config/navigation'

describe('navigation configuration', () => {
  it('matches an exact route', () => {
    expect(resolveRouteMetadata('/backoffice/moderation')?.id).toBe('backoffice-moderation')
  })

  it('prefers the most specific child route', () => {
    expect(resolveRouteMetadata('/portal/establishments/42/benefits')?.id).toBe(
      'portal-establishment-benefits'
    )
    expect(matchNavigationItem('/portal/redemptions/ABC-123')?.id).toBe('portal-redemptions')
    expect(resolveRouteMetadata('/portal/redemptions/validate?token=ABC')?.id).toBe(
      'portal-redemption-validation'
    )
  })

  it('normalizes query strings and trailing slashes when matching navigation', () => {
    expect(isNavigationHrefActive('/wallet/?tab=active#offer', '/wallet')).toBe(true)
    expect(matchNavigationItem('/portal/redemptions/?page=2')?.id).toBe('portal-redemptions')
  })

  it('filters navigation by surface without mixing operational items into consumer navigation', () => {
    const consumerItems = navigationItemsForSurface('consumer', 'consumer-shell')

    expect(consumerItems.map((item) => item.href)).toEqual(['/cidades', '/wallet'])
    expect(consumerItems.every((item) => item.surface === 'consumer')).toBe(true)
    expect(consumerItems.some((item) => ['/', '/dashboard', '/settings'].includes(item.href))).toBe(
      false
    )
  })

  it('keeps authenticated and guest public navigation in the central tree', () => {
    expect(PUBLIC_NAVIGATION.header.authenticated.map((item) => item.href)).toEqual([
      '/cidades',
      '/wallet',
    ])
    expect(PUBLIC_NAVIGATION.header.guest.map((item) => item.href)).toEqual(['/cidades'])
    expect(PUBLIC_NAVIGATION.mobile.authenticated.map((item) => item.href)).toEqual([
      '/cidades',
      '/wallet',
      '/portal',
      '/logout',
    ])
    expect(PUBLIC_NAVIGATION.mobile.guest.map((item) => item.href)).toEqual([
      '/cidades',
      '/login',
      '/register',
    ])
    expect(PUBLIC_NAVIGATION.footer.map((item) => item.href)).toEqual([
      '/cidades',
      '/termos',
      '/privacidade',
    ])
    expect(PUBLIC_NAVIGATION.utility.authenticated.map((item) => item.href)).toEqual([
      '/portal',
      '/logout',
    ])

    const guestRegistrationPlacements = [
      ...PUBLIC_NAVIGATION.header.guest.map((item) => ({ placement: 'header', ...item })),
      ...PUBLIC_NAVIGATION.mobile.guest.map((item) => ({ placement: 'mobile', ...item })),
      ...PUBLIC_NAVIGATION.footer.map((item) => ({ placement: 'footer', ...item })),
    ].filter((item) => item.href === '/register')

    expect(guestRegistrationPlacements).toHaveLength(1)
    expect(guestRegistrationPlacements[0]).toMatchObject({
      placement: 'mobile',
      label: 'Cadastrar negócio',
    })
  })

  it('removes tenant-required destinations when the authenticated account has no operation', () => {
    const availability = { authenticated: true, activeTenantId: null }

    expect(publicNavigationItemsFor('header', availability).map((item) => item.href)).toEqual([
      '/cidades',
    ])
    expect(publicNavigationItemsFor('mobile', availability).map((item) => item.href)).toEqual([
      '/cidades',
      '/logout',
    ])
    expect(publicNavigationItemsFor('utility', availability).map((item) => item.href)).toEqual([
      '/logout',
    ])
    expect(
      navigationItemsForSurface('consumer', 'consumer-shell', { activeTenantId: null }).map(
        (item) => item.href
      )
    ).toEqual(['/cidades'])
  })

  it('resolves the public legal documents as real destinations', () => {
    expect(resolveRouteMetadata('/termos')).toMatchObject({
      id: 'public-terms',
      surface: 'public',
    })
    expect(resolveRouteMetadata('/privacidade')).toMatchObject({
      id: 'public-privacy',
      surface: 'public',
    })
  })

  it('uses the consumer action vocabulary in the central presentation metadata', () => {
    expect(resolveRouteMetadata('/wallet/accesses/7/offers/11/use')).toMatchObject({
      id: 'consumer-presentation',
      title: 'Usar benefício',
    })
  })

  it('keeps navigation capabilities aligned with their protected page routes', () => {
    const metadataById = new Map(ROUTE_METADATA.map((metadata) => [metadata.id, metadata]))

    NAVIGATION_ITEMS.filter((item) => item.capability).forEach((item) => {
      expect(metadataById.get(item.id)?.capability).toBe(item.capability)
    })

    expect(resolveRouteMetadata('/portal/redemptions')?.capability).toBe('benefit_offers.read')
    expect(resolveRouteMetadata('/backoffice/moderation')?.capability).toBe('establishments.list')
  })

  it('does not expose the conditional UI demo route in central navigation', () => {
    expect(ROUTE_METADATA.some((metadata) => metadata.pattern === '/ui-demo')).toBe(false)
    expect(NAVIGATION_ITEMS.some((item) => item.href === '/ui-demo')).toBe(false)
  })

  it('does not restore the removed establishment redemption route', () => {
    const benefitsPage = readFileSync('inertia/pages/portal/establishments/benefits.tsx', 'utf8')

    const removedRoute = ['/portal/establishments/', '${establishment.id}', '/redemptions'].join('')

    expect(benefitsPage).not.toContain(removedRoute)
    expect(benefitsPage).toContain('href="/portal/redemptions"')
  })
})
