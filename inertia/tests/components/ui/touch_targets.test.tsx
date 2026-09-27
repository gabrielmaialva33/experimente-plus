import { screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { AppBrand } from '~/components/app_brand'
import { PasswordField } from '~/components/auth/password_field'
import { Button, buttonVariants } from '~/components/ui/button'
import { Checkbox } from '~/components/ui/checkbox'
import { render } from '~/tests/test_utils'

vi.mock('@inertiajs/react', () => ({
  Link: ({ href, children, ...props }: ComponentProps<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  usePage: () => ({ props: { app: { name: 'Experimente+' } } }),
}))

// JSDOM has no pointer media query: these guard the classes that reach 44 px on a touch
// screen while a mouse keeps the denser desktop size.
describe('touch targets', () => {
  it('grows glyph-only buttons to 44 px on a coarse pointer', () => {
    expect(buttonVariants({ size: 'icon' })).toContain('pointer-coarse:size-11')
    for (const size of ['sm', 'md', 'icon'] as const) {
      expect(buttonVariants({ size, mode: 'icon' })).toContain('pointer-coarse:size-11')
    }

    render(
      <Button size="icon" mode="icon" aria-label="Abrir navegação">
        ≡
      </Button>
    )
    expect(screen.getByRole('button', { name: 'Abrir navegação' })).toHaveClass(
      'size-10',
      'pointer-coarse:size-11'
    )
  })

  it('gives small inline controls a 44 px hit area around their drawn size', () => {
    render(
      <>
        <Checkbox aria-label="Li e aceito os termos" />
        <PasswordField id="password" name="password" label="Senha" />
      </>
    )

    expect(screen.getByRole('checkbox', { name: 'Li e aceito os termos' })).toHaveClass(
      'touch-hitbox'
    )
    expect(screen.getByRole('button', { name: 'Mostrar senha' })).toHaveClass(
      'touch-hitbox',
      'size-7'
    )
  })

  it('keeps the brand link 44 px tall, and 44 px wide when only the mark shows', () => {
    const { unmount } = render(<AppBrand href="/" />)
    expect(screen.getByRole('link', { name: 'Experimente+' })).toHaveClass('min-h-11')
    expect(screen.getByRole('link', { name: 'Experimente+' })).not.toHaveClass('min-w-11')
    unmount()

    render(<AppBrand href="/" collapsed />)
    expect(screen.getByRole('link', { name: 'Experimente+' })).toHaveClass(
      'min-h-11',
      'min-w-11',
      'justify-center'
    )
  })
})
