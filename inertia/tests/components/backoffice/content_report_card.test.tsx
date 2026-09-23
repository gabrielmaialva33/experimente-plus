import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

import { ContentReportCard } from '~/components/backoffice/content_report_card'
import { render } from '~/tests/test_utils'
import type { JsonRecord } from '~/lib/json'

const { mockPost, mockTransform, formState, mockPermissions } = vi.hoisted(() => ({
  mockPost: vi.fn(),
  mockTransform: vi.fn(),
  mockPermissions: { current: ['establishments.update'] },
  formState: {
    current: { processing: false, errors: {} as Record<string, string> },
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
    Link: ({ children, href }: { children: React.ReactNode; href: string }) =>
      React.createElement('a', { href }, children),
    useForm: <T extends Record<string, unknown>>(initial: T) => {
      const [data, setData] = React.useState<T>(initial)

      return {
        data,
        setData: (key: keyof T, value: unknown) =>
          setData((previous) => ({ ...previous, [key]: value })),
        transform: mockTransform,
        post: mockPost,
        processing: formState.current.processing,
        errors: formState.current.errors,
      }
    },
  }
})

const hourAgo = new Date(Date.now() - 3_600_000).toISOString()
const tomorrow = new Date(Date.now() + 86_400_000).toISOString()

function reviewReport(overrides: JsonRecord = {}): JsonRecord {
  return {
    id: 12,
    protocol_number: 'DEN-20260923-AAAA1111',
    status: 'pending',
    reason: 'offensive',
    target_type: 'review',
    details: 'O texto ofende a equipe.',
    is_anonymous: false,
    created_at: hourAgo,
    due_at: tomorrow,
    resolved_at: null,
    resolution_action: null,
    resolution_notes: null,
    reporter: { id: 5, full_name: 'Marta Denunciante' },
    resolver: null,
    target: {
      type: 'review',
      id: 90,
      exists: true,
      text: 'Comida horrível e atendimento pior ainda.',
      rating: 1,
      status: 'published',
      author_name: 'Bruno Avaliador',
      author_id: 44,
      author_banned: false,
      establishment_name: 'Ateliê do Café',
      city_slug: 'londrina',
      establishment_slug: 'atelie-do-cafe',
      created_at: hourAgo,
      can_hide: true,
    },
    ...overrides,
  }
}

describe('ContentReportCard', () => {
  beforeEach(() => {
    mockPost.mockReset()
    mockTransform.mockReset()
    mockPermissions.current = ['establishments.update']
    formState.current = { processing: false, errors: {} }
  })

  it('shows the reported text and who wrote it, not only the protocol', () => {
    render(<ContentReportCard report={reviewReport()} />)

    expect(screen.getByText('DEN-20260923-AAAA1111')).toBeInTheDocument()
    expect(screen.getByText('Comida horrível e atendimento pior ainda.')).toBeInTheDocument()
    expect(screen.getByText(/Bruno Avaliador/)).toBeInTheDocument()
    expect(screen.getByText(/Ateliê do Café/)).toBeInTheDocument()
    expect(screen.getByLabelText('1 de 5')).toBeInTheDocument()
  })

  it('links the target through the city and establishment slugs', () => {
    render(<ContentReportCard report={reviewReport()} />)

    expect(screen.getByRole('link', { name: /página pública/i })).toHaveAttribute(
      'href',
      '/cidades/londrina/estabelecimentos/atelie-do-cafe'
    )
  })

  it('never offers to hide a target the server cannot hide', () => {
    const report = reviewReport({
      target_type: 'establishment',
      target: {
        type: 'establishment',
        id: 3,
        exists: true,
        text: 'Cafeteria no centro.',
        rating: null,
        status: 'active',
        author_name: null,
        establishment_name: 'Ateliê do Café',
        city_slug: 'londrina',
        establishment_slug: 'atelie-do-cafe',
        created_at: hourAgo,
        can_hide: false,
      },
    })

    render(<ContentReportCard report={report} />)

    const outcome = screen.getByLabelText('Desfecho') as HTMLSelectElement
    const values = [...outcome.options].map((option) => option.value)
    expect(values).not.toContain('content_hidden')
    expect(values).toContain('no_violation')
  })

  it('will not let a case be dismissed and hidden by the same decision', () => {
    render(<ContentReportCard report={reviewReport()} />)

    fireEvent.change(screen.getByLabelText('Desfecho'), { target: { value: 'content_hidden' } })
    expect(screen.getByRole('button', { name: 'Descartar' })).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Desfecho'), { target: { value: 'no_violation' } })
    expect(screen.getByRole('button', { name: 'Descartar' })).toBeEnabled()
  })

  it('marks a pending case whose deadline has passed', () => {
    render(<ContentReportCard report={reviewReport({ due_at: hourAgo })} />)

    expect(screen.getByText('Prazo vencido')).toBeInTheDocument()
  })

  it('does not mark a decided case as overdue', () => {
    const report = reviewReport({
      due_at: hourAgo,
      status: 'resolved',
      resolution_action: 'content_hidden',
      resolved_at: hourAgo,
      resolver: { id: 9, full_name: 'Moderadora' },
    })

    render(<ContentReportCard report={report} />)

    expect(screen.queryByText('Prazo vencido')).not.toBeInTheDocument()
    expect(screen.getByText(/Moderadora/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Desfecho')).not.toBeInTheDocument()
  })

  it('shows an anonymous report without inventing a name', () => {
    const report = reviewReport({ is_anonymous: true, reporter: null })

    render(<ContentReportCard report={report} />)

    expect(screen.getByText('Denúncia anônima')).toBeInTheDocument()
    expect(screen.queryByText('Marta Denunciante')).not.toBeInTheDocument()
  })

  it('keeps a case open after its content was deleted', () => {
    const report = reviewReport({
      target: {
        type: 'review',
        id: 90,
        exists: false,
        text: null,
        rating: null,
        status: null,
        author_name: null,
        establishment_name: null,
        city_slug: null,
        establishment_slug: null,
        created_at: null,
        can_hide: false,
      },
    })

    render(<ContentReportCard report={report} />)

    expect(screen.getByText('DEN-20260923-AAAA1111')).toBeInTheDocument()
    expect(screen.getByText(/não existe mais/i)).toBeInTheDocument()
  })

  it('sends the decision with the status the button stands for', () => {
    render(<ContentReportCard report={reviewReport()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Resolver' }))

    expect(mockTransform).toHaveBeenCalled()
    const transform = mockTransform.mock.calls[0][0] as (data: JsonRecord) => JsonRecord
    expect(transform({ resolution_action: 'content_hidden' }).status).toBe('resolved')
    expect(mockPost).toHaveBeenCalledWith('/backoffice/reports/12/resolve', {
      preserveScroll: true,
    })
  })

  it('tells a reader without the permission that the decision is not theirs', () => {
    mockPermissions.current = []

    render(<ContentReportCard report={reviewReport()} />)

    expect(screen.queryByRole('button', { name: 'Resolver' })).not.toBeInTheDocument()
    expect(screen.getByText(/não tem permissão/i)).toBeInTheDocument()
  })

  it('states what a ban reaches before it can be confirmed', () => {
    render(<ContentReportCard report={reviewReport()} />)

    fireEvent.click(screen.getByRole('button', { name: /Banir autor/ }))

    expect(screen.getByText(/Todas as avaliações de/)).toBeInTheDocument()
    expect(screen.getByText(/Nada é apagado/)).toBeInTheDocument()
    const confirm = screen.getByRole('button', { name: 'Confirmar banimento' })
    expect(confirm).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Motivo do banimento'), {
      target: { value: 'Ofensas repetidas' },
    })
    expect(confirm).toBeEnabled()

    fireEvent.click(confirm)
    expect(mockPost).toHaveBeenCalledWith(
      '/backoffice/users/44/ban',
      expect.objectContaining({ preserveScroll: true })
    )
  })

  it('shows a banned author and offers to lift the ban', () => {
    const report = reviewReport()
    ;(report.target as JsonRecord).author_banned = true

    render(<ContentReportCard report={report} />)

    expect(screen.getByText('Autor banido nesta operação')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retirar banimento' }))
    expect(mockPost).toHaveBeenCalledWith('/backoffice/users/44/unban', { preserveScroll: true })
  })

  it('does not offer a ban on a partner reply, where it would hide nothing', () => {
    const report = reviewReport({
      target_type: 'reply',
      target: {
        type: 'reply',
        id: 3,
        exists: true,
        text: 'Obrigado pela visita.',
        rating: null,
        status: 'published',
        author_name: 'Equipe do Café',
        author_id: null,
        author_banned: false,
        establishment_name: 'Ateliê do Café',
        city_slug: 'londrina',
        establishment_slug: 'atelie-do-cafe',
        created_at: hourAgo,
        can_hide: true,
      },
    })

    render(<ContentReportCard report={report} />)

    expect(screen.queryByRole('button', { name: /Banir autor/ })).not.toBeInTheDocument()
  })

  it('shows the photos of a reported review, since a report about an image is judged by looking', () => {
    const report = reviewReport()
    ;(report.target as JsonRecord).photos = [
      { id: 5, url: 'https://example.test/foto.jpg', width: 800, height: 600, alt_text: 'Prato' },
    ]

    render(<ContentReportCard report={report} />)

    const image = screen.getByAltText('Prato') as HTMLImageElement
    expect(image.src).toBe('https://example.test/foto.jpg')
  })
})
