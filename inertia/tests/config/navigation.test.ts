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
    expect(resolveRouteMetadata('/portal/establishments/42/benefits')).toMatchObject({
      id: 'portal-establishment-benefits',
      title: 'Benefícios do lugar',
    })
    expect(resolveRouteMetadata('/portal/establishments/42')).toMatchObject({
      id: 'portal-establishment',
      title: 'Dados do lugar',
    })
    // A receipt lives under Utilizações; validation is its own, more specific entry.
    expect(matchNavigationItem('/portal/redemptions/ABC-123')?.id).toBe('portal-redemptions')
    expect(matchNavigationItem('/portal/redemptions/validate')?.id).toBe(
      'portal-redemption-validation'
    )
    expect(matchNavigationItem('/portal/establishments/42')?.id).toBe('portal-establishments')
    expect(resolveRouteMetadata('/portal/redemptions/ABC-123')).toMatchObject({
      id: 'portal-receipt',
      title: 'Comprovante de utilização',
    })
    expect(resolveRouteMetadata('/portal/redemptions/validate?token=ABC')?.id).toBe(
      'portal-redemption-validation'
    )
    expect(resolveRouteMetadata('/organizations/42/analytics')?.id).toBe(
      'portal-organization-analytics'
    )
    expect(resolveRouteMetadata('/portal/content')).toMatchObject({
      id: 'portal-content',
      title: 'Experiências e eventos',
    })
    expect(resolveRouteMetadata('/backoffice/content?status=pending_review')).toMatchObject({
      id: 'backoffice-content',
      title: 'Conteúdo de parceiros',
    })
  })

  it('keeps a sidebar entry current on the pages reached from it outside its path', () => {
    // These pages left the partner sidebar with nothing marked as current.
    expect(matchNavigationItem('/portal/organizations/7')?.id).toBe('portal-home')
    expect(matchNavigationItem('/portal/organizations/new')?.id).toBe('portal-home')
    expect(matchNavigationItem('/portal/organizations/7/establishments/new')?.id).toBe(
      'portal-establishments'
    )
    expect(matchNavigationItem('/organizations/7/analytics?period=30d')?.id).toBe(
      'portal-performance'
    )
    // The overview itself still matches only its own path.
    expect(matchNavigationItem('/portal/reviews')?.id).toBe('portal-reviews')
  })

  it('normalizes query strings and trailing slashes when matching navigation', () => {
    expect(isNavigationHrefActive('/wallet/?tab=active#offer', '/wallet')).toBe(true)
    expect(matchNavigationItem('/wallet/accesses/7/offers/11/use')?.id).toBe('consumer-wallet')
    expect(matchNavigationItem('/portal/?page=2')?.id).toBe('portal-home')
    expect(matchNavigationItem('/portal/redemptions/?page=2')?.id).toBe('portal-redemptions')
    expect(isNavigationHrefActive('/portal/establishments/42', '/portal', true)).toBe(false)
  })

  it('filters navigation by surface without mixing operational items into consumer navigation', () => {
    const consumerItems = navigationItemsForSurface('consumer', 'consumer-shell')

    // Explorar · Carteira · Conta, as the app's tabs; never an operational destination.
    expect(consumerItems.map((item) => item.href)).toEqual(['/cidades', '/wallet', '/settings'])
    expect(consumerItems.every((item) => item.surface === 'consumer')).toBe(true)
    expect(consumerItems.some((item) => ['/', '/dashboard'].includes(item.href))).toBe(false)
  })

  it('keeps Portal and Backoffice as separate navigation contexts', () => {
    const portalItems = navigationItemsForSurface('portal', 'sidebar', { activeTenantId: 12 })
    const backofficeItems = navigationItemsForSurface('backoffice', 'sidebar', {
      activeTenantId: 12,
      platformAccess: 'platform_moderator',
    })

    // The partner's daily tasks, in the order the portal presents them.
    expect(portalItems.map((item) => item.label)).toEqual([
      'Visão geral',
      'Validar benefício',
      'Utilizações',
      'Avaliações',
      'Experiências e eventos',
      'Dados do lugar',
      'Desempenho',
    ])
    expect(portalItems.map((item) => item.href)).toEqual([
      '/portal',
      '/portal/redemptions/validate',
      '/portal/redemptions',
      '/portal/reviews',
      '/portal/content',
      '/portal/establishments',
      '/portal/performance',
    ])
    expect(portalItems.every((item) => item.surface === 'portal')).toBe(true)
    // The operation opens on what it has to resolve today.
    expect(backofficeItems[0]).toMatchObject({ label: 'Hoje', href: '/backoffice/today' })
    expect(backofficeItems.every((item) => item.surface === 'backoffice')).toBe(true)
    expect(backofficeItems.some((item) => item.href.startsWith('/portal'))).toBe(false)
    expect(backofficeItems.some((item) => item.href === '/settings')).toBe(false)
  })

  it('fails closed for Backoffice when platform access is absent', () => {
    expect(
      navigationItemsForSurface('backoffice', 'sidebar', {
        activeTenantId: 12,
        platformAccess: null,
      })
    ).toEqual([])
  })

  it('keeps personal settings outside operational navigation', () => {
    expect(resolveRouteMetadata('/settings')).toMatchObject({
      id: 'consumer-settings',
      surface: 'consumer',
      title: 'Conta e preferências',
    })
    // Only the consumer shell links it; the backoffice and portal sidebars never do.
    const settingsItems = NAVIGATION_ITEMS.filter((item) => item.href === '/settings')
    expect(settingsItems.map((item) => [item.surface, item.placements])).toEqual([
      ['consumer', ['consumer-shell']],
    ])
  })

  it('draws the wallet with one icon in the public bars and in the wallet shell', () => {
    const walletIcon = NAVIGATION_ITEMS.find((item) => item.id === 'consumer-wallet')?.icon
    expect(walletIcon).toBeDefined()
    for (const item of [
      ...PUBLIC_NAVIGATION.header.authenticated,
      ...PUBLIC_NAVIGATION.mobile.authenticated,
    ].filter((entry) => entry.href === '/wallet')) {
      expect(item.icon).toBe(walletIcon)
    }
  })

  it('keeps authenticated and guest public navigation in the central tree', () => {
    expect(PUBLIC_NAVIGATION.header.authenticated.map((item) => item.href)).toEqual([
      '/cidades',
      '/wallet',
      '/settings',
    ])
    expect(PUBLIC_NAVIGATION.header.guest.map((item) => item.href)).toEqual(['/cidades'])
    expect(PUBLIC_NAVIGATION.mobile.authenticated.map((item) => item.href)).toEqual([
      '/cidades',
      '/wallet',
      '/settings',
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

    // The account needs no operation: it stays reachable.
    expect(publicNavigationItemsFor('header', availability).map((item) => item.href)).toEqual([
      '/cidades',
      '/settings',
    ])
    expect(publicNavigationItemsFor('mobile', availability).map((item) => item.href)).toEqual([
      '/cidades',
      '/settings',
      '/logout',
    ])
    expect(publicNavigationItemsFor('utility', availability).map((item) => item.href)).toEqual([
      '/logout',
    ])
    expect(
      navigationItemsForSurface('consumer', 'consumer-shell', { activeTenantId: null }).map(
        (item) => item.href
      )
    ).toEqual(['/cidades', '/settings'])
  })

  it('does not send a platform moderator without organization access to an empty Portal', () => {
    const availability = {
      authenticated: true,
      activeTenantId: 12,
      platformAccess: 'platform_moderator' as const,
    }

    expect(publicNavigationItemsFor('mobile', availability).map((item) => item.href)).toEqual([
      '/cidades',
      '/wallet',
      '/settings',
      '/logout',
    ])
    expect(publicNavigationItemsFor('utility', availability).map((item) => item.href)).toEqual([
      '/logout',
    ])

    expect(
      publicNavigationItemsFor('utility', {
        ...availability,
        hasActiveOrganizationMembership: true,
      }).map((item) => item.href)
    ).toEqual(['/portal', '/logout'])
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
    NAVIGATION_ITEMS.filter((item) => item.capabilitiesAnyOf).forEach((item) => {
      expect(metadataById.get(item.id)?.capabilitiesAnyOf).toEqual(item.capabilitiesAnyOf)
    })

    expect(resolveRouteMetadata('/portal/redemptions')?.capability).toBe('benefit_offers.read')
    expect(resolveRouteMetadata('/backoffice/moderation')?.capability).toBe('establishments.list')
    expect(resolveRouteMetadata('/backoffice/today')?.capability).toBe('establishments.list')
    expect(resolveRouteMetadata('/backoffice/benefits')?.capability).toBe('benefit_editions.list')
    expect(resolveRouteMetadata('/portal/content')?.capability).toBe('establishments.read')
    expect(resolveRouteMetadata('/portal/reviews')?.capability).toBe('establishments.read')
    expect(resolveRouteMetadata('/portal/establishments')?.capability).toBe('establishments.read')
    expect(resolveRouteMetadata('/portal/performance')?.capability).toBe('analytics.read')
    expect(resolveRouteMetadata('/portal/redemptions/validate')?.capability).toBe(
      'benefit_offers.update'
    )
    expect(resolveRouteMetadata('/backoffice/content')?.capability).toBe('establishments.list')
    expect(resolveRouteMetadata('/backoffice/reports')?.capability).toBe('establishments.list')
    expect(resolveRouteMetadata('/backoffice/taxonomy')?.capability).toBe('categories.list')
    expect(resolveRouteMetadata('/backoffice/geography')?.capability).toBe('cities.list')
    expect(resolveRouteMetadata('/backoffice/review-policy')?.capability).toBe('settings.read')
    expect(resolveRouteMetadata('/backoffice/concierge')?.capability).toBe('settings.read')
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

  it('does not link to a non-existent benefit-edition access page', () => {
    const benefitsPage = readFileSync('inertia/pages/backoffice/benefits/index.tsx', 'utf8')

    expect(benefitsPage).not.toMatch(/\/backoffice\/benefits\/\$\{edition\.id\}\/accesses/)
    expect(benefitsPage).toContain('/backoffice/accesses')
  })
})
