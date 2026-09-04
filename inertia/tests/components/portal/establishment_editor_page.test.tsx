import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { RejectionContextNotice, RevisionReadOnlyNotice } from '~/pages/portal/establishments/edit'
import { render } from '~/tests/test_utils'

describe('Establishment editor page', () => {
  it('explains the latest relevant rejection in a labelled panel', () => {
    render(
      <RejectionContextNotice
        context={{
          version: 4,
          notes: 'Atualize as informações de contato antes de tentar novamente.',
        }}
      />
    )

    expect(screen.getByRole('heading', { name: 'Motivo da rejeição' })).toBeVisible()
    expect(screen.getByText('Revisão 4')).toBeVisible()
    expect(
      screen.getByText('Atualize as informações de contato antes de tentar novamente.')
    ).toBeVisible()
  })

  it('uses a friendly fallback when a legacy rejection has no notes', () => {
    render(<RejectionContextNotice context={{ version: 2, notes: null }} />)

    expect(screen.getByText(/Consulte a equipe da plataforma/)).toBeVisible()
  })

  it('explains analyst access without claiming that a draft is editable', () => {
    render(<RevisionReadOnlyNotice presentationStatus="draft" revisionStatus="draft" />)

    expect(screen.getByText('Apenas leitura para seu acesso')).toBeVisible()
    expect(screen.getByText(/consultar esta ficha/)).toBeVisible()
    expect(screen.queryByText('A ficha está aberta para edição.')).not.toBeInTheDocument()
  })

  it('presents the current publication as a state instead of an editing lock', () => {
    render(<RevisionReadOnlyNotice presentationStatus="published" revisionStatus="approved" />)

    expect(screen.getByText('Publicação vigente')).toBeVisible()
    expect(screen.getByText(/catálogo público/)).toBeVisible()
  })

  it('presents a rejected revision with its terminal state', () => {
    render(<RevisionReadOnlyNotice presentationStatus="rejected" revisionStatus="rejected" />)

    expect(screen.getByText('Revisão rejeitada')).toBeVisible()
    expect(screen.getByText(/encerrada sem publicação/)).toBeVisible()
  })
})
