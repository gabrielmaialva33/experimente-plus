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

  it('starts from the profiles: each card leads to its part of the manual', () => {
    render(<ManualPage />)

    const start = screen.getByRole('navigation', { name: /Por onde começar/ })
    expect(within(start).getByRole('link', { name: /^Parceiro/ })).toHaveAttribute(
      'href',
      '#perfil-parceiro'
    )
    expect(within(start).getByRole('link', { name: /^Equipe do Experimente\+/ })).toHaveAttribute(
      'href',
      '#perfil-equipe'
    )
  })

  it('anchors every chapter and task, says whom each chapter is for and leads back to the index', () => {
    const { container } = render(<ManualPage />)

    for (const chapter of MANUAL_CHAPTERS) {
      const element = container.querySelector(`section#${chapter.id}`) as HTMLElement
      expect(element, chapter.id).not.toBeNull()
      expect(
        within(element).getByRole('heading', { level: 2, name: chapter.title })
      ).toBeInTheDocument()
      expect(within(element).getByText(`Para: ${chapter.profiles}`)).toBeInTheDocument()
      expect(within(element).getByRole('link', { name: 'Voltar ao índice' })).toHaveAttribute(
        'href',
        '#indice'
      )
      for (const section of chapter.sections) {
        const sub = container.querySelector(`section#${section.id}`)
        expect(sub, section.id).not.toBeNull()
        expect(sub).toHaveAttribute('aria-labelledby', `${section.id}-titulo`)
      }
    }
    expect(container.querySelector('#indice')).not.toBeNull()
  })

  it('frames a task with what it needs, what the reader sees and what can go wrong', () => {
    const { container } = render(<ManualPage />)

    const task = container.querySelector('section#parceiro-validar') as HTMLElement
    expect(within(task).getByText('Você vai precisar de:')).toBeInTheDocument()
    expect(within(task).getByText('Pronto:')).toBeInTheDocument()
    expect(within(task).getByText('Se algo der errado')).toBeInTheDocument()
    expect(within(task).getAllByText(/Passo \d:/).length).toBeGreaterThan(2)
  })

  it('filters the sections as the reader types in the search', async () => {
    const { user } = render(<ManualPage />)

    const search = screen.getByRole('searchbox', { name: 'Buscar no manual' })
    await user.type(search, 'excluir conta')

    expect(screen.getByRole('status')).toHaveTextContent(/encontrada/)
    const result = within(screen.getByRole('search')).getByRole('link', {
      name: /Como excluir sua conta/,
    })
    expect(result).toHaveAttribute('href', '#consumidor-excluir-conta')

    await user.clear(search)
    await user.type(search, 'xylofone')
    expect(screen.getByRole('status')).toHaveTextContent('Nenhuma parte do manual encontrada')

    await user.click(screen.getByRole('button', { name: 'Limpar a busca' }))
    expect(search).toHaveValue('')
  })

  it('offers a table of contents on wide screens and a collapsible one on phones', () => {
    const { container } = render(<ManualPage />)

    const wide = screen.getByRole('complementary', { name: 'Sumário' })
    expect(within(wide).getByRole('link', { name: 'Perfis de acesso' })).toHaveAttribute(
      'href',
      '#perfis'
    )
    const phone = container.querySelector('details nav[aria-label="Sumário"]') as HTMLElement
    expect(phone).not.toBeNull()
    expect(
      within(phone).getByRole('link', { name: 'Como escolher uma cidade', hidden: true })
    ).toHaveAttribute('href', '#visitante-explorar')
    expect(container.querySelector('details summary')).toHaveTextContent('Neste manual')
  })

  it('shows the profile comparison as a table and as cards for phones', () => {
    const { container } = render(<ManualPage />)

    const section = container.querySelector('section#perfis-qual-e-o-meu') as HTMLElement
    expect(within(section).getByRole('table')).toBeInTheDocument()
    expect(within(section).getByRole('columnheader', { name: 'Onde começa' })).toBeInTheDocument()
    expect(section.querySelectorAll('ul > li dl').length).toBe(4)
  })

  it('describes every screenshot, reserves its size and opens it full size', () => {
    render(<ManualPage />)

    const images = screen.getAllByRole('img')
    expect(images.length).toBeGreaterThan(60)
    for (const image of images) {
      expect(image.getAttribute('alt')?.length ?? 0).toBeGreaterThan(40)
      expect(image).toHaveAttribute('width')
      expect(image).toHaveAttribute('height')
      expect(image).toHaveAttribute('loading', 'lazy')
      expect(image.closest('a')).toHaveAttribute('href', image.getAttribute('src'))
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
    expect(screen.getByRole('search')).toHaveClass('print:hidden')
  })
})
