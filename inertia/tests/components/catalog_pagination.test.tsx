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

function meta(page: number, lastPage = 3): CatalogSearchMeta {
  return {
    total: 57,
    page,
    perPage: 24,
    lastPage,
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

  it('does not render pagination when there is only one canonical page', () => {
    const { container } = render(
      <CatalogPagination path="/cidades/londrina" query={query} meta={meta(9, 1)} />
    )

    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByRole('navigation', { name: 'Paginação dos resultados' })).toBeNull()
  })

  it('clamps invalid out-of-range metadata to the canonical last page', () => {
    render(<CatalogPagination path="/cidades/londrina" query={query} meta={meta(99)} />)

    expect(screen.getByText('Página', { exact: false })).toHaveTextContent('Página 3 de 3')
    expect(screen.getByLabelText('Página 3, página atual')).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('link', { name: 'Próxima página' })).toBeNull()

    const previousHref = screen.getByRole('link', { name: 'Página anterior' }).getAttribute('href')
    expect(new URL(previousHref!, 'https://experimente.test').searchParams.get('page')).toBe('2')
  })

  it('keeps category-route filters encoded without duplicating category in the query string', () => {
    render(
      <CatalogPagination
        path="/cidades/cornelio-procopio/categorias/cafes"
        query={{ q: 'café & chá', category: null, openNow: true, sort: 'recent' }}
        meta={meta(1)}
      />
    )

    const nextHref = screen.getByRole('link', { name: 'Próxima página' }).getAttribute('href')
    const url = new URL(nextHref!, 'https://experimente.test')

    expect(url.pathname).toBe('/cidades/cornelio-procopio/categorias/cafes')
    expect(url.searchParams.get('q')).toBe('café & chá')
    expect(url.searchParams.has('category')).toBe(false)
    expect(url.searchParams.get('open_now')).toBe('true')
    expect(url.searchParams.get('sort')).toBe('recent')
    expect(url.searchParams.get('per_page')).toBe('24')
    expect(url.searchParams.get('page')).toBe('2')
  })
})
