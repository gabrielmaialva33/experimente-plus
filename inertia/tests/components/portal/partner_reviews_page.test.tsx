import type { ComponentProps, ReactNode } from 'react'
import { useState } from 'react'

import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import PartnerReviewsPage from '~/pages/portal/reviews/index'
import { render } from '~/tests/test_utils'

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  put: vi.fn(),
  get: vi.fn(),
  errors: {} as Record<string, string>,
}))

vi.mock('@inertiajs/react', () => ({
  Head: () => null,
  Link: ({ href, children, ...props }: ComponentProps<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  // The reply forms' unsaved-changes guard listens to visits.
  router: { get: mocks.get, on: () => () => undefined },
  useForm: <T extends Record<string, string>>(initial: T) => {
    const [data, setState] = useState(initial)
    return {
      data,
      setData: (key: keyof T, value: string) =>
        setState((current) => ({ ...current, [key]: value })),
      post: mocks.post,
      put: mocks.put,
      processing: false,
      errors: mocks.errors,
    }
  },
}))

vi.mock('~/layouts/main_layout', () => ({
  MainLayout: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))

type Props = ComponentProps<typeof PartnerReviewsPage>

const review = (overrides: Partial<Props['reviews'][number]> = {}): Props['reviews'][number] => ({
  id: 31,
  rating: 4,
  comment: 'Porções generosas e ambiente animado.',
  // 02:30 UTC is still the day before in Brasília.
  created_at: '2026-09-26T02:30:00.000Z',
  edited_at: null,
  author_name: 'Ana Ribeiro',
  photos: [],
  reply: null,
  ...overrides,
})

const props = (overrides: Partial<Props> = {}): Props => ({
  places: [{ id: 7, name: 'Casa de Petiscos', unanswered: 1, can_reply: true }],
  selected_place_id: 7,
  filter: 'unanswered',
  counts: { unanswered: 1, answered: 2, all: 3 },
  average: 4.3333,
  reviews: [review()],
  meta: { current_page: 1, last_page: 1, total: 1 },
  ...overrides,
})

beforeEach(() => {
  mocks.post.mockClear()
  mocks.put.mockClear()
  mocks.get.mockClear()
  mocks.errors = {}
})

describe('Partner reviews page', () => {
  it('answers an unanswered review through the portal, saying where it shows and that the rating stays', async () => {
    const { user } = render(<PartnerReviewsPage {...props()} />)

    expect(screen.getByText('Casa de Petiscos · Média 4,3 em 3 avaliações')).toBeVisible()
    expect(screen.getByText('25/09/2026')).toBeVisible()
    expect(screen.getByLabelText('Nota 4 de 5')).toBeVisible()
    const field = screen.getByLabelText('Sua resposta pública')
    expect(
      screen.getByText('Aparece abaixo da avaliação, no app e no site. A nota não muda.')
    ).toBeVisible()

    // Replying is the navy primary action, never the orange conversion colour.
    const publish = screen.getByRole('button', { name: 'Publicar resposta' })
    expect(publish).toHaveClass('bg-primary', 'rounded-full', 'h-12')
    expect(publish).not.toHaveClass('bg-cta')

    await user.type(field, 'Obrigado pela visita!')
    await user.click(publish)

    expect(mocks.post).toHaveBeenCalledWith(
      '/portal/reviews/31/reply',
      expect.objectContaining({ preserveScroll: true })
    )
  })

  it('filters by answer state with counts, keeping the chosen place in every link', () => {
    render(<PartnerReviewsPage {...props()} />)

    const filters = screen.getByRole('navigation', { name: 'Filtrar avaliações' })
    const waiting = within(filters).getByRole('link', { name: 'Sem resposta 1' })
    expect(waiting).toHaveAttribute('aria-current', 'true')
    expect(waiting).toHaveClass('bg-primary', 'text-primary-foreground')
    expect(waiting).toHaveAttribute('href', '/portal/reviews?establishment=7&filter=unanswered')
    expect(within(filters).getByRole('link', { name: 'Respondidas 2' })).toHaveAttribute(
      'href',
      '/portal/reviews?establishment=7&filter=answered'
    )
    expect(within(filters).getByRole('link', { name: 'Todas 3' })).not.toHaveAttribute(
      'aria-current'
    )
    // On a phone the three share the row instead of scrolling the last one out of view.
    expect(filters).toHaveClass('w-full', 'sm:w-auto')
    for (const link of within(filters).getAllByRole('link')) {
      expect(link).toHaveClass('flex-1', 'sm:flex-none')
    }
  })

  it('shows the partner their own reply, held or not, and edits it with PUT', async () => {
    const { user } = render(
      <PartnerReviewsPage
        {...props({
          filter: 'answered',
          reviews: [
            review({
              reply: {
                comment: 'Obrigado pelo retorno sobre a fila.',
                status: 'hidden',
                created_at: '2026-09-26T12:00:00.000Z',
                edited_at: null,
              },
            }),
          ],
        })}
      />
    )

    expect(screen.getByText('Obrigado pelo retorno sobre a fila.')).toBeVisible()
    expect(screen.getByText('Em análise pela moderação')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Editar resposta' }))
    expect(screen.getByLabelText('Editar sua resposta')).toHaveValue(
      'Obrigado pelo retorno sobre a fila.'
    )
    await user.click(screen.getByRole('button', { name: 'Salvar resposta' }))
    expect(mocks.put).toHaveBeenCalledWith('/portal/reviews/31/reply', expect.anything())
    expect(mocks.post).not.toHaveBeenCalled()
  })

  it('offers no reply form where the server projects that the partner cannot answer', () => {
    render(
      <PartnerReviewsPage
        {...props({
          places: [{ id: 7, name: 'Casa de Petiscos', unanswered: 1, can_reply: false }],
        })}
      />
    )

    expect(screen.queryByLabelText('Sua resposta pública')).not.toBeInTheDocument()
    expect(
      screen.getByText(
        'Seu acesso a esta organização permite ver as avaliações, mas não responder.'
      )
    ).toBeVisible()
  })

  it('switches place from a labelled select only when there is more than one', async () => {
    const single = render(<PartnerReviewsPage {...props()} />)
    expect(screen.queryByLabelText('Lugar')).not.toBeInTheDocument()
    single.unmount()

    const { user } = render(
      <PartnerReviewsPage
        {...props({
          places: [
            { id: 7, name: 'Casa de Petiscos', unanswered: 1, can_reply: true },
            { id: 9, name: 'Ateliê do Café', unanswered: 0, can_reply: true },
          ],
        })}
      />
    )

    expect(screen.getByRole('option', { name: 'Casa de Petiscos (1 sem resposta)' })).toBeVisible()
    await user.selectOptions(screen.getByLabelText('Lugar'), '9')
    expect(mocks.get).toHaveBeenCalledWith('/portal/reviews', { establishment: '9' })
  })

  it('says nothing waits instead of showing an empty list, and points to every review', () => {
    render(
      <PartnerReviewsPage
        {...props({ reviews: [], counts: { unanswered: 0, answered: 3, all: 3 } })}
      />
    )

    expect(
      screen.getByRole('heading', { name: 'Nenhuma avaliação esperando resposta' })
    ).toBeVisible()
    expect(screen.getByRole('link', { name: 'Ver todas as avaliações' })).toHaveAttribute(
      'href',
      '/portal/reviews?establishment=7&filter=all'
    )
  })

  it('shows the server validation message next to the field', () => {
    mocks.errors = { comment: 'Escreva a resposta antes de publicar.' }
    render(<PartnerReviewsPage {...props()} />)

    expect(screen.getByRole('alert')).toHaveTextContent('Escreva a resposta antes de publicar.')
    expect(screen.getByLabelText('Sua resposta pública')).toHaveAttribute('aria-invalid', 'true')
  })

  it('explains an operation without published places', () => {
    render(
      <PartnerReviewsPage
        {...props({
          places: [],
          selected_place_id: null,
          reviews: [],
          counts: { unanswered: 0, answered: 0, all: 0 },
          average: null,
        })}
      />
    )

    expect(screen.getByRole('heading', { name: 'Nenhum lugar para acompanhar' })).toBeVisible()
  })
})
