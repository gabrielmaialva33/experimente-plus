import { screen } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { CatalogPagination } from '~/components/catalog/catalog_pagination'
import type { CatalogSearchMeta, CatalogSearchQuery } from '~/lib/catalog'
import { render } from '~/tests/test_utils'

vi.mock('@inertiajs/react', () => ({
  Link: ({
    href,
    children,
    preserveScroll: _preserveScroll,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string
    children: ReactNode
    preserveScroll?: boolean
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

const query: CatalogSearchQuery = {
  q: 'café especial',
  category: 'cafes',
  openNow: true,
  sort: 'recent',
}

function meta(page: number): CatalogSearchMeta {
  return {
    total: 57,
    page,
    perPage: 24,
    lastPage: 3,
  }
}

describe('CatalogPagination', () => {
  it('keeps unavailable directions outside the tab order and preserves all filters', () => {
    render(<CatalogPagination path="/cidades/londrina" query={query} meta={meta(1)} />)

    expect(screen.queryByRole('link', { name: 'Página anterior' })).not.toBeInTheDocument()
    expect(screen.getByText('Anterior').closest('[aria-disabled="true"]')).toBeInTheDocument()
    expect(screen.getByLabelText('Página 1, página atual')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByLabelText('Página 1, página atual').tagName).toBe('SPAN')

    const nextHref = screen.getByRole('link', { name: 'Próxima página' }).getAttribute('href')
    expect(nextHref).not.toBeNull()

    const url = new URL(nextHref!, 'https://experimente.test')
    expect(url.pathname).toBe('/cidades/londrina')
    expect(url.searchParams.get('q')).toBe('café especial')
    expect(url.searchParams.get('category')).toBe('cafes')
    expect(url.searchParams.get('open_now')).toBe('true')
    expect(url.searchParams.get('sort')).toBe('recent')
    expect(url.searchParams.get('per_page')).toBe('24')
    expect(url.searchParams.get('page')).toBe('2')
  })

  it('renders the last page and the unavailable next direction as non-interactive text', () => {
    render(<CatalogPagination path="/cidades/londrina" query={query} meta={meta(3)} />)

    expect(screen.getByRole('link', { name: 'Página anterior' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Próxima página' })).not.toBeInTheDocument()
    expect(screen.getByText('Próxima').closest('[aria-disabled="true"]')).toBeInTheDocument()
    expect(screen.getByLabelText('Página 3, página atual')).toHaveAttribute('aria-current', 'page')
  })
})
