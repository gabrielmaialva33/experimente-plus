import { readFileSync } from 'node:fs'

import { screen, within } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'

import WalletPage from '~/pages/wallet/index'
import PresentBenefitPage from '~/pages/wallet/present'
import WalletReceiptPage from '~/pages/wallet/receipt'
import WalletRedemptionsPage from '~/pages/wallet/redemptions'
import { render } from '~/tests/test_utils'
import type { BenefitWallet } from '~/types/benefit'
import type { RedemptionPresentation, RedemptionReceipt } from '~/types/benefit_redemption'

vi.mock('@inertiajs/react', () => ({
  Head: () => null,
  router: { post: vi.fn() },
  usePage: () => ({
    url: '/wallet',
    props: {
      app: {
        name: 'Experimente+',
        url: 'http://experimente.test',
        sourceUrl: null,
        environment: 'test',
        demoPagesEnabled: false,
      },
    },
  }),
  Link: ({ href, children, ...props }: ComponentProps<'a'> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('~/components/theme/theme_toggle', () => ({
  ThemeToggle: () => <button type="button">Alterar tema</button>,
}))

const emptyWallet: BenefitWallet = {
  summary: { passes: 0, benefits: 0, available: 0, upcoming: 0, redeemed: 0 },
  passes: [],
}

const walletWithBenefit: BenefitWallet = {
  summary: { passes: 1, benefits: 1, available: 1, upcoming: 0, redeemed: 0 },
  passes: [
    {
      access: {
        id: 7,
        source: 'courtesy',
        status: 'active',
        granted_at: '2026-09-01T12:00:00.000Z',
        availability: 'available',
      },
      edition: {
        id: 3,
        name: 'Edição Norte do Paraná',
        slug: 'norte-do-parana',
        description: 'Benefícios da edição piloto.',
        usage_starts_at: '2026-09-01T03:00:00.000Z',
        usage_ends_at: '2026-09-30T03:00:00.000Z',
        city: {
          id: 2,
          name: 'Londrina',
          slug: 'londrina',
          state_code: 'PR',
          timezone: 'America/Sao_Paulo',
        },
      },
      benefits: [
        {
          key: '7:11',
          access_id: 7,
          offer_id: 11,
          availability: 'available',
          title: 'Café cortesia',
          description: 'Uma bebida conforme as regras da oferta.',
          benefit_type: 'complimentary_item',
          discount_percentage: null,
          discount_amount_cents: null,
          terms: 'Válido de segunda a sexta.',
          max_redemptions_per_access: 2,
          remaining_redemptions: 1,
          establishment: { id: 5, public_name: 'Café Central', slug: 'cafe-central' },
        },
      ],
    },
  ],
}

const receipt: RedemptionReceipt = {
  id: 20,
  receipt_code: 'EXP-0123456789ABCDEF',
  redemption_number: 1,
  redeemed_at: '2026-09-03T15:30:00.000Z',
  edition: { id: 3, name: 'Edição Norte do Paraná' },
  offer: {
    id: 11,
    title: 'Café cortesia',
    benefit_type: 'complimentary_item',
    terms: 'Válido de segunda a sexta.',
  },
  establishment: { id: 5, name: 'Café Central' },
  holder: { id: 8, full_name: 'Ana Souza', email: 'ana@example.com' },
  redeemed_by: 13,
}

describe('consumer wallet pages', () => {
  it('uses the canonical empty state and honest access copy', () => {
    const { container } = render(<WalletPage wallet={emptyWallet} />)

    expect(screen.getByRole('heading', { level: 1, name: 'Minha carteira' })).toBeVisible()
    expect(screen.getByText('Sua carteira ainda está vazia')).toBeVisible()
    expect(container.querySelector('[data-slot="empty-state"]')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Explorar estabelecimentos' })).toHaveAttribute(
      'href',
      '/cidades'
    )
    expect(screen.getByRole('main')).not.toHaveTextContent(/comprad[ao]|checkout/i)
  })

  it('offers one canonical use action with the agreed vocabulary', () => {
    render(<WalletPage wallet={walletWithBenefit} />)

    const benefit = screen
      .getByRole('heading', { name: 'Café cortesia' })
      .closest<HTMLElement>('[data-slot="card"]')
    expect(benefit).not.toBeNull()
    expect(within(benefit!).getByRole('link', { name: 'Usar benefício' })).toHaveAttribute(
      'href',
      '/wallet/accesses/7/offers/11/use'
    )
    expect(within(benefit!).getByText('1 utilização restante')).toBeVisible()
    expect(within(benefit!).getByText('Disponível agora')).toBeVisible()
    expect(within(benefit!).getAllByRole('link')).toHaveLength(1)
  })

  it('uses a canonical empty state for Utilizações', () => {
    const { container } = render(<WalletRedemptionsPage history={{ redemptions: [], total: 0 }} />)

    expect(screen.getByRole('heading', { level: 1, name: 'Utilizações' })).toBeVisible()
    expect(screen.getByText('Nenhuma utilização ainda')).toBeVisible()
    expect(container.querySelector('[data-slot="empty-state"]')).toBeInTheDocument()
    expect(container.querySelector('a[href="/dashboard"]')).not.toBeInTheDocument()
    expect(container.querySelector('a[href="/settings"]')).not.toBeInTheDocument()
  })

  it('keeps a single receipt destination per history item', () => {
    render(<WalletRedemptionsPage history={{ redemptions: [receipt], total: 1 }} />)

    const card = screen
      .getByRole('heading', { name: 'Café cortesia' })
      .closest<HTMLElement>('[data-slot="card"]')
    expect(card).not.toBeNull()
    expect(within(card!).getByRole('link', { name: 'Ver comprovante' })).toHaveAttribute(
      'href',
      '/wallet/redemptions/EXP-0123456789ABCDEF'
    )
    expect(within(card!).getAllByRole('link')).toHaveLength(1)
  })

  it('renders the permanent receipt with snapshot terms', () => {
    render(<WalletReceiptPage receipt={receipt} />)

    expect(screen.getByRole('heading', { level: 1, name: 'Comprovante' })).toBeVisible()
    expect(screen.getByText('Utilização confirmada')).toBeVisible()
    expect(screen.getByText('EXP-0123456789ABCDEF')).toBeVisible()
    expect(screen.getByText('Válido de segunda a sexta.')).toBeVisible()
  })

  it('explains that presentation is temporary and server-confirmed', () => {
    const presentation: RedemptionPresentation = {
      token: 'opaque-token',
      validation_url: 'http://experimente.test/portal/redemptions/validate?token=opaque-token',
      qr_data_url: 'data:image/png;base64,AAAA',
      issued_at: new Date(Date.now() - 1_000).toISOString(),
      expires_at: new Date(Date.now() + 300_000).toISOString(),
      expires_in_seconds: 300,
      benefit: {
        access_id: 7,
        offer_id: 11,
        edition_id: 3,
        edition_name: 'Edição Norte do Paraná',
        organization_id: 4,
        establishment_id: 5,
        establishment_name: 'Café Central',
        offer_title: 'Café cortesia',
        offer_description: 'Uma bebida conforme as regras da oferta.',
        terms: 'Válido de segunda a sexta.',
        benefit_type: 'complimentary_item',
        reservation_required: false,
        on_premise_only: true,
        minimum_party_size: 1,
        max_redemptions_per_access: 2,
        redeemed_count: 1,
        remaining_redemptions: 1,
      },
    }

    render(<PresentBenefitPage presentation={presentation} />)

    expect(screen.getByRole('heading', { level: 1, name: 'Usar benefício' })).toBeVisible()
    expect(
      screen.getByRole('img', { name: 'QR Code temporário para validar o benefício' })
    ).toBeVisible()
    expect(screen.getByText(/A apresentação não conclui o uso sozinha/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Copiar link de validação' })).toBeEnabled()
  })

  it('keeps consumer-owned source flat and free of dead operational destinations', () => {
    const paths = [
      'inertia/components/consumer/consumer_shell.tsx',
      'inertia/components/consumer/consumer_flow_shell.tsx',
      'inertia/pages/wallet/index.tsx',
      'inertia/pages/wallet/redemptions.tsx',
      'inertia/pages/wallet/present.tsx',
      'inertia/pages/wallet/receipt.tsx',
    ]
    const sources = paths.map((path) => readFileSync(path, 'utf8')).join('\n')

    expect(sources).not.toMatch(/bg-gradient|backdrop-blur|blur-3xl|shadow-(?:xl|2xl)/)
    expect(sources).not.toMatch(/rounded-3xl|Benefício exclusivo/)
    expect(sources).not.toMatch(/href=["'`]\/(?:dashboard|settings|carteira)["'`]/)
  })
})
