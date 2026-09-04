import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import EstablishmentRevisionAction from '~/components/portal/establishment_revision_action'
import { render } from '~/tests/test_utils'

describe('EstablishmentRevisionAction', () => {
  it('uses the published revision source selected by the server', () => {
    const onCreate = vi.fn()
    render(<EstablishmentRevisionAction allowed source="published" onCreate={onCreate} />)

    fireEvent.click(screen.getByRole('button', { name: 'Criar nova revisão' }))
    expect(onCreate).toHaveBeenCalledOnce()
    expect(onCreate).toHaveBeenCalledWith('published')
  })

  it('uses latest_terminal when retrying a rejected first revision', () => {
    const onCreate = vi.fn()
    render(<EstablishmentRevisionAction allowed source="latest_terminal" onCreate={onCreate} />)

    fireEvent.click(screen.getByRole('button', { name: 'Criar nova revisão' }))
    expect(onCreate).toHaveBeenCalledWith('latest_terminal')
  })

  it('renders no action without both capability and a canonical source', () => {
    const { rerender } = render(
      <EstablishmentRevisionAction allowed={false} source="published" onCreate={vi.fn()} />
    )
    expect(screen.queryByRole('button', { name: 'Criar nova revisão' })).not.toBeInTheDocument()

    rerender(<EstablishmentRevisionAction allowed source={null} onCreate={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Criar nova revisão' })).not.toBeInTheDocument()
  })
})
