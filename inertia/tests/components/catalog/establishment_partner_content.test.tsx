import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import {
  EstablishmentPartnerContent,
  partnerContentAnchor,
  publishedPartnerContent,
} from '~/components/catalog/establishment_partner_content'
import { render } from '~/tests/test_utils'

describe('establishment partner content', () => {
  it('reads the public projection the server sends, not a snapshot', () => {
    const rows = [
      {
        id: 12,
        kind: 'experience',
        title: 'Título aprovado',
        description: 'Texto público',
        starts_at: null,
        ends_at: null,
        informational_price_cents: null,
        published_at: '2026-09-10T12:00:00.000Z',
        media: [],
      },
    ]

    expect(publishedPartnerContent(rows, 'experiences')).toEqual([
      {
        id: 12,
        title: 'Título aprovado',
        description: 'Texto público',
        startsAt: null,
        endsAt: null,
        informationalPriceCents: null,
        media: [],
      },
    ])
  })

  it('never falls back to published_snapshot or to a live column', () => {
    // The publication rule moved to the server. A payload shaped the old way is
    // not "almost right": it has no public fields, so it must produce nothing
    // rather than quietly reading the snapshot again.
    const legacyRows = [
      {
        id: 12,
        status: 'pending_review',
        tenant_id: 7,
        created_by: 3,
        published_snapshot: {
          title: 'Título aprovado',
          description: 'Texto público',
        },
      },
    ]

    expect(publishedPartnerContent(legacyRows, 'experiences')).toEqual([])
  })

  it('renders experiences, event windows and informational showcase prices', () => {
    render(
      <EstablishmentPartnerContent
        timeZone="America/Sao_Paulo"
        content={{
          experiences: [
            {
              id: 1,
              kind: 'experience',
              title: 'Degustação guiada',
              description: 'Uma experiência da casa.',
              starts_at: null,
              ends_at: null,
              informational_price_cents: null,
              published_at: '2026-09-10T12:00:00.000Z',
              media: [
                {
                  id: 91,
                  is_cover: true,
                  sort_order: 0,
                  alt_text: 'Barista servindo café na mesa',
                  caption: 'Degustação da casa',
                  asset: { url: 'https://example.com/experience.jpg' },
                },
              ],
            },
          ],
          events: [
            {
              id: 2,
              kind: 'event',
              title: 'Noite especial',
              description: null,
              starts_at: '2026-09-20T22:00:00.000Z',
              ends_at: '2026-09-21T01:00:00.000Z',
              informational_price_cents: null,
              published_at: '2026-09-10T12:00:00.000Z',
              media: [],
            },
          ],
          showcase_items: [
            {
              id: 3,
              kind: 'showcase_item',
              title: 'Menu da estação',
              description: null,
              starts_at: null,
              ends_at: null,
              informational_price_cents: 12990,
              published_at: '2026-09-10T12:00:00.000Z',
              media: [],
            },
          ],
        }}
      />
    )

    expect(screen.getByText('Degustação guiada')).toBeInTheDocument()
    expect(screen.getByText('Noite especial')).toBeInTheDocument()
    expect(screen.getByText('Menu da estação')).toBeInTheDocument()
    expect(screen.getByText(/R\$\s*129,90/)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Barista servindo café na mesa' })).toHaveAttribute(
      'src',
      'https://example.com/experience.jpg'
    )
    expect(screen.getByText('Degustação da casa')).toBeInTheDocument()
  })

  describe('arriving from the city agenda', () => {
    const content = {
      experiences: [{ id: 12, title: 'Oficina de cerâmica', media: [] }],
      events: [
        {
          id: 12,
          title: 'Queima aberta',
          starts_at: '2026-09-20T22:00:00.000Z',
          ends_at: '2026-09-21T01:00:00.000Z',
          media: [],
        },
      ],
    }

    afterEach(() => window.history.replaceState(null, '', '/'))

    it('gives every item an address below the sticky header', () => {
      render(<EstablishmentPartnerContent timeZone="America/Sao_Paulo" content={content} />)

      // Same public id, different kinds: the fragment keeps them apart.
      const workshop = document.getElementById(partnerContentAnchor('experiences', 12))
      const firing = document.getElementById(partnerContentAnchor('events', 12))
      expect(workshop).toHaveTextContent('Oficina de cerâmica')
      expect(firing).toHaveTextContent('Queima aberta')
      expect(workshop).toHaveClass('scroll-mt-24')
      expect(workshop).not.toHaveAttribute('data-arrived')
    })

    it('marks only the item the fragment names', () => {
      window.history.replaceState(null, '', '/cidades/londrina/estabelecimentos/atelie#evento-12')
      render(<EstablishmentPartnerContent timeZone="America/Sao_Paulo" content={content} />)

      expect(document.getElementById('evento-12')).toHaveAttribute('data-arrived', 'true')
      expect(document.getElementById('evento-12')).toHaveClass('border-primary')
      expect(document.getElementById('experiencia-12')).not.toHaveAttribute('data-arrived')
    })
  })

  it('renders nothing when the server sent no publishable item', () => {
    const { container } = render(
      <EstablishmentPartnerContent
        timeZone="America/Sao_Paulo"
        content={{ experiences: [{ id: 1, kind: 'experience', title: '   ' }] }}
      />
    )

    expect(container).toBeEmptyDOMElement()
  })
})
