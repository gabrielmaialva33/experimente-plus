import { screen, within } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { recapSentence, savingsAmount, WalletSavings } from '~/components/consumer/wallet_savings'
import WalletPage from '~/pages/wallet/index'
import { render } from '~/tests/test_utils'
import type { BenefitSavings, SavingsTotals } from '~/types/benefit_savings'

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

const none: SavingsTotals = {
  places_visited: 0,
  benefits_used: 0,
  savings_exact_cents: 0,
  savings_estimated_cents: 0,
  uses_without_estimate: 0,
  top_places: [],
}

function savings(overrides: Partial<BenefitSavings> = {}): BenefitSavings {
  return { currency: 'BRL', current: { ...none, editions: [] }, past: [], ...overrides }
}

const edition = { id: 3, name: 'Experimente Londrina 2026', year: 2026 }

/** Intl separates "R$" from the number with a no-break space. */
const money = (text: string) => new RegExp(text.replace('R$ ', 'R\\$\\s'))

describe('wallet savings', () => {
  it('asks for the first use before there is anything to count', () => {
    render(<WalletSavings savings={savings()} />)

    expect(screen.getByRole('heading', { level: 2, name: 'Sua economia' })).toBeInTheDocument()
    expect(
      screen.getByText('Use seu primeiro benefício para começar a contar.')
    ).toBeInTheDocument()
    expect(screen.queryByText('Lugares visitados')).not.toBeInTheDocument()
    expect(screen.queryByText('Edições anteriores')).not.toBeInTheDocument()
  })

  it('shows an exact amount without "cerca de" when only fixed discounts count', () => {
    render(
      <WalletSavings
        savings={savings({
          current: {
            ...none,
            editions: [edition],
            places_visited: 2,
            benefits_used: 3,
            savings_exact_cents: 2500,
            top_places: [
              { name: 'Café Aurora', visits: 2 },
              { name: 'Bistrô Ipê', visits: 1 },
            ],
          },
        })}
      />
    )

    const section = screen.getByRole('region', { name: 'Sua economia' })
    expect(within(section).getByText('Nesta edição: Experimente Londrina 2026')).toBeInTheDocument()
    const money25 = within(section).getByText(money('R$ 25,00'))
    expect(money25).toHaveTextContent(/^R\$\s25,00$/)
    expect(within(section).getByText('Economia')).toBeInTheDocument()
    expect(within(section).queryByText('Economia estimada')).not.toBeInTheDocument()
    expect(within(section).queryByText(/cerca de/)).not.toBeInTheDocument()

    const places = within(section).getByRole('list', { name: 'Lugares mais visitados' })
    expect(
      within(places)
        .getAllByRole('listitem')
        .map((item) => item.textContent)
    ).toEqual(['Café Aurora2 visitas', 'Bistrô Ipê1 visita'])
  })

  it('says "cerca de" and explains the estimate once a percentage is estimated', async () => {
    const { user } = render(
      <WalletSavings
        savings={savings({
          current: {
            ...none,
            editions: [edition],
            places_visited: 3,
            benefits_used: 4,
            savings_exact_cents: 1500,
            savings_estimated_cents: 1700,
            uses_without_estimate: 1,
            top_places: [{ name: 'Café Aurora', visits: 2 }],
          },
        })}
      />
    )

    expect(screen.getByText('Economia estimada')).toBeInTheDocument()
    expect(screen.getByText(money('cerca de R$ 32,00'))).toBeInTheDocument()
    expect(
      screen.getByText('1 uso ficou fora da estimativa porque o lugar não informa o ticket médio.')
    ).toBeInTheDocument()

    const explanation = screen.getByText('Como calculamos a economia')
    const details = explanation.closest('details')!
    expect(details).not.toHaveAttribute('open')
    await user.click(explanation)
    expect(details).toHaveAttribute('open')
    expect(within(details).getByText(/estimados com o ticket médio do lugar/)).toBeVisible()
    expect(within(details).getByText(/Cortesias e “compre um, ganhe outro”/)).toBeVisible()
  })

  it('recaps each past edition, with "cerca de" only where an estimate is involved', () => {
    render(
      <WalletSavings
        savings={savings({
          past: [
            {
              ...none,
              edition: { id: 2, name: 'Experimente Londrina 2025', year: 2025 },
              places_visited: 4,
              benefits_used: 5,
              savings_exact_cents: 3000,
              savings_estimated_cents: 9000,
            },
            {
              ...none,
              edition: { id: 1, name: 'Experimente Londrina 2024', year: 2024 },
              places_visited: 1,
              benefits_used: 1,
              savings_exact_cents: 1000,
            },
            {
              ...none,
              edition: { id: 0, name: 'Experimente Londrina 2023', year: 2023 },
              places_visited: 1,
              benefits_used: 2,
            },
          ],
        })}
      />
    )

    // The person has not used the new edition yet: the recap still shows.
    expect(
      screen.getByText('Use seu primeiro benefício para começar a contar.')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 3, name: 'Edições anteriores' })
    ).toBeInTheDocument()
    expect(
      screen.getByText(money('Em 2025 você visitou 4 lugares e economizou cerca de R$ 120,00.'))
    ).toBeInTheDocument()
    expect(
      screen.getByText(money('Em 2024 você visitou 1 lugar e economizou R$ 10,00.'))
    ).toBeInTheDocument()
    expect(
      screen.getByText('Em 2023 você visitou 1 lugar e usou 2 benefícios.')
    ).toBeInTheDocument()
    expect(screen.getByText('Experimente Londrina 2025')).toBeInTheDocument()
  })

  it('formats the money in pt-BR', () => {
    expect(savingsAmount({ ...none, savings_exact_cents: 1250 })).toMatch(/^R\$\s12,50$/)
    expect(savingsAmount({ ...none, savings_estimated_cents: 123456 })).toMatch(
      /^cerca de R\$\s1\.234,56$/
    )
    expect(savingsAmount(none)).toBeNull()
    expect(recapSentence(2026, { ...none, places_visited: 2, benefits_used: 1 })).toBe(
      'Em 2026 você visitou 2 lugares e usou 1 benefício.'
    )
  })

  it('sits in the wallet page, after the benefits, when the page has savings', () => {
    const wallet = {
      summary: { passes: 0, benefits: 0, available: 0, upcoming: 0, redeemed: 0 },
      passes: [],
    }
    const { unmount } = render(<WalletPage wallet={wallet} />)
    expect(screen.queryByRole('region', { name: 'Sua economia' })).not.toBeInTheDocument()
    unmount()

    render(<WalletPage wallet={wallet} savings={savings()} />)
    const section = screen.getByRole('region', { name: 'Sua economia' })
    const empty = screen.getByRole('heading', { name: 'Sua carteira ainda está vazia' })
    expect(empty.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
