import { describe, expect, it } from 'vitest'

import {
  EstablishmentReviews,
  type PublicReviewItem,
} from '~/components/catalog/establishment_reviews'
import { RatingStars, formatRating } from '~/components/catalog/rating_stars'
import { render, screen, within } from '~/tests/test_utils'

function item(overrides: Partial<PublicReviewItem> = {}): PublicReviewItem {
  return {
    id: 1,
    rating: 5,
    comment: 'Atendimento impecável.',
    created_at: '2026-08-21T01:30:00.000Z',
    author_name: 'Ana Souza',
    reply: null,
    photos: [],
    ...overrides,
  }
}

describe('rating stars', () => {
  it('reads the average with a Brazilian comma and whole numbers without ",0"', () => {
    expect(formatRating(4.5)).toBe('4,5')
    expect(formatRating(4.46)).toBe('4,5')
    expect(formatRating(4)).toBe('4')
    expect(formatRating(3.04)).toBe('3')
  })

  it('draws a 4,5 as four and a half stars, never five', () => {
    const { container } = render(<RatingStars value={4.5} />)

    expect(screen.getByRole('img', { name: '4,5 de 5' })).toBeInTheDocument()
    const stars = container.querySelectorAll('svg')
    expect(stars).toHaveLength(5)
    const filled = [...stars].filter(
      (star) => star.querySelector('path')?.getAttribute('fill') === 'currentColor'
    )
    expect(filled).toHaveLength(4)
    // The fifth star is outlined and carries the half fill.
    expect(stars[4].querySelectorAll('path')).toHaveLength(2)
  })
})

describe('establishment reviews (W10)', () => {
  it('summarises the average and count, and lists each review with its reply', () => {
    render(
      <EstablishmentReviews
        placeName="Bar Estação 43"
        timeZone="America/Sao_Paulo"
        reviews={{
          summary: { count: 12, average: 4.5 },
          latest: [
            item({
              reply: { comment: 'Obrigado pela visita!', created_at: null },
            }),
            item({ id: 2, rating: 3, author_name: 'Bruno Lima', comment: null }),
          ],
        }}
      />
    )

    const section = screen.getByRole('region', { name: 'Avaliações' })
    expect(within(section).getAllByRole('img', { name: '4,5 de 5' })).toHaveLength(1)
    expect(within(section).getByText('· 12 avaliações')).toBeInTheDocument()

    const first = screen.getByRole('article', { name: 'Avaliação de Ana Souza' })
    expect(within(first).getByRole('img', { name: '5 de 5' })).toBeInTheDocument()
    expect(within(first).getByText('Atendimento impecável.')).toBeInTheDocument()
    // The date is the city's day, not UTC's: 01:30 UTC is still the 20th.
    expect(within(first).getByText('20/08/2026')).toBeInTheDocument()
    expect(within(first).getByText('Resposta de Bar Estação 43')).toBeInTheDocument()
    expect(within(first).getByText('Obrigado pela visita!')).toBeInTheDocument()
    expect(
      within(first).getByRole('button', {
        name: 'Denunciar avaliação: avaliação de Ana Souza',
      })
    ).toBeInTheDocument()

    const second = screen.getByRole('article', { name: 'Avaliação de Bruno Lima' })
    expect(within(second).getByRole('img', { name: '3 de 5' })).toBeInTheDocument()
    expect(within(second).queryByText(/Resposta de/)).not.toBeInTheDocument()
  })

  it('says one review in the singular', () => {
    render(
      <EstablishmentReviews
        placeName="Bar"
        timeZone={null}
        reviews={{ summary: { count: 1, average: 4 }, latest: [item()] }}
      />
    )

    expect(screen.getByText('· 1 avaliação')).toBeInTheDocument()
  })

  it('shows an empty state, and no zero stars, when nobody has reviewed yet', () => {
    render(
      <EstablishmentReviews
        placeName="Bar"
        timeZone="America/Sao_Paulo"
        reviews={{ summary: { count: 0, average: null }, latest: [] }}
      />
    )

    expect(
      screen.getByRole('heading', { name: 'Ainda não há avaliações deste lugar' })
    ).toBeInTheDocument()
    expect(screen.getByText('Quem visitar pode avaliar pelo app Experimente+.')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })

  it('treats a stale payload without reviews as an empty section', () => {
    render(<EstablishmentReviews placeName="Bar" timeZone={null} reviews={undefined} />)

    expect(
      screen.getByRole('heading', { name: 'Ainda não há avaliações deste lugar' })
    ).toBeInTheDocument()
  })
})
