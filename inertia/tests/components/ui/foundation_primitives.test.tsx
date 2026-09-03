import { screen } from '@testing-library/react'
import { FileText } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'

import { EmptyState } from '~/components/empty_state'
import { PageHeader } from '~/components/page_header'
import { Badge, BadgeButton } from '~/components/ui/badge'
import { Button, buttonVariants } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Input, InputWrapper } from '~/components/ui/input'
import { render } from '~/tests/test_utils'

describe('foundation primitives', () => {
  it('keeps buttons named, actionable and natively disabled', async () => {
    const onClick = vi.fn()
    const { user } = render(
      <>
        <Button onClick={onClick}>Salvar alterações</Button>
        <Button disabled>Excluir</Button>
      </>
    )

    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    expect(onClick).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Excluir' })).toBeDisabled()
  })

  it('preserves a Radix state unless the selected shorthand explicitly opens the button', () => {
    render(
      <>
        <Button data-state="closed">Menu fechado</Button>
        <Button data-state="closed" selected={false}>
          Menu ainda fechado
        </Button>
        <Button data-state="closed" selected>
          Menu aberto
        </Button>
      </>
    )

    expect(screen.getByRole('button', { name: 'Menu fechado' })).toHaveAttribute(
      'data-state',
      'closed'
    )
    expect(screen.getByRole('button', { name: 'Menu ainda fechado' })).toHaveAttribute(
      'data-state',
      'closed'
    )
    expect(screen.getByRole('button', { name: 'Menu aberto' })).toHaveAttribute(
      'data-state',
      'open'
    )
  })

  it('uses a solid, contrast-safe interaction color for the CTA variant', () => {
    const classes = buttonVariants({ variant: 'cta' })

    expect(classes).toContain('hover:bg-cta-accent')
    expect(classes).toContain('data-[state=open]:bg-cta-accent')
    expect(classes).not.toContain('bg-cta/')
  })

  it.each(['outline', 'dashed'] as const)(
    'keeps the contrast-safe control boundary for %s interactions',
    (variant) => {
      const classes = buttonVariants({ variant })

      expect(classes).toContain('border-input')
      expect(classes).not.toContain('hover:border-')
      expect(classes).not.toContain('data-[state=open]:border-')
      expect(classes).toContain('data-[state=open]:bg-accent')
    }
  )

  it('preserves child semantics and exposes the disabled state with asChild', () => {
    render(
      <>
        <Button asChild>
          <a href="/cidades">Explorar cidades</a>
        </Button>
        <Button asChild disabled>
          <a href="/indisponivel">Ação indisponível</a>
        </Button>
      </>
    )

    expect(screen.getByRole('link', { name: 'Explorar cidades' })).toHaveAttribute(
      'href',
      '/cidades'
    )
    expect(screen.getByRole('link', { name: 'Ação indisponível' })).toHaveAttribute(
      'aria-disabled',
      'true'
    )
    expect(screen.getByRole('link', { name: 'Ação indisponível' })).toHaveAttribute(
      'tabindex',
      '-1'
    )
  })

  it('forwards native input states used by accessible forms', () => {
    render(
      <>
        <Input aria-label="E-mail" aria-invalid="true" />
        <Input aria-label="Código" disabled />
      </>
    )

    expect(screen.getByRole('textbox', { name: 'E-mail' })).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('textbox', { name: 'Código' })).toBeDisabled()
  })

  it('keeps native-only states off editable input wrappers', () => {
    render(
      <InputWrapper data-testid="editable-input-wrapper">
        <Input aria-label="Campo editável" />
      </InputWrapper>
    )

    const wrapper = screen.getByTestId('editable-input-wrapper')
    const input = screen.getByRole('textbox', { name: 'Campo editável' })

    expect(wrapper).toHaveClass('border-input', 'bg-background')
    expect(wrapper).not.toHaveClass('read-only:cursor-not-allowed', 'read-only:bg-muted/70')
    expect(wrapper).not.toHaveClass('disabled:cursor-not-allowed', 'disabled:opacity-50')
    expect(wrapper.className).not.toContain('file:')
    expect(input).not.toHaveAttribute('readonly')
    expect(input).toHaveClass('read-only:cursor-not-allowed', 'read-only:bg-muted/70')
  })

  it('keeps card headings and badge actions semantic', async () => {
    const onRemove = vi.fn()
    const { user } = render(
      <Card>
        <CardHeader>
          <CardTitle>Resumo da unidade</CardTitle>
          <Badge variant="success" appearance="light">
            Publicada
          </Badge>
        </CardHeader>
        <CardContent>
          <BadgeButton aria-label="Remover filtro" onClick={onRemove} />
        </CardContent>
      </Card>
    )

    expect(screen.getByRole('heading', { name: 'Resumo da unidade' })).toBeVisible()
    expect(screen.getByText('Publicada')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Remover filtro' }))
    expect(onRemove).toHaveBeenCalledOnce()
  })

  it('gives page headers and empty states a predictable accessible structure', () => {
    render(
      <>
        <PageHeader
          title="Benefícios"
          description="Gerencie as ofertas desta unidade."
          actions={<Button>Novo benefício</Button>}
        />
        <EmptyState
          icon={FileText}
          headingLevel={2}
          title="Nenhum benefício publicado"
          description="Crie uma oferta quando estiver pronto."
        >
          <Button variant="outline">Criar oferta</Button>
        </EmptyState>
      </>
    )

    expect(screen.getByRole('heading', { level: 1, name: 'Benefícios' })).toBeVisible()
    expect(screen.getByText('Gerencie as ofertas desta unidade.')).toBeVisible()
    expect(
      screen.getByRole('heading', { level: 2, name: 'Nenhum benefício publicado' })
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Criar oferta' })).toBeEnabled()
  })
})
