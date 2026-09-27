import { usePage } from '@inertiajs/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { HelpMenu } from '~/components/manual/help_menu'
import { render, screen } from '~/tests/test_utils'

const page = (component?: string) =>
  ({ component, url: '/', props: {} }) as unknown as ReturnType<typeof usePage>

describe('HelpMenu', () => {
  beforeEach(() => {
    vi.mocked(usePage).mockReturnValue(page('portal/reviews/index'))
  })

  it('opens the manual at the section of the current page, in a new tab', async () => {
    const { user } = render(<HelpMenu surface="portal" />)

    await user.click(screen.getByRole('button', { name: 'Ajuda' }))

    const help = screen.getByRole('menuitem', { name: /Ajuda desta página/ })
    expect(help).toHaveAttribute('href', '/manual#parceiro-avaliacoes')
    expect(help).toHaveAttribute('target', '_blank')
    expect(help).toHaveAttribute('rel', expect.stringContaining('noopener'))
    expect(help).toHaveAccessibleName(/abre em nova aba/)
  })

  it('offers the whole manual and its PDF', async () => {
    const { user } = render(<HelpMenu surface="portal" />)

    await user.click(screen.getByRole('button', { name: 'Ajuda' }))

    expect(screen.getByRole('menuitem', { name: /Manual completo/ })).toHaveAttribute(
      'href',
      '/manual'
    )
    const pdf = screen.getByRole('menuitem', { name: 'Baixar manual em PDF' })
    expect(pdf).toHaveAttribute('href', '/manual-media/manual-experimente-plus.pdf')
    expect(pdf).toHaveAttribute('download')
  })

  it('falls back to the chapter of the area for a page without its own section', async () => {
    vi.mocked(usePage).mockReturnValue(page('settings/index'))
    const { user } = render(<HelpMenu surface="backoffice" />)

    await user.click(screen.getByRole('button', { name: 'Ajuda' }))

    expect(screen.getByRole('menuitem', { name: /Ajuda desta página/ })).toHaveAttribute(
      'href',
      '/manual#administracao'
    )
  })
})
