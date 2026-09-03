import { describe, expect, it } from 'vitest'

import {
  catalogCategories,
  catalogCities,
  catalogDetail,
  catalogSearch,
  pageHref,
} from '~/lib/catalog'

describe('catalog projection adapters', () => {
  it('normalizes city and category projections without exposing persistence details', () => {
    const cities = catalogCities([
      {
        slug: 'cornelio-procopio',
        name: 'Cornélio Procópio',
        state_code: 'PR',
        country_code: 'BR',
        timezone: 'America/Sao_Paulo',
        region: { name: 'Norte Pioneiro' },
        establishments_count: 12,
        tenant_id: 99,
      },
    ])

    const listing = catalogCategories({
      city: {
        slug: 'cornelio-procopio',
        name: 'Cornélio Procópio',
        state_code: 'PR',
        timezone: 'America/Sao_Paulo',
      },
      categories: [
        {
          slug: 'cafes',
          name: 'Cafés',
          description: 'Cafés e boas pausas.',
          family: { name: 'Gastronomia' },
          establishments_count: 4,
        },
      ],
    })

    expect(cities).toEqual([
      {
        slug: 'cornelio-procopio',
        name: 'Cornélio Procópio',
        stateCode: 'PR',
        countryCode: 'BR',
        timezone: 'America/Sao_Paulo',
        regionName: 'Norte Pioneiro',
        establishmentsCount: 12,
      },
    ])
    expect(listing.city.name).toBe('Cornélio Procópio')
    expect(listing.categories[0]).toMatchObject({
      slug: 'cafes',
      name: 'Cafés',
      familyName: 'Gastronomia',
      establishmentsCount: 4,
    })
  })

  it('normalizes sponsored, organic, pagination and query data from the public search', () => {
    const result = catalogSearch({
      context: {
        city: {
          slug: 'cornelio-procopio',
          name: 'Cornélio Procópio',
          state_code: 'PR',
          timezone: 'America/Sao_Paulo',
        },
        category: {
          slug: 'cafes',
          name: 'Cafés',
          description: 'Cafés e boas pausas.',
          icon: null,
          parent_slug: null,
          family: { slug: 'gastronomia', name: 'Gastronomia', icon: null },
        },
      },
      sponsored_results: [
        {
          slug: 'cafe-aurora',
          name: 'Café Aurora',
          short_description: 'Café especial no centro.',
          city: { slug: 'cornelio-procopio', name: 'Cornélio Procópio', state_code: 'PR' },
          address: { district: 'Centro' },
          business_status: 'open',
          is_open_now: true,
          is_sponsored: true,
          primary_category: { slug: 'cafes', name: 'Cafés', is_primary: true },
          categories: [{ slug: 'cafes', name: 'Cafés', is_primary: true }],
          cover: {
            alt_text: 'Fachada do Café Aurora',
            is_cover: true,
            asset: { url: '/media/cafe-aurora.webp', width: 1200, height: 900 },
          },
        },
      ],
      organic_results: [
        {
          slug: 'padaria-central',
          name: 'Padaria Central',
          city: { slug: 'cornelio-procopio', name: 'Cornélio Procópio', state_code: 'PR' },
          business_status: 'temporarily_closed',
          is_open_now: false,
          primary_category: { slug: 'padarias', name: 'Padarias', is_primary: true },
          categories: [{ slug: 'padarias', name: 'Padarias', is_primary: true }],
        },
      ],
      meta: { total: 2, page: 2, per_page: 12, last_page: 3 },
      query: { q: 'cafe', category: 'cafes', open_now: true, sort: 'recent' },
    })

    expect(result.meta).toEqual({ total: 2, page: 2, perPage: 12, lastPage: 3 })
    expect(result.query).toEqual({ q: 'cafe', category: 'cafes', openNow: true, sort: 'recent' })
    expect(result.context).toEqual({
      city: {
        slug: 'cornelio-procopio',
        name: 'Cornélio Procópio',
        stateCode: 'PR',
        timezone: 'America/Sao_Paulo',
      },
      category: {
        slug: 'cafes',
        name: 'Cafés',
        description: 'Cafés e boas pausas.',
        icon: null,
        parentSlug: null,
        family: { slug: 'gastronomia', name: 'Gastronomia', icon: null },
      },
    })
    expect(result.sponsored[0]).toMatchObject({
      slug: 'cafe-aurora',
      cityName: 'Cornélio Procópio',
      district: 'Centro',
      isOpenNow: true,
      isSponsored: true,
      primaryCategory: { slug: 'cafes', name: 'Cafés' },
      cover: {
        url: '/media/cafe-aurora.webp',
        altText: 'Fachada do Café Aurora',
        width: 1200,
        height: 900,
      },
    })
    expect(result.organic[0].businessStatus).toBe('temporarily_closed')
  })

  it('rejects catalog payloads without the required canonical city', () => {
    expect(() => catalogCategories({ categories: [] })).toThrow(
      'Catalog categories response is missing its canonical city'
    )
    expect(() =>
      catalogSearch({
        context: { city: null, category: null },
        sponsored_results: [],
        organic_results: [],
        meta: {},
        query: {},
      })
    ).toThrow('Catalog search response is missing its canonical city')
    expect(
      catalogDetail({
        slug: 'sem-cidade',
        name: 'Estabelecimento sem cidade canônica',
        city_slug: 'slug-nao-deve-virar-nome',
        city_name: 'Nome legado',
      })
    ).toBeNull()
  })

  it('does not manufacture missing fields for reduced catalog contexts', () => {
    expect(() =>
      catalogCategories({
        city: { slug: 'londrina', name: 'Londrina', state_code: 'PR' },
        categories: [],
      })
    ).toThrow('Catalog categories response is missing its canonical city')

    const city = {
      slug: 'londrina',
      name: 'Londrina',
      state_code: 'PR',
      timezone: 'America/Sao_Paulo',
    }
    const emptyResult = {
      sponsored_results: [],
      organic_results: [],
      meta: {},
      query: {},
    }

    expect(() => catalogSearch({ context: { city }, ...emptyResult })).toThrow(
      'Catalog search response is missing its canonical category context'
    )
    expect(() =>
      catalogSearch({
        context: {
          city,
          category: {
            slug: 'cafes',
            name: 'Cafés',
            family: { slug: 'gastronomia', name: 'Gastronomia' },
          },
        },
        ...emptyResult,
      })
    ).toThrow('Catalog search response has an invalid canonical category context')
  })

  it('normalizes the full published establishment detail and preserves false and zero values', () => {
    const detail = catalogDetail({
      slug: 'cafe-aurora',
      name: 'Café Aurora',
      short_description: 'Café especial no centro.',
      description: 'Torra própria e atendimento local.',
      city: {
        slug: 'cornelio-procopio',
        name: 'Cornélio Procópio',
        state_code: 'PR',
        timezone: 'America/Sao_Paulo',
      },
      address: {
        postal_code: '86300-000',
        street: 'Avenida XV de Novembro',
        number: '100',
        district: 'Centro',
        latitude: -23.181,
        longitude: -50.646,
      },
      contacts: {
        phone: '+554335210000',
        whatsapp: '+5543999990000',
        email: 'contato@cafe.test',
        website: 'https://cafe.test',
        instagram: '@cafeaurora',
        booking_url: 'https://cafe.test/reservas',
      },
      business_status: 'open',
      availability_type: 'regular_hours',
      is_open_now: true,
      categories: [{ slug: 'cafes', name: 'Cafés', is_primary: true }],
      attributes: [
        { key: 'wifi', name: 'Wi-Fi', type: 'boolean', value: false, options: [] },
        { key: 'taxa', name: 'Taxa', type: 'decimal', unit: '%', value: 0, options: [] },
        {
          key: 'ambientes',
          name: 'Ambientes',
          type: 'multi_select',
          value: null,
          options: [
            { label: 'Interno', value: 'interno' },
            { label: 'Externo', value: 'externo' },
          ],
        },
      ],
      opening_hours: {
        weekly: [{ weekday: 1, opens_at: '08:00:00', closes_at: '18:00:00', sort_order: 0 }],
        special_days: [
          {
            date: '2026-12-24',
            status: 'custom_hours',
            note: 'Véspera de Natal',
            intervals: [{ opens_at: '08:00:00', closes_at: '12:00:00', sort_order: 0 }],
          },
        ],
      },
      media: [
        {
          alt_text: 'Fachada do Café Aurora',
          caption: 'Entrada principal',
          is_cover: true,
          purpose: 'gallery',
          asset: { url: '/media/cover.webp', width: 1200, height: 900 },
        },
        {
          alt_text: 'Salão do Café Aurora',
          is_cover: false,
          asset: { url: '/media/salao.webp', width: 1200, height: 900 },
        },
      ],
      cover: {
        alt_text: 'Fachada do Café Aurora',
        is_cover: true,
        asset: { url: '/media/cover.webp', width: 1200, height: 900 },
      },
      is_sponsored: false,
      published_at: '2026-08-20T12:00:00.000Z',
      updated_at: '2026-08-21T12:00:00.000Z',
    })

    expect(detail?.historical).toBe(false)
    if (!detail || detail.historical) throw new Error('Expected a published establishment')

    expect(detail.city).toMatchObject({ slug: 'cornelio-procopio', stateCode: 'PR' })
    expect(detail.address).toMatchObject({ district: 'Centro', latitude: -23.181 })
    expect(detail.contacts.whatsapp).toBe('+5543999990000')
    expect(detail.attributes.find((attribute) => attribute.key === 'wifi')?.value).toBe(false)
    expect(detail.attributes.find((attribute) => attribute.key === 'taxa')?.value).toBe(0)
    expect(
      detail.attributes.find((attribute) => attribute.key === 'ambientes')?.options
    ).toHaveLength(2)
    expect(detail.weeklyHours[0]).toMatchObject({ weekday: 1, opensAt: '08:00', closesAt: '18:00' })
    expect(detail.specialDays[0]).toMatchObject({
      date: '2026-12-24',
      status: 'custom_hours',
      note: 'Véspera de Natal',
    })
    expect(detail.cover?.url).toBe('/media/cover.webp')
    expect(detail.media).toHaveLength(2)
  })

  it('normalizes historical references without retaining contact actions', () => {
    const detail = catalogDetail({
      historical: true,
      slug: 'cafe-antigo',
      name: 'Café Antigo',
      city: { slug: 'londrina', name: 'Londrina', state_code: 'PR' },
      business_status: 'permanently_closed',
      message: 'Este estabelecimento encerrou as atividades.',
      contacts: { phone: '+554300000000' },
    })

    expect(detail).toEqual({
      historical: true,
      slug: 'cafe-antigo',
      name: 'Café Antigo',
      city: {
        slug: 'londrina',
        name: 'Londrina',
        stateCode: 'PR',
        countryCode: null,
        timezone: null,
        regionName: null,
        establishmentsCount: 0,
      },
      businessStatus: 'permanently_closed',
      message: 'Este estabelecimento encerrou as atividades.',
      publishedAt: null,
      updatedAt: null,
    })
  })

  it('builds stable pagination URLs preserving the active discovery filters', () => {
    expect(
      pageHref(
        '/cidades/cornelio-procopio',
        { q: 'café', category: 'cafes', openNow: true, sort: 'recent' },
        3,
        12
      )
    ).toBe(
      '/cidades/cornelio-procopio?q=caf%C3%A9&category=cafes&open_now=true&sort=recent&per_page=12&page=3'
    )
  })
})
