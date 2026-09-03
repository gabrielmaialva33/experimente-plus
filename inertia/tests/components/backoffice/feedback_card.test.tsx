import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

import { FeedbackCard } from '~/components/backoffice/feedback_card'
import { render } from '~/tests/test_utils'

const { mockPatch, formState, mockPermissions } = vi.hoisted(() => ({
  mockPatch: vi.fn(),
  mockPermissions: { current: ['pilot_feedback.update'] },
  formState: {
    current: {
      processing: false,
      recentlySuccessful: false,
      errors: {} as Record<string, string>,
    },
  },
}))

vi.mock('~/hooks/use_auth', () => ({
  useAuth: () => ({
    can: (permission: string) => mockPermissions.current.includes(permission),
  }),
}))

vi.mock('@inertiajs/react', async () => {
  const React = await import('react')
  return {
    useForm: <T extends Record<string, unknown>>(initial: T) => {
      const [data, setData] = React.useState<T>(initial)

      return {
        data,
        setData: (key: keyof T, value: unknown) =>
          setData((previous) => ({ ...previous, [key]: value })),
        patch: mockPatch,
        processing: formState.current.processing,
        recentlySuccessful: formState.current.recentlySuccessful,
        errors: formState.current.errors,
      }
    },
  }
})

const item = {
  id: 3,
  status: 'in_review',
  context: 'catalog',
  rating: 4,
  message: 'O mapa da unidade ficou claro durante o piloto.',
  internal_notes: '',
  created_at: '2026-08-20T10:30:00.000-03:00',
  author: { full_name: 'Ana Prado' },
  organization: { trade_name: 'Café Central' },
}

describe('FeedbackCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    formState.current = { processing: false, recentlySuccessful: false, errors: {} }
    mockPermissions.current = ['pilot_feedback.update']
  })

  it('shows the report date, translated context and translated status', () => {
    render(<FeedbackCard item={item} />)

    expect(screen.getByText(/Relatado em 20\/08\/2026/)).toBeInTheDocument()
    expect(screen.getByText('Catálogo')).toBeInTheDocument()
    // 'Em análise' also exists as a select option, so scope to the badge.
    expect(screen.getAllByText('Em análise').some((element) => element.tagName === 'SPAN')).toBe(
      true
    )
  })

  it('submits the triage update with scroll preserved', async () => {
    const { user } = render(<FeedbackCard item={item} />)

    await user.selectOptions(screen.getByLabelText('Status'), 'resolved')
    await user.click(screen.getByRole('button', { name: 'Atualizar' }))

    expect(mockPatch).toHaveBeenCalledTimes(1)
    expect(mockPatch).toHaveBeenCalledWith('/backoffice/feedback/3', { preserveScroll: true })
  })

  it('announces the local success confirmation inside the card', () => {
    formState.current.recentlySuccessful = true

    render(<FeedbackCard item={item} />)

    expect(screen.getByRole('status')).toHaveTextContent('Triagem atualizada.')
  })

  it('stays quiet before any successful update', () => {
    render(<FeedbackCard item={item} />)

    expect(screen.getByRole('status')).toHaveTextContent('')
  })

  it('renders status and internal notes errors accessibly', () => {
    formState.current.errors = {
      status: 'Escolha um status de triagem.',
      internal_notes: 'A nota interna é muito longa.',
    }

    render(<FeedbackCard item={item} />)

    const alerts = screen.getAllByRole('alert')
    expect(alerts.some((alert) => alert.textContent === 'Escolha um status de triagem.')).toBe(true)
    expect(alerts.some((alert) => alert.textContent === 'A nota interna é muito longa.')).toBe(true)
    expect(screen.getByLabelText('Status')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Nota interna')).toHaveAttribute('aria-invalid', 'true')
  })

  it('blocks duplicate updates while an update is processing', () => {
    formState.current.processing = true

    render(<FeedbackCard item={item} />)

    const submitButton = screen.getByRole('button', { name: 'Salvando…' })
    expect(submitButton).toBeDisabled()

    fireEvent.submit(submitButton.closest('form') as HTMLFormElement)
    expect(mockPatch).not.toHaveBeenCalled()
  })

  it('keeps the report readable without rendering triage controls when update is not allowed', () => {
    mockPermissions.current = []

    render(<FeedbackCard item={item} />)

    expect(screen.getByText(item.message)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Atualizar' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Status')).not.toBeInTheDocument()
  })
})
