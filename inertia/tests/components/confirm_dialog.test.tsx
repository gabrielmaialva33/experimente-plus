import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ConfirmDialog } from '~/components/confirm_dialog'
import { Button } from '~/components/ui/button'
import { render } from '~/tests/test_utils'

function renderDialog(props: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  const onConfirm = vi.fn()

  const utils = render(
    <ConfirmDialog
      trigger={<Button variant="destructive">Rejeitar revisão</Button>}
      title="Rejeitar esta revisão?"
      description="A revisão será encerrada de forma terminal e não poderá ser reaberta."
      confirmLabel="Rejeitar"
      destructive
      onConfirm={onConfirm}
      {...props}
    />
  )

  return { onConfirm, ...utils }
}

describe('ConfirmDialog', () => {
  it('only fires the action after explicit confirmation', async () => {
    const { user, onConfirm } = renderDialog()

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Rejeitar revisão' }))

    const dialog = screen.getByRole('alertdialog', { name: 'Rejeitar esta revisão?' })
    expect(dialog).toHaveTextContent('A revisão será encerrada de forma terminal')
    expect(onConfirm).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Rejeitar' }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('cancels without firing the action and returns focus to the trigger', async () => {
    const { user, onConfirm } = renderDialog()

    const trigger = screen.getByRole('button', { name: 'Rejeitar revisão' })
    await user.click(trigger)
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('blocks confirm and cancel while processing', async () => {
    const { user, onConfirm } = renderDialog({ processing: true, open: true })

    const confirm = screen.getByRole('button', { name: /Rejeitar$/ })
    const cancel = screen.getByRole('button', { name: 'Cancelar' })

    expect(confirm).toBeDisabled()
    expect(cancel).toBeDisabled()

    await user.click(confirm)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('disables confirmation when the caller marks it as disabled', () => {
    renderDialog({ disabled: true, open: true })

    expect(screen.getByRole('button', { name: /Rejeitar$/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeEnabled()
  })
})
