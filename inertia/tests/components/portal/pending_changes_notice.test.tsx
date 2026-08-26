import { describe, expect, it, vi } from 'vitest'

import { PendingChangesNotice } from '~/components/portal/establishment_editor/pending_changes_notice'
import { render, screen } from '~/tests/test_utils'

describe('PendingChangesNotice', () => {
  it('stays hidden when the editor is clean and idle', () => {
    const { container } = render(
      <PendingChangesNotice dirtySectionCount={0} busy={false} onReview={() => undefined} />
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('explains that moderation only receives saved data and opens the first dirty section', async () => {
    const onReview = vi.fn()
    const { user } = render(
      <PendingChangesNotice
        dirtySectionCount={2}
        firstSectionLabel="Identidade"
        busy={false}
        onReview={onReview}
      />
    )

    expect(screen.getByRole('alert')).toHaveTextContent('2 etapas possuem mudanças locais')
    expect(screen.getByRole('alert')).toHaveTextContent('dados já salvos no servidor')

    await user.click(screen.getByRole('button', { name: /revisar identidade/i }))
    expect(onReview).toHaveBeenCalledOnce()
  })

  it('announces an operation in progress without presenting a review action', () => {
    render(<PendingChangesNotice dirtySectionCount={0} busy onReview={() => undefined} />)

    expect(screen.getByRole('status')).toHaveTextContent('Atualizando os dados da unidade')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
