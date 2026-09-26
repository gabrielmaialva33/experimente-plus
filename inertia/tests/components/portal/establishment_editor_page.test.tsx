import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  establishmentEditorDescription,
  ModerationCorrections,
  RejectionContextNotice,
  RevisionReadOnlyNotice,
} from '~/pages/portal/establishments/edit'
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

    expect(screen.getByRole('heading', { name: 'Motivo da recusa' })).toBeVisible()
    expect(screen.queryByText(/Revisão/)).not.toBeInTheDocument()
    expect(
      screen.getByText('Atualize as informações de contato antes de tentar novamente.')
    ).toBeVisible()
  })

  it('uses a friendly fallback when a legacy rejection has no notes', () => {
    render(<RejectionContextNotice context={{ version: 2, notes: null }} />)

    expect(screen.getByText(/Fale com a equipe do Experimente\+/)).toBeVisible()
  })

  it('explains analyst access without claiming that a draft is editable', () => {
    render(<RevisionReadOnlyNotice presentationStatus="draft" revisionStatus="draft" />)

    expect(screen.getByText('Apenas leitura para seu acesso')).toBeVisible()
    expect(screen.getByText(/consultar estes dados/)).toBeVisible()
    expect(
      screen.queryByText('Os dados do lugar estão abertos para edição.')
    ).not.toBeInTheDocument()
  })

  it('presents the current publication as a state instead of an editing lock', () => {
    render(<RevisionReadOnlyNotice presentationStatus="published" revisionStatus="approved" />)

    expect(screen.getByText('Publicado no app e no site')).toBeVisible()
    expect(screen.getByText(/bloqueados enquanto esta versão está no ar/)).toBeVisible()
  })

  it('presents a rejected revision with its terminal state', () => {
    render(<RevisionReadOnlyNotice presentationStatus="rejected" revisionStatus="rejected" />)

    expect(screen.getByText('Versão recusada')).toBeVisible()
    expect(screen.getByText(/recusada e não será publicada/)).toBeVisible()
  })

  it('uses action-aware page guidance instead of asking read-only users to edit', () => {
    expect(
      establishmentEditorDescription({
        editable: true,
        canCreateRevision: false,
        presentationStatus: 'draft',
      })
    ).toMatch(/^Preencha cada etapa/)

    expect(
      establishmentEditorDescription({
        editable: false,
        canCreateRevision: true,
        presentationStatus: 'published',
      })
    ).toBe(
      'Estes dados estão publicados. Ao editar, a versão atual continua no ar até a moderação aprovar a nova.'
    )

    expect(
      establishmentEditorDescription({
        editable: false,
        canCreateRevision: false,
        presentationStatus: 'draft',
      })
    ).toBe('Consulte os dados e as pendências em modo somente leitura.')
  })

  it('lists moderation corrections with the moderator summary and a way to each field', async () => {
    const onCorrect = vi.fn()
    const issues = [
      {
        id: 7,
        code: 'contact_outdated',
        field: 'public_phone',
        message: 'O telefone não atende.',
        severity: 'blocking',
      },
      {
        id: 8,
        code: 'general',
        field: 'revision',
        message: 'Revise a descrição geral.',
        severity: 'blocking',
      },
    ]
    const { user } = render(
      <ModerationCorrections
        issues={issues}
        notes="Faltam dados de contato confiáveis."
        onCorrect={onCorrect}
      />
    )

    const panel = screen.getByRole('region', { name: 'Correções pedidas pela moderação' })
    expect(within(panel).getByText(/Faltam dados de contato confiáveis/)).toBeVisible()
    expect(within(panel).getByText('O telefone não atende.')).toBeVisible()
    expect(within(panel).getByText('Revise a descrição geral.')).toBeVisible()

    await user.click(within(panel).getByRole('button', { name: /^Corrigir: Telefone/ }))
    expect(onCorrect).toHaveBeenCalledWith(issues[0])
    expect(within(panel).getAllByRole('button', { name: /^Corrigir/ })).toHaveLength(2)
  })

  it('asks for every correction to be fixed when the moderator left no summary', () => {
    render(
      <ModerationCorrections
        issues={[
          {
            code: 'x',
            field: 'description',
            message: 'Descreva o cardápio.',
            severity: 'blocking',
          },
        ]}
        notes={null}
        onCorrect={() => undefined}
      />
    )

    expect(screen.getByText('Corrija cada item e reenvie para análise.')).toBeVisible()
  })
})
