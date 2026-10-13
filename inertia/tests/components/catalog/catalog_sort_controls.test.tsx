import { router } from '@inertiajs/react'
import { screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CatalogSearchForm } from '~/components/catalog/catalog_search_form'
import EstablishmentGrid from '~/components/catalog/establishment_grid'
import type { CatalogSearchItem, CatalogSearchQuery } from '~/lib/catalog'
import CatalogEstablishments from '~/pages/catalog/establishments'
import { render } from '~/tests/test_utils'

vi.mock('~/components/catalog/catalog_shell', () => ({
  default: ({ title, children }: { title: string; children: ReactNode }) => (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  ),
}))

vi.mock('~/components/catalog/use_catalog_analytics', () => ({
  useCatalogSearchAnalytics: vi.fn(),
}))

vi.mock('~/components/catalog/catalog_concierge', () => ({
  CatalogConcierge: () => null,
}))

const POSITION = { latitude: -23.3105, longitude: -51.1628 }

const city = {
  slug: 'londrina',
  name: 'Londrina',
  state_code: 'PR',
  timezone: 'America/Sao_Paulo',
}

const card = (name: string, extra: Record<string, unknown> = {}) => ({
  slug: name.toLowerCase().replace(/\s+/g, '-'),
  name,
  city: { slug: 'londrina', name: 'Londrina', state_code: 'PR' },
  business_status: 'open',
  is_open_now: true,
  ...extra,
})

function search(names: string[], query: Record<string, unknown>, meta = {}) {
  return {
    context: { city, category: null },
    sponsored_results: [],
    organic_results: names.map((name) => card(name)),
    meta: { total: names.length, page: 1, per_page: 20, last_page: 1, ...meta },
    query: {
      q: null,
      category: null,
      open_now: false,
      benefit_today: false,
      attributes: [],
      sort: 'relevance',
      ...query,
    },
  }
}

const filterCategories = { city, categories: [] }

let geolocation: { getCurrentPosition: ReturnType<typeof vi.fn> }

function allowLocation() {
  geolocation.getCurrentPosition.mockImplementation((success: PositionCallback) =>
    success({ coords: POSITION } as GeolocationPosition)
  )
}

function refuseLocation(code: number) {
  geolocation.getCurrentPosition.mockImplementation(
    (_success: PositionCallback, failure: PositionErrorCallback) =>
      failure({ code, message: 'no' } as GeolocationPositionError)
  )
}

function renderPage(catalog = search(['Bravo', 'Alfa'], {})) {
  return render(
    <CatalogEstablishments
      catalog={catalog}
      city_slug="londrina"
      filter_categories={filterCategories}
    />
  )
}

const sortSelect = () => screen.getByRole('combobox', { name: 'Ordenar por' })
const status = () => screen.getByRole('status')
const organicNames = () =>
  within(screen.getByRole('region', { name: 'Todos os lugares' }))
    .getAllByRole('heading', { level: 3 })
    .map((heading) => heading.textContent)

beforeEach(() => {
  vi.mocked(router.get).mockClear()
  // jsdom lays nothing out; the pages scroll the results into view on a page change.
  Element.prototype.scrollIntoView = vi.fn()
  geolocation = { getCurrentPosition: vi.fn() }
  Object.defineProperty(window.navigator, 'geolocation', {
    configurable: true,
    value: geolocation,
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('catalogue orders and "Vale hoje"', () => {
  it('offers the four orders asked for, plus the existing two', () => {
    renderPage()

    expect(
      within(sortSelect())
        .getAllByRole('option')
        .map((option) => option.textContent)
    ).toEqual([
      'Relevância',
      'Mais bem avaliados',
      'Mais perto',
      'Menor preço',
      'Ordem alfabética',
      'Publicados recentemente',
    ])
    expect(sortSelect()).toHaveValue('relevance')
    // The position is asked for only when someone picks "Mais perto".
    expect(geolocation.getCurrentPosition).not.toHaveBeenCalled()
  })

  it('keeps rating, price and "Vale hoje" in a shareable URL', async () => {
    const { user } = renderPage()

    await user.selectOptions(sortSelect(), 'rating')
    await user.click(screen.getByRole('checkbox', { name: 'Vale hoje' }))
    await user.click(screen.getByRole('button', { name: 'Buscar' }))

    expect(router.get).toHaveBeenCalledWith(
      '/cidades/londrina',
      { per_page: '20', sort: 'rating', benefit_today: 'true' },
      expect.objectContaining({ preserveState: true, replace: true })
    )

    await user.selectOptions(sortSelect(), 'price')
    expect(screen.getByText(/Pelo ticket médio informado pelo lugar/)).toBeVisible()
    expect(sortSelect()).toHaveAccessibleDescription(
      'Pelo ticket médio informado pelo lugar; quem não informa aparece no fim.'
    )
    expect(geolocation.getCurrentPosition).not.toHaveBeenCalled()
  })

  it('shows the applied order and "Vale hoje" as chips that clear together', () => {
    render(
      <CatalogSearchForm
        path="/cidades/londrina"
        query={{ q: '', category: null, openNow: false, benefitToday: true, sort: 'rating' }}
        total={3}
        perPage={20}
      />
    )

    const applied = screen.getByLabelText('Filtros aplicados')
    expect(within(applied).getByText('Vale hoje')).toBeVisible()
    expect(within(applied).getByText('Ordenação: mais bem avaliados')).toBeVisible()
    expect(screen.getByRole('checkbox', { name: 'Vale hoje' })).toBeChecked()
    expect(screen.getByRole('group', { name: 'Disponibilidade' })).toContainElement(
      screen.getByRole('checkbox', { name: 'Aberto agora' })
    )
  })

  it('does not offer "Mais perto" where the page cannot show it', () => {
    const query: CatalogSearchQuery = {
      q: '',
      category: null,
      openNow: false,
      sort: 'relevance',
    }
    render(<CatalogSearchForm path="/cidades/londrina" query={query} total={0} perPage={20} />)

    expect(screen.queryByRole('option', { name: 'Mais perto' })).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('sorts nearest first through the API, with the position in that request only', async () => {
    allowLocation()
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            search(
              ['Perto', 'Longe'],
              { sort: 'distance', benefit_today: true },
              { total: 3, last_page: 2 }
            )
          )
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            search(
              ['Mais longe'],
              { sort: 'distance', benefit_today: true },
              { total: 3, page: 2, last_page: 2 }
            )
          )
        )
      )
    const { user } = renderPage()

    await user.selectOptions(sortSelect(), 'distance')
    expect(geolocation.getCurrentPosition).toHaveBeenCalledTimes(1)
    await waitFor(() =>
      expect(status()).toHaveTextContent(
        'Localização pronta. Use Buscar para ver os lugares mais perto.'
      )
    )
    expect(fetchSpy).not.toHaveBeenCalled()

    await user.click(screen.getByRole('checkbox', { name: 'Vale hoje' }))
    await user.click(screen.getByRole('button', { name: 'Buscar' }))

    await waitFor(() => expect(organicNames()).toEqual(['Perto', 'Longe']))
    expect(status()).toHaveTextContent(
      'Ordenado pelos mais perto de você. Sua localização não fica salva.'
    )
    expect(sortSelect()).toHaveValue('distance')
    expect(screen.getByText('Ordenação: mais perto')).toBeVisible()
    expect(router.get).not.toHaveBeenCalled()

    const [url] = fetchSpy.mock.calls[0]
    const requested = new URL(String(url), 'https://experimente.test')
    expect(requested.pathname).toBe('/api/v1/catalog/cities/londrina/establishments')
    expect(Object.fromEntries(requested.searchParams)).toEqual({
      benefit_today: 'true',
      sort: 'distance',
      lat: '-23.3105',
      lng: '-51.1628',
      per_page: '20',
    })

    // The next page comes from the API too, with the same position and no new prompt.
    await user.click(screen.getByRole('button', { name: 'Próxima página' }))
    await waitFor(() => expect(organicNames()).toEqual(['Mais longe']))
    expect(geolocation.getCurrentPosition).toHaveBeenCalledTimes(1)
    expect(
      new URL(String(fetchSpy.mock.calls[1][0]), 'https://experimente.test').searchParams.get(
        'page'
      )
    ).toBe('2')
    expect(router.get).not.toHaveBeenCalled()
  })

  it('falls back to relevance with a clear message when location is refused', async () => {
    refuseLocation(1)
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { user } = renderPage()

    await user.selectOptions(sortSelect(), 'distance')

    await waitFor(() =>
      expect(status()).toHaveTextContent(
        'Sem permissão para usar sua localização. Mostrando por relevância.'
      )
    )
    expect(sortSelect()).toHaveValue('relevance')
    expect(organicNames()).toEqual(['Bravo', 'Alfa'])
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('explains a position the device could not find', async () => {
    refuseLocation(2)
    const { user } = renderPage()

    await user.selectOptions(sortSelect(), 'distance')

    await waitFor(() =>
      expect(status()).toHaveTextContent(
        'Não foi possível descobrir onde você está agora. Mostrando por relevância.'
      )
    )
    expect(sortSelect()).toHaveValue('relevance')
  })

  it('reloads in relevance, without any position, when the nearest-first search fails', async () => {
    allowLocation()
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('{}', { status: 503 }))
    const { user } = renderPage()

    await user.type(screen.getByRole('searchbox', { name: 'O que você procura?' }), 'café')
    await user.selectOptions(sortSelect(), 'distance')
    await waitFor(() => expect(status()).toHaveTextContent('Localização pronta'))
    await user.click(screen.getByRole('button', { name: 'Buscar' }))

    await waitFor(() =>
      expect(router.get).toHaveBeenCalledWith(
        '/cidades/londrina',
        { per_page: '20', q: 'café' },
        expect.objectContaining({ preserveState: true })
      )
    )
    expect(status()).toHaveTextContent(
      'Não foi possível ordenar por distância agora. Mostrando por relevância.'
    )
    expect(sortSelect()).toHaveValue('relevance')
  })

  it('marks a card "Vale hoje" and reads it with the card', () => {
    const entry: CatalogSearchItem = {
      slug: 'cafe-aurora',
      name: 'Café Aurora',
      shortDescription: null,
      citySlug: 'londrina',
      cityName: 'Londrina',
      stateCode: 'PR',
      district: null,
      businessStatus: 'open',
      isOpenNow: true,
      primaryCategory: null,
      categories: [],
      cover: null,
      isSponsored: false,
      benefitToday: true,
    }
    render(
      <EstablishmentGrid
        entries={[
          entry,
          { ...entry, slug: 'sem-beneficio', name: 'Sem benefício', benefitToday: false },
        ]}
        citySlug="londrina"
      />
    )

    expect(screen.getAllByText('Vale hoje')).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'Café Aurora' })).toHaveAccessibleDescription(
      'Aberto agora Vale hoje'
    )
    expect(screen.getByRole('link', { name: 'Sem benefício' })).toHaveAccessibleDescription(
      'Aberto agora'
    )
  })
})
