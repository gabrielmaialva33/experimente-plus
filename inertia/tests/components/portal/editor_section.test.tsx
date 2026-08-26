import { describe, expect, it, vi } from 'vitest'

import { EditorSaveBar } from '~/components/portal/editor_section'
import { render, screen } from '~/tests/test_utils'

describe('EditorSaveBar', () => {
  it('offers an explicit way to discard local changes', async () => {
    const onDiscard = vi.fn()
    const { user } = render(
      <EditorSaveBar
        processing={false}
        recentlySuccessful={false}
        dirty
        label="Salvar etapa"
        onDiscard={onDiscard}
      />
    )

    expect(screen.getByRole('status')).toHaveTextContent('ainda não foram salvas')
    await user.click(screen.getByRole('button', { name: 'Descartar alterações' }))
    expect(onDiscard).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Salvar etapa' })).toBeEnabled()
  })

  it('hides the discard action when there are no local changes', () => {
    render(
      <EditorSaveBar
        processing={false}
        recentlySuccessful={false}
        dirty={false}
        label="Salvar etapa"
        onDiscard={() => undefined}
      />
    )

    expect(screen.queryByRole('button', { name: 'Descartar alterações' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salvar etapa' })).toBeDisabled()
  })
})
