import { within } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { MANUAL_CHAPTERS } from '~/content/manual'
import ManualPage from '~/pages/manual/index'
import { render, screen } from '~/tests/test_utils'

vi.mock('@inertiajs/react', () => ({
  Head: () => null,
  Link: ({ href, children, ...props }: ComponentProps<'a'> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  router: { post: vi.fn() },
  usePage: () => ({
    url: '/manual',
    props: { auth: { user: null, tenants: [], activeTenantId: null, permissions: [] } },
  }),
}))

vi.mock('~/components/theme/theme_toggle', () => ({
  ThemeToggle: () => <button type="button">Alterar tema</button>,
}))

describe('Manual page', () => {
  it('opens with the title, the beta warning and the PDF', () => {
    render(<ManualPage />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'Como usar o Experimente+' })
    ).toBeVisible()
    const beta = screen.getByRole('note', { name: 'Versão beta em homologação' })
    expect(beta).toHaveTextContent(/fictícios/)
    expect(beta).toHaveTextContent(/simulados: nada é cobrado/)
    expect(screen.getByRole('link', { name: 'Baixar manual em PDF' })).toHaveAttribute(
      'href',
      '/manual-media/manual-experimente-plus.pdf'
    )
    expect(screen.getAllByText(/Atualizado em 27 de setembro de 2026/)[0]).toBeVisible()
  })

  it('anchors every chapter and section with its heading', () => {
    const { container } = render(<ManualPage />)

    for (const chapter of MANUAL_CHAPTERS) {
      const element = container.querySelector(`section#${chapter.id}`)
      expect(element, chapter.id).not.toBeNull()
      expect(
        within(element as HTMLElement).getByRole('heading', { level: 2, name: chapter.title })
      ).toBeInTheDocument()
      for (const section of chapter.sections) {
        const sub = container.querySelector(`section#${section.id}`)
        expect(sub, section.id).not.toBeNull()
        expect(sub).toHaveAttribute('aria-labelledby', `${section.id}-titulo`)
      }
    }
  })

  it('offers a table of contents on wide screens and a collapsible one on phones', () => {
    const { container } = render(<ManualPage />)

    const wide = screen.getByRole('complementary', { name: 'Sumário' })
    expect(
      within(wide).getByRole('link', { name: 'Visitante: descobrir sem conta' })
    ).toHaveAttribute('href', '#visitante')

    // Closed until the reader opens it, so its links are hidden from the tree.
    const phone = container.querySelector('details nav[aria-label="Sumário"]') as HTMLElement
    expect(phone).not.toBeNull()
    expect(
      within(phone).getByRole('link', { name: 'Escolher a cidade', hidden: true })
    ).toHaveAttribute('href', '#visitante-explorar')
    expect(container.querySelector('details summary')).toHaveTextContent('Neste manual')
  })

  it('describes every screenshot and reserves its size', () => {
    render(<ManualPage />)

    const images = screen.getAllByRole('img')
    expect(images.length).toBeGreaterThan(50)
    for (const image of images) {
      expect(image.getAttribute('alt')?.length ?? 0).toBeGreaterThan(40)
      expect(image).toHaveAttribute('width')
      expect(image).toHaveAttribute('height')
      expect(image).toHaveAttribute('loading', 'lazy')
    }
  })

  it('prints only the manual, one chapter per page', () => {
    const { container } = render(<ManualPage />)

    expect(container.querySelector('style')?.textContent).toMatch(
      /@media print[\s\S]*\[data-public-shell\] > :not\(main\)/
    )
    expect(container.querySelector('section#visitante')).toHaveClass('print:break-before-page')
    expect(screen.getByRole('navigation', { name: 'Sumário para impressão' })).toHaveClass(
      'hidden',
      'print:block'
    )
  })
})
