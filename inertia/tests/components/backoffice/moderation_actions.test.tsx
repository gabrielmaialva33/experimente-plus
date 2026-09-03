import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'

import { ModerationActions } from '~/components/backoffice/moderation_actions'
import { render } from '~/tests/test_utils'

const { mockPost, mockErrors, mockPermissions } = vi.hoisted(() => ({
  mockPost: vi.fn(),
  mockErrors: { current: {} as Record<string, string> },
  mockPermissions: {
    current: ['establishments.approve', 'establishments.request_changes', 'establishments.reject'],
  },
}))

vi.mock('~/hooks/use_auth', () => ({
  useAuth: () => ({
    can: (permission: string) => mockPermissions.current.includes(permission),
  }),
}))

// Stateful useForm mock: controlled inputs update, `transform` is applied on
// post (so the request-changes payload assertions cover the real contract)
// and `errors` is injectable per test.
vi.mock('@inertiajs/react', async () => {
  const React = await import('react')
  return {
    useForm: <T extends Record<string, unknown>>(initial: T) => {
      const [data, setData] = React.useState<T>(initial)
      const dataRef = React.useRef(data)
      dataRef.current = data
      const transformRef = React.useRef<(input: T) => unknown>((input) => input)

      return {
        data,
        setData: (key: keyof T, value: unknown) =>
          setData((previous) => ({ ...previous, [key]: value })),
        transform: (callback: (input: T) => unknown) => {
          transformRef.current = callback
        },
        post: (url: string, options?: Record<string, unknown>) =>
          mockPost(url, transformRef.current(dataRef.current), options),
        processing: false,
        errors: mockErrors.current,
        recentlySuccessful: false,
      }
    },
  }
})

function renderActions(overrides: Partial<Parameters<typeof ModerationActions>[0]> = {}) {
  return render(
    <ModerationActions
      revisionId={7}
      blockingIssueCount={0}
      moderationError={null}
      {...overrides}
    />
  )
}

describe('ModerationActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockErrors.current = {}
    mockPermissions.current = [
      'establishments.approve',
      'establishments.request_changes',
      'establishments.reject',
    ]
  })

  it('announces a publication failure in an accessible destructive alert', () => {
    renderActions({ moderationError: 'A cidade da revisão foi desativada.' })

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('A ação de moderação não pôde ser concluída')
    expect(alert).toHaveTextContent('A cidade da revisão foi desativada.')
  })

  it('renders no alert when there is no moderation error', () => {
    renderActions()

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('disables approval while the gate reports blocking issues', () => {
    renderActions({ blockingIssueCount: 2 })

    const approveButton = screen.getByRole('button', { name: 'Aprovar revisão' })
    expect(approveButton).toBeDisabled()
    expect(approveButton).toHaveAttribute(
      'title',
      'Resolva as pendências que bloqueiam a publicação antes de aprovar.'
    )
  })

  it('shows only moderation actions allowed by the current capabilities', () => {
    mockPermissions.current = ['establishments.request_changes']

    renderActions()

    expect(screen.getByRole('button', { name: 'Enviar correções' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aprovar revisão' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Rejeitar revisão' })).not.toBeInTheDocument()
  })

  it('requires explicit confirmation for the terminal rejection and does nothing on cancel', async () => {
    const { user } = renderActions()

    await user.type(screen.getByLabelText(/Motivo da rejeição/), 'Conteúdo incompatível.')
    await user.click(screen.getByRole('button', { name: 'Rejeitar revisão' }))

    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toHaveTextContent('Rejeitar definitivamente esta revisão?')
    expect(mockPost).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    expect(mockPost).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Rejeitar revisão' }))
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Rejeitar revisão' })
    )

    expect(mockPost).toHaveBeenCalledTimes(1)
    expect(mockPost).toHaveBeenCalledWith(
      '/backoffice/moderation/7/reject',
      { reason: 'Conteúdo incompatível.' },
      expect.objectContaining({ preserveScroll: true })
    )
  })

  it('locks every action while a transition is in flight', async () => {
    const { user } = renderActions()

    await user.type(screen.getByLabelText(/Motivo da rejeição/), 'Conteúdo incompatível.')
    await user.click(screen.getByRole('button', { name: 'Rejeitar revisão' }))
    const dialog = screen.getByRole('alertdialog')
    const confirmButton = within(dialog).getByRole('button', { name: /Rejeitar revisão/ })
    await user.click(confirmButton)

    expect(mockPost).toHaveBeenCalledTimes(1)

    // The mock never resolves the visit, so the shared lock stays engaged.
    // The dialog stays open (modal), so the page behind it is queried with
    // `hidden: true`.
    expect(screen.getByRole('button', { name: 'Aprovar revisão', hidden: true })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Enviar correções', hidden: true })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Rejeitando…', hidden: true })).toBeDisabled()

    // Confirming again must not fire a duplicate transition.
    expect(confirmButton).toBeDisabled()
    await user.click(confirmButton)
    expect(mockPost).toHaveBeenCalledTimes(1)
  })

  it('posts the approval once even on a double click', async () => {
    const { user } = renderActions()

    const approveButton = screen.getByRole('button', { name: 'Aprovar revisão' })
    await user.dblClick(approveButton)

    expect(mockPost).toHaveBeenCalledTimes(1)
    expect(mockPost).toHaveBeenCalledWith(
      '/backoffice/moderation/7/approve',
      { reason: '' },
      expect.objectContaining({ preserveScroll: true })
    )
  })

  it('confirms before sending corrections and posts the structured issues with the fixed code', async () => {
    const { user } = renderActions()

    await user.type(screen.getByLabelText(/Resumo da decisão/), 'Ajustar os horários.')
    await user.selectOptions(screen.getByLabelText(/Onde corrigir/), 'hours')
    await user.type(
      screen.getByLabelText(/Correção necessária/),
      'Informe o horário de fechamento.'
    )
    await user.selectOptions(screen.getByLabelText(/Severidade/), 'warning')
    await user.click(screen.getByRole('button', { name: 'Enviar correções' }))

    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toHaveTextContent('Enviar correções ao parceiro?')
    expect(mockPost).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: 'Enviar correções' }))

    expect(mockPost).toHaveBeenCalledTimes(1)
    expect(mockPost).toHaveBeenCalledWith(
      '/backoffice/moderation/7/request-changes',
      {
        reason: 'Ajustar os horários.',
        issues: [
          {
            code: 'content_adjustment',
            field: 'hours',
            message: 'Informe o horário de fechamento.',
            severity: 'warning',
          },
        ],
      },
      expect.objectContaining({ preserveScroll: true })
    )
  })

  it('offers only known editor sections and fields instead of free text', () => {
    renderActions()

    const fieldSelect = screen.getByLabelText(/Onde corrigir/)
    const options = within(fieldSelect).getAllByRole('option')
    const values = options.map((option) => (option as HTMLOptionElement).value)

    expect(values).toContain('revision')
    expect(values).toContain('public_name')
    expect(values).toContain('hours')
    expect(values).toContain('media')
    expect(screen.queryByPlaceholderText('campo')).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('code')).not.toBeInTheDocument()
  })

  it('renders the validation errors of the structured issues accessibly', () => {
    mockErrors.current = {
      'issues.0.field': 'Informe um campo válido.',
      'issues.0.message': 'Descreva a correção.',
    }

    renderActions()

    const alerts = screen.getAllByRole('alert')
    expect(alerts.some((alert) => alert.textContent === 'Informe um campo válido.')).toBe(true)
    expect(alerts.some((alert) => alert.textContent === 'Descreva a correção.')).toBe(true)
    expect(screen.getByLabelText(/Onde corrigir/)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText(/Correção necessária/)).toHaveAttribute('aria-invalid', 'true')
  })
})
