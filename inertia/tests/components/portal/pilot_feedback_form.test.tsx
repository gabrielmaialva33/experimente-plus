import { act, fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import PilotFeedbackForm from '~/components/portal/pilot_feedback_form'
import { render } from '~/tests/test_utils'

const { mockPost, formState } = vi.hoisted(() => ({
  mockPost: vi.fn(),
  formState: {
    current: {
      processing: false,
      errors: {} as Record<string, string>,
    },
  },
}))

vi.mock('@inertiajs/react', async () => {
  const React = await import('react')

  return {
    useForm: <T extends Record<string, unknown>>(initial: T) => {
      const [data, setDataState] = React.useState(initial)

      return {
        data,
        setData: (fieldOrUpdater: keyof T | ((current: T) => T), value?: T[keyof T]) => {
          if (typeof fieldOrUpdater === 'function') {
            setDataState((current) => fieldOrUpdater(current))
            return
          }

          setDataState((current) => ({ ...current, [fieldOrUpdater]: value }))
        },
        post: mockPost,
        processing: formState.current.processing,
        errors: formState.current.errors,
        reset: (...fields: Array<keyof T>) => {
          setDataState((current) => {
            if (fields.length === 0) return initial

            const next = { ...current }
            for (const field of fields) next[field] = initial[field]
            return next
          })
        },
      }
    },
  }
})

const targets = {
  organizations: [{ id: 7, label: 'Café Central' }],
  establishments: [{ id: 9, label: 'Café Central — Centro', organization_id: 7 }],
}

describe('PilotFeedbackForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    formState.current = { processing: false, errors: {} }
  })

  it('starts without a preselected rating', () => {
    render(<PilotFeedbackForm targets={targets} context="general" />)

    expect(screen.getByLabelText(/Nota/)).toHaveValue('')
    expect(screen.getByRole('option', { name: 'Selecione uma nota' })).toBeInTheDocument()
  })

  it('renders server errors and associates the message error with the textarea', () => {
    formState.current.errors = {
      general: 'Não foi possível registrar o feedback.',
      message: 'A mensagem precisa ser mais detalhada.',
    }

    render(<PilotFeedbackForm targets={targets} context="onboarding" />)

    expect(screen.getByText('Não foi possível registrar o feedback.')).toBeInTheDocument()
    expect(screen.getByText('A mensagem precisa ser mais detalhada.')).toHaveAttribute(
      'role',
      'alert'
    )
    expect(screen.getByLabelText(/Mensagem/)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Contexto: Onboarding')).toBeInTheDocument()
  })

  it('submits only once, resets the message after success and announces confirmation locally', () => {
    render(<PilotFeedbackForm targets={targets} context="general" />)

    const message = screen.getByLabelText(/Mensagem/)
    fireEvent.change(screen.getByLabelText(/Nota/), { target: { value: '4' } })
    fireEvent.change(message, {
      target: { value: 'O cadastro ficou claro, mas preciso de mais orientação sobre horários.' },
    })

    const submit = screen.getByRole('button', { name: 'Enviar feedback' })
    fireEvent.click(submit)
    fireEvent.click(submit)

    expect(mockPost).toHaveBeenCalledTimes(1)
    expect(mockPost).toHaveBeenCalledWith(
      '/portal/feedback',
      expect.objectContaining({ preserveScroll: true })
    )

    const options = mockPost.mock.calls[0][1] as {
      onSuccess: () => void
      onFinish: () => void
    }

    act(() => {
      options.onSuccess()
      options.onFinish()
    })

    expect(screen.getByRole('status')).toHaveTextContent(
      'Feedback enviado. Obrigado por ajudar a melhorar o piloto.'
    )
    expect(message).toHaveValue('')
  })

  it('disables submission while the Inertia form is processing', () => {
    formState.current.processing = true

    render(<PilotFeedbackForm targets={targets} context="organization" organizationId={7} />)

    expect(screen.getByRole('button', { name: 'Enviando…' })).toBeDisabled()
    expect(screen.getByText('Café Central')).toBeInTheDocument()
  })
})
