import { describe, expect, it } from 'vitest'

import { establishmentPathOf } from '~/lib/concierge'

/**
 * The link contract of ADR-0029: a reference resolves to an establishment page
 * through `city_slug` + `establishment_slug`, and through nothing else. A
 * reference that cannot be resolved that way produces no link at all, because a
 * guessed address is as misleading as an invented place.
 */
describe('establishmentPathOf', () => {
  it('builds the public path of the establishment behind an item', () => {
    expect(
      establishmentPathOf({
        ref: 'establishment:12',
        kind: 'establishment',
        name: 'Café Central',
        city_slug: 'londrina',
        establishment_slug: 'cafe-central',
      })
    ).toBe('/cidades/londrina/estabelecimentos/cafe-central')
  })

  it('points content at the establishment that hosts it, not at the content', () => {
    expect(
      establishmentPathOf({
        ref: 'event:7',
        kind: 'event',
        name: 'Noite de jazz',
        city_slug: 'londrina',
        establishment_slug: 'cafe-central',
        establishment_name: 'Café Central',
      })
    ).toBe('/cidades/londrina/estabelecimentos/cafe-central')
  })

  it('escapes what it receives instead of trusting it to be a slug', () => {
    expect(establishmentPathOf({ city_slug: 'a b', establishment_slug: 'c/d' })).toBe(
      '/cidades/a%20b/estabelecimentos/c%2Fd'
    )
  })

  it('returns nothing when either slug is missing or blank', () => {
    expect(establishmentPathOf({ establishment_slug: 'cafe-central' })).toBeNull()
    expect(establishmentPathOf({ city_slug: 'londrina' })).toBeNull()
    expect(establishmentPathOf({ city_slug: '  ', establishment_slug: 'cafe-central' })).toBeNull()
    expect(establishmentPathOf({})).toBeNull()
  })
})
