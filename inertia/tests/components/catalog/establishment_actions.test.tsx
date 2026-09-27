import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { EstablishmentActions } from '~/components/catalog/establishment_actions'
import { trackAnalyticsEvents } from '~/lib/analytics'
import { catalogDetail, type CatalogDetail } from '~/lib/catalog'

vi.mock('~/lib/analytics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/lib/analytics')>()),
  analyticsEventId: () => 'test-share-event',
  trackAnalyticsEvents: vi.fn().mockResolvedValue(undefined),
}))

function detailFor(
  contacts: Record<string, string | undefined> = {},
  address: Record<string, unknown> = {}
) {
  return catalogDetail({
    slug: 'cafe',
    name: 'Café',
    city: { slug: 'londrina', name: 'Londrina' },
    business_status: 'open',
    availability_type: 'regular_hours',
    is_open_now: true,
    contacts,
    address,
  }) as CatalogDetail
}

describe('establishment action hierarchy', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.mocked(trackAnalyticsEvents).mockClear()
  })

  // Direction A, as the app settled it (audit A11): orange is kept for converting
  // a benefit or a purchase, so the place's main action is the brand's navy.
  it('leads with a navy route, paints nothing orange and keeps the four tracked destinations', () => {
    const { container } = render(
      <EstablishmentActions
        detail={detailFor(
          { whatsapp: '5543999990000', phone: '554333330000', website: 'https://example.com' },
          { latitude: -23.3, longitude: -51.1 }
        )}
      />
    )

    expect(container.querySelector('.bg-cta')).not.toBeInTheDocument()
    expect(container.querySelectorAll('.bg-primary')).toHaveLength(1)
    const links = screen.getAllByRole('link')
    expect(links[0]).toHaveAccessibleName(/Como chegar/)
    expect(links[0]).toHaveClass('bg-primary')
    for (const name of [/Chamar no WhatsApp/, /Ligar para/, /Visitar o site/]) {
      expect(screen.getByRole('link', { name })).toHaveClass('bg-action-secondary')
    }
    for (const [name, action] of [
      [/Chamar no WhatsApp/, 'whatsapp'],
      [/Como chegar/, 'route'],
      [/Ligar para/, 'phone'],
      [/Visitar o site/, 'website'],
    ] as const) {
      expect(screen.getByRole('link', { name })).toHaveAttribute(
        'href',
        `/go/londrina/cafe/${action}`
      )
    }
  })

  it('offers no route without published coordinates, which the redirect needs', () => {
    render(
      <EstablishmentActions
        detail={detailFor(
          { whatsapp: '5543999990000' },
          { street: 'Rua Central', district: 'Centro' }
        )}
      />
    )

    expect(screen.queryByRole('link', { name: /Como chegar/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Chamar no WhatsApp/ })).toHaveClass('bg-primary')
  })

  it.each([
    {
      contacts: { whatsapp: '5543999990000', phone: '554333330000' },
      address: {},
      name: /Chamar no WhatsApp/,
    },
    { contacts: { phone: '554333330000' }, address: {}, name: /Ligar para/ },
    { contacts: { website: 'https://example.com' }, address: {}, name: /Visitar o site/ },
    {
      contacts: { booking_url: 'https://example.com/agenda' },
      address: {},
      name: /Agendar ou reservar/,
    },
  ])(
    'promotes the first available contact without a route: $name',
    ({ contacts, address, name }) => {
      const { container } = render(<EstablishmentActions detail={detailFor(contacts, address)} />)
      expect(container.querySelector('.bg-cta')).not.toBeInTheDocument()
      expect(container.querySelectorAll('.bg-primary')).toHaveLength(1)
      expect(screen.getByRole('link', { name })).toHaveClass('bg-primary')
    }
  )

  it('does not invent a conversion or tracked event for Instagram and sharing', () => {
    const { container } = render(
      <EstablishmentActions detail={detailFor({ instagram: '@cafe' })} />
    )
    expect(container.querySelector('.bg-cta')).not.toBeInTheDocument()
    expect(container.querySelector('.bg-primary')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Ver Instagram/ })).toHaveAttribute(
      'href',
      'https://instagram.com/cafe'
    )
    expect(trackAnalyticsEvents).not.toHaveBeenCalled()
  })

  it('preserves share_click after successful sharing', async () => {
    const user = userEvent.setup()
    Object.defineProperty(navigator, 'share', { configurable: true, value: vi.fn() })
    vi.spyOn(navigator, 'share').mockResolvedValue(undefined)
    render(<EstablishmentActions detail={detailFor()} />)

    await user.click(screen.getByRole('button', { name: 'Compartilhar' }))

    expect(trackAnalyticsEvents).toHaveBeenCalledExactlyOnceWith([
      {
        event_id: 'test-share-event',
        event_type: 'share_click',
        city_slug: 'londrina',
        establishment_slug: 'cafe',
        category_slug: undefined,
      },
    ])
    expect(screen.getByText('Compartilhado com sucesso.')).toBeInTheDocument()
  })
})
