import type { AnchorHTMLAttributes } from 'react'
import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'

import { buildPageHref, PaginationNav } from '~/components/pagination'
import { render } from '~/tests/test_utils'
import { vi } from 'vitest'

vi.mock('@inertiajs/react', () => ({
  Link: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

describe('buildPageHref', () => {
  it('serializes only meaningful params', () => {
    expect(
      buildPageHref('/backoffice/feedback', {
        status: 'new',
        context: '',
        organization_id: undefined,
        establishment_id: null,
        page: 2,
      })
    ).toBe('/backoffice/feedback?status=new&page=2')
  })

  it('keeps zero values and returns the bare path without params', () => {
    expect(buildPageHref('/backoffice/moderation', { page: 0 })).toBe(
      '/backoffice/moderation?page=0'
    )
    expect(buildPageHref('/backoffice/moderation', { status: '' })).toBe('/backoffice/moderation')
  })
})

describe('PaginationNav', () => {
  const buildHref = (page: number) => `/backoffice/feedback?status=new&page=${page}`

  it('renders nothing when there is a single page', () => {
    const { container } = render(
      <PaginationNav currentPage={1} lastPage={1} buildHref={buildHref} />
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('links every visible page preserving the filters', () => {
    render(<PaginationNav currentPage={5} lastPage={10} buildHref={buildHref} />)

    expect(screen.getByRole('link', { name: 'Página 4' })).toHaveAttribute(
      'href',
      '/backoffice/feedback?status=new&page=4'
    )
    expect(screen.getByRole('link', { name: 'Página 6' })).toHaveAttribute(
      'href',
      '/backoffice/feedback?status=new&page=6'
    )
    expect(screen.getByRole('link', { name: 'Página 10' })).toHaveAttribute(
      'href',
      '/backoffice/feedback?status=new&page=10'
    )
  })

  it('marks the current page and keeps prev/next reachable', () => {
    render(<PaginationNav currentPage={2} lastPage={3} buildHref={buildHref} />)

    expect(screen.getByRole('link', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: /Anterior/ })).toHaveAttribute(
      'href',
      '/backoffice/feedback?status=new&page=1'
    )
    expect(screen.getByRole('link', { name: /Próxima/ })).toHaveAttribute(
      'href',
      '/backoffice/feedback?status=new&page=3'
    )
  })

  it('disables the unavailable direction at the boundaries', () => {
    render(<PaginationNav currentPage={1} lastPage={3} buildHref={buildHref} />)

    expect(screen.queryByRole('link', { name: /Anterior/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Anterior/ })).toBeDisabled()
    expect(screen.getByRole('link', { name: /Próxima/ })).toBeInTheDocument()
  })
})
