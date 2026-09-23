import { renderToStaticMarkup } from 'react-dom/server'

import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CityAgendaSection, cityAgenda } from '~/components/catalog/city_agenda'
import { render } from '~/tests/test_utils'

const city = {
  slug: 'londrina',
  name: 'Londrina',
  state_code: 'PR',
  timezone: 'America/Sao_Paulo',
}

function eventItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    kind: 'event',
    title: 'Sarau no quintal',
    description: 'Poesia e música ao vivo.',
    starts_at: '2026-09-18T22:00:00.000Z',
    ends_at: '2026-09-19T02:00:00.000Z',
    cover: {
      url: 'https://example.test/sarau.jpg',
      alt_text: 'Público sentado no quintal durante o sarau',
      width: 1200,
      height: 675,
    },
    establishment: { slug: 'bar-estacao-43', name: 'Bar Estação 43' },
    city_slug: 'londrina',
    ...overrides,
  }
}

function experienceItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 51,
    kind: 'experience',
    title: 'Degustação de cafés especiais',
    description: null,
    published_at: '2026-09-17T12:00:00.000Z',
    cover: {
      url: 'https://example.test/cafe.jpg',
      alt_text: 'Barista preparando café em método filtrado',
      width: 800,
      height: 450,
    },
    establishment: { slug: 'cafe-do-centro', name: 'Café do Centro' },
    city_slug: 'londrina',
    ...overrides,
  }
}

function agenda(overrides: Record<string, unknown> = {}) {
  return {
    city,
    local_date: '2026-09-18',
    happening_today: [],
    upcoming: [],
    new_experiences: [],
    ...overrides,
  }
}

describe('city agenda', () => {
  it('renders the three bands with links keyed by slug, never by identifier', () => {
    render(
      <CityAgendaSection
        agenda={agenda({
          happening_today: [eventItem()],
          upcoming: [eventItem({ id: 2, title: 'Feira de vinis' })],
          new_experiences: [experienceItem()],
        })}
      />
    )

    expect(screen.getByRole('heading', { level: 2, name: /O que está acontecendo em Londrina/ }))
      .toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Acontecendo hoje' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Em breve' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Novidades' })).toBeInTheDocument()

    expect(screen.getByRole('link', { name: 'Sarau no quintal' })).toHaveAttribute(
      'href',
      '/cidades/londrina/estabelecimentos/bar-estacao-43'
    )
    expect(screen.getByRole('link', { name: 'Degustação de cafés especiais' })).toHaveAttribute(
      'href',
      '/cidades/londrina/estabelecimentos/cafe-do-centro'
    )
  })

  it('labels the recency band as chronology and never as a highlight', () => {
    render(<CityAgendaSection agenda={agenda({ new_experiences: [experienceItem()] })} />)

    const band = screen
      .getByRole('heading', { level: 3, name: 'Novidades' })
      .closest('section') as HTMLElement
    expect(within(band).getByText(/mais recentemente/)).toBeInTheDocument()
    expect(screen.queryByText(/destaque/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/patrocinad/i)).not.toBeInTheDocument()
  })

  it('formats the event window in the city timezone', () => {
    render(<CityAgendaSection agenda={agenda({ happening_today: [eventItem()] })} />)

    // 22:00Z on the 18th is 19:00 of the 18th in America/Sao_Paulo, and the end
    // crosses midnight in UTC without changing the local day the event starts on.
    expect(screen.getByText(/18 de set\. de 2026 · 19:00–23:00/)).toBeInTheDocument()
  })

  it('renders an item without a cover using the catalogue fallback tile', () => {
    render(
      <CityAgendaSection
        agenda={agenda({ happening_today: [eventItem({ cover: null })] })}
      />
    )

    expect(screen.getByRole('link', { name: 'Sarau no quintal' })).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: 'Imagem ilustrativa de Sarau no quintal' })
    ).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /Público sentado/ })).not.toBeInTheDocument()
  })

  it('keeps the order the server chose and never re-sorts it', () => {
    const parsed = cityAgenda(
      agenda({
        happening_today: [
          eventItem({ id: 3, title: 'Terceiro', starts_at: '2026-09-18T23:00:00.000Z' }),
          eventItem({ id: 1, title: 'Primeiro', starts_at: '2026-09-18T12:00:00.000Z' }),
          eventItem({ id: 2, title: 'Segundo', starts_at: '2026-09-18T18:00:00.000Z' }),
        ],
      })
    )

    expect(parsed?.happeningToday.map((item) => item.title)).toEqual([
      'Terceiro',
      'Primeiro',
      'Segundo',
    ])

    render(
      <CityAgendaSection
        agenda={agenda({
          happening_today: [
            eventItem({ id: 3, title: 'Terceiro' }),
            eventItem({ id: 1, title: 'Primeiro' }),
            eventItem({ id: 2, title: 'Segundo' }),
          ],
        })}
      />
    )

    const rendered = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('aria-labelledby'))
      .filter((value): value is string => Boolean(value))
      .map((id) => document.getElementById(id)?.textContent)

    expect(rendered).toEqual(['Terceiro', 'Primeiro', 'Segundo'])
  })

  it('shows an empty state when the city has nothing scheduled', () => {
    render(<CityAgendaSection agenda={agenda()} />)

    expect(
      screen.getByText('Nenhuma programação publicada para estes dias')
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 3, name: 'Acontecendo hoje' })).toBeNull()
  })

  it('renders nothing at all when the controller withheld the agenda', () => {
    const { container } = render(<CityAgendaSection agenda={null} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('drops an item that has no public link and never reads a live field', () => {
    const parsed = cityAgenda(
      agenda({
        happening_today: [
          // No establishment slug: the card would lead nowhere.
          eventItem({ id: 9, establishment: { name: 'Sem slug' } }),
          // Old, leaky shape: identifiers instead of the public projection.
          {
            id: 10,
            establishment_id: 44,
            tenant_id: 7,
            status: 'published',
            published_snapshot: { title: 'Não deve aparecer' },
          },
          eventItem({ id: 11, title: 'Único válido' }),
        ],
      })
    )

    expect(parsed?.happeningToday.map((item) => item.title)).toEqual(['Único válido'])
  })

  it('renders identically on the server, so hydration has nothing to correct', () => {
    const payload = agenda({
      happening_today: [eventItem()],
      new_experiences: [experienceItem({ cover: null })],
    })
    const markup = renderToStaticMarkup(<CityAgendaSection agenda={payload} />)

    expect(markup).toContain('Acontecendo hoje')
    expect(markup).toContain('/cidades/londrina/estabelecimentos/bar-estacao-43')
    expect(markup).toContain('Público sentado no quintal durante o sarau')
    // The band exists on the server too: nothing here waits for the browser.
    expect(markup).toContain('Novidades')
  })
})
