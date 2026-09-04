import { MapPin, Store } from 'lucide-react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  EstablishmentEditorNavigation,
  type EditorNavigationItem,
} from '~/components/portal/establishment_editor_navigation'
import { render, screen } from '~/tests/test_utils'

const items: EditorNavigationItem[] = [
  { id: 'identity', label: 'Identidade', icon: Store, issueCount: 0 },
  { id: 'address', label: 'Endereço', icon: MapPin, issueCount: 2 },
]

const baseProps = {
  items,
  score: 80,
  eligible: true,
  submitAllowed: true,
  submitting: false,
  busy: false,
  unsavedSectionCount: 0,
  onSubmit: vi.fn(),
  submitLabel: 'Enviar para moderação',
  statusLabel: 'A ficha está aberta para edição.',
  lockedLabel: 'Em moderação',
}

describe('EstablishmentEditorNavigation', () => {
  const scrollIntoView = vi.fn()

  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    })
  })

  afterEach(() => {
    scrollIntoView.mockReset()
    vi.clearAllMocks()
  })

  it('exposes section relationships and keeps the active mobile step visible', async () => {
    const onNavigate = vi.fn()
    const { user } = render(
      <EstablishmentEditorNavigation
        {...baseProps}
        variant="mobile"
        activeSection="address"
        onNavigate={onNavigate}
      />
    )

    const addressButton = screen.getByRole('button', {
      name: 'Endereço: 2 pendências',
    })
    expect(addressButton).toHaveAttribute('aria-current', 'step')
    expect(addressButton).toHaveAttribute('aria-controls', 'address')
    expect(scrollIntoView).toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Identidade: etapa concluída' }))
    expect(onNavigate).toHaveBeenCalledWith('identity')
  })

  it('blocks moderation submission while local sections are unsaved', () => {
    const { container } = render(
      <EstablishmentEditorNavigation
        {...baseProps}
        variant="desktop"
        activeSection="identity"
        onNavigate={() => undefined}
        unsavedSectionCount={2}
      />
    )

    expect(screen.getByText('2 etapas não salvas')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /salve antes de enviar/i })).toBeDisabled()
    expect(screen.getByText(/salve 2 etapas pendentes/i)).toBeInTheDocument()
    expect(container.querySelector('[data-slot="progress-circle"]')).toHaveClass('shrink-0')
  })

  it('keeps submission disabled when the server projects an identity blocker', () => {
    render(
      <EstablishmentEditorNavigation
        {...baseProps}
        items={[
          { ...items[0], issueCount: 1 },
          { ...items[1], issueCount: 0 },
        ]}
        score={99}
        eligible={false}
        variant="desktop"
        activeSection="identity"
        onNavigate={() => undefined}
      />
    )

    expect(screen.getByRole('button', { name: 'Identidade: 1 pendência' })).toBeInTheDocument()
    expect(screen.getByText('1 ajuste necessário')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar para moderação' })).toBeDisabled()
  })

  it('does not render a submission action when the server does not allow it', () => {
    render(
      <EstablishmentEditorNavigation
        {...baseProps}
        variant="desktop"
        activeSection="identity"
        onNavigate={() => undefined}
        submitAllowed={false}
      />
    )

    expect(screen.getByRole('status')).toHaveTextContent('Em moderação')
    expect(screen.queryByRole('button', { name: /em moderação/i })).not.toBeInTheDocument()
  })

  it('keeps an in-flight submission visible if permissions refresh during the request', () => {
    render(
      <EstablishmentEditorNavigation
        {...baseProps}
        variant="desktop"
        activeSection="identity"
        onNavigate={() => undefined}
        submitAllowed={false}
        submitting
      />
    )

    expect(screen.getByRole('button', { name: /enviando/i })).toBeDisabled()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
