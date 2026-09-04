import type { ReactNode } from 'react'
import { ChartNoAxesColumn } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'

import { MetricCard } from '~/components/metric_card'
import { render, screen } from '~/tests/test_utils'

vi.mock('@inertiajs/react', () => ({
  Link: ({
    children,
    href,
    className,
  }: {
    children: ReactNode
    href: string
    className?: string
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

describe('MetricCard', () => {
  it('is a flat, non-interactive summary when no destination exists', () => {
    const { container } = render(
      <MetricCard label="Organizações" value={4} icon={ChartNoAxesColumn} />
    )

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(container.querySelector('[data-slot="card"]')).not.toHaveClass(
      'hover:-translate-y-0.5',
      'hover:shadow-md',
      'shadow-xs'
    )
  })

  it('turns the whole card into a focusable link only when it has a destination', () => {
    render(
      <MetricCard
        label="Organizações"
        value={4}
        icon={ChartNoAxesColumn}
        href="/portal/organizations"
        linkLabel="Ver organizações"
      />
    )

    const link = screen.getByRole('link', { name: /Organizações 4 Ver organizações/ })
    expect(link).toHaveAttribute('href', '/portal/organizations')
    expect(link).toHaveClass('focus-visible:ring-2')
  })
})
