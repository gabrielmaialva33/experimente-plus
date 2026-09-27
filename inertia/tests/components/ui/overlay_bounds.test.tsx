import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '~/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '~/components/ui/sheet'
import { render } from '~/tests/test_utils'

// JSDOM has no layout: these guard the classes that keep an overlay inside a 320 px phone
// or a phone on its side, where the report dialog used to push its title and its submit
// button off screen.
const BOUNDED_WIDTH = 'w-[calc(100%-2rem)]'
const BOUNDED_HEIGHT = 'max-h-[calc(100dvh-2rem)]'

describe('overlay bounds', () => {
  it('keeps a dialog inside the screen and scrolls its content instead', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Denunciar avaliação</DialogTitle>
          <DialogDescription>Qual é o problema?</DialogDescription>
        </DialogContent>
      </Dialog>
    )

    const dialog = screen.getByRole('dialog', { name: 'Denunciar avaliação' })
    expect(dialog).toHaveClass(BOUNDED_WIDTH, BOUNDED_HEIGHT, 'overflow-y-auto', 'rounded-lg')
    expect(dialog).toHaveClass('overscroll-contain')
  })

  it('bounds a confirmation the same way as a dialog', () => {
    render(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogTitle>Remover esta imagem?</AlertDialogTitle>
          <AlertDialogDescription>A imagem será removida.</AlertDialogDescription>
        </AlertDialogContent>
      </AlertDialog>
    )

    expect(screen.getByRole('alertdialog', { name: 'Remover esta imagem?' })).toHaveClass(
      BOUNDED_WIDTH,
      BOUNDED_HEIGHT,
      'overflow-y-auto'
    )
  })

  it('lets a sheet scroll inside itself when it is taller than the screen', () => {
    render(
      <Sheet open>
        <SheetContent side="left">
          <SheetTitle>Navegação principal</SheetTitle>
          <SheetDescription>Áreas disponíveis</SheetDescription>
        </SheetContent>
      </Sheet>
    )

    expect(screen.getByRole('dialog', { name: 'Navegação principal' })).toHaveClass(
      'overflow-y-auto',
      'overscroll-contain'
    )
  })

  it('keeps menus and popovers within the room Radix measures beside the trigger', () => {
    render(
      <>
        <DropdownMenu open>
          <DropdownMenuTrigger>Operações</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Experimente+ Development</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Popover open>
          <PopoverTrigger>Filtros</PopoverTrigger>
          <PopoverContent>Conteúdo do filtro</PopoverContent>
        </Popover>
      </>
    )

    expect(screen.getByRole('menu')).toHaveClass(
      'max-w-(--radix-dropdown-menu-content-available-width)',
      'max-h-(--radix-dropdown-menu-content-available-height)',
      'overflow-y-auto'
    )
    expect(screen.getByText('Conteúdo do filtro')).toHaveClass(
      'max-w-(--radix-popover-content-available-width)',
      'max-h-(--radix-popover-content-available-height)'
    )
  })
})
