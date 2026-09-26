import type { ReactNode } from 'react'

import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import BackofficeConcierge from '~/pages/backoffice/concierge'
import BackofficeGeography from '~/pages/backoffice/geography'
import BackofficeReviewPolicy from '~/pages/backoffice/review_policy'
import BackofficeTaxonomy from '~/pages/backoffice/taxonomy'
import { render } from '~/tests/test_utils'

const mocks = vi.hoisted(() => ({
  permissions: [] as string[],
  put: vi.fn(),
  formPost: vi.fn(),
  formPut: vi.fn(),
  transform: vi.fn(),
}))

vi.mock('~/hooks/use_auth', () => ({
  useAuth: () => ({ can: (permission: string) => mocks.permissions.includes(permission) }),
}))

vi.mock('@inertiajs/react', async () => {
  const React = await import('react')
  return {
    Head: () => null,
    router: { put: mocks.put },
    useForm: <T extends Record<string, unknown>>(initial: T) => {
      const [data, setData] = React.useState<T>(initial)
      return {
        data,
        setData: (key: keyof T, value: unknown) =>
          setData((previous) => ({ ...previous, [key]: value })),
        transform: (fn: (data: T) => unknown) => mocks.transform(fn(data)),
        post: mocks.formPost,
        put: mocks.formPut,
        reset: vi.fn(),
        processing: false,
        errors: {},
      }
    },
  }
})

vi.mock('~/layouts/main_layout', () => ({
  MainLayout: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))

const families = [
  { id: 1, name: 'Comer & Beber', slug: 'comer-e-beber', is_active: true, sort_order: 0 },
]
const categories = [
  {
    id: 10,
    family_id: 1,
    parent_id: null,
    name: 'Cafeterias',
    slug: 'cafeterias',
    is_active: true,
    allows_always_open: false,
    sort_order: 0,
  },
  {
    id: 11,
    family_id: 1,
    parent_id: 10,
    name: 'Torrefações',
    slug: 'torrefacoes',
    is_active: false,
    allows_always_open: false,
    sort_order: 1,
  },
]

describe('backoffice administration screens', () => {
  beforeEach(() => {
    mocks.permissions = []
    mocks.put.mockReset()
    mocks.formPost.mockReset()
    mocks.formPut.mockReset()
    mocks.transform.mockReset()
  })

  it('lists taxonomy with its state and never offers to delete', () => {
    mocks.permissions = ['categories.update', 'category_families.update']
    render(<BackofficeTaxonomy families={families} categories={categories} />)

    expect(screen.getByTestId('categories-row-11')).toHaveTextContent('Inativo')
    expect(screen.getByTestId('categories-row-11')).toHaveTextContent('dentro de Cafeterias')
    expect(screen.queryByRole('button', { name: /excluir/i })).not.toBeInTheDocument()
  })

  it('deactivates a category through its update route', () => {
    mocks.permissions = ['categories.update']
    render(<BackofficeTaxonomy families={families} categories={categories} />)

    fireEvent.click(screen.getByRole('button', { name: 'Desativar Cafeterias' }))

    expect(mocks.put).toHaveBeenCalledWith(
      '/backoffice/taxonomy/categories/10',
      { is_active: false },
      { preserveScroll: true }
    )
  })

  it('hides every write for someone who can only read', () => {
    render(<BackofficeTaxonomy families={families} categories={categories} />)

    expect(screen.queryByRole('button', { name: /Nova família/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Editar/ })).not.toBeInTheDocument()
  })

  it('creates a category in the first family by default, with a numeric family id', () => {
    mocks.permissions = ['categories.create']
    render(<BackofficeTaxonomy families={families} categories={categories} />)

    fireEvent.click(screen.getByRole('button', { name: 'Nova categoria' }))
    fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: 'Padarias' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Nova categoria' }))

    expect(mocks.transform).toHaveBeenCalledWith(
      expect.objectContaining({ family_id: 1, name: 'Padarias', allows_always_open: false })
    )
    expect(mocks.formPost).toHaveBeenCalledWith(
      '/backoffice/taxonomy/categories',
      expect.objectContaining({ preserveScroll: true })
    )
  })

  it('edits a city in place through its own route', () => {
    mocks.permissions = ['cities.update']
    render(
      <BackofficeGeography
        regions={[{ id: 3, name: 'Norte do Paraná', slug: 'norte', is_active: true }]}
        cities={[
          {
            id: 9,
            region_id: 3,
            name: 'Londrina',
            slug: 'londrina',
            state_code: 'PR',
            timezone: 'America/Sao_Paulo',
            is_active: true,
          },
        ]}
      />
    )

    expect(screen.getByTestId('cities-row-9')).toHaveTextContent('Norte do Paraná')
    fireEvent.click(screen.getByRole('button', { name: 'Editar Londrina · PR' }))
    fireEvent.submit(screen.getByRole('form', { name: 'Salvar alterações' }))

    expect(mocks.formPut).toHaveBeenCalledWith(
      '/backoffice/geography/cities/9',
      expect.objectContaining({ preserveScroll: true })
    )
  })

  it('says the review rules are provisional, pending the contracting party', () => {
    mocks.permissions = ['settings.update']
    render(
      <BackofficeReviewPolicy
        policy={{
          require_visit_proof: false,
          min_text_length: 0,
          max_text_length: 1000,
          max_photos: 4,
          max_videos: 0,
          daily_limit_per_user: 5,
          min_edit_interval_minutes: 60,
          edit_window_days: 30,
          report_moderation_days: 5,
        }}
        moderation_rules={{
          link_mode: 'flag',
          contact_mode: 'hold',
          payment_data_mode: 'hold',
          blocked_term_mode: 'hold',
          blocked_terms_text: '',
        }}
      />
    )

    expect(screen.getByRole('note')).toHaveTextContent('Valores provisórios')
    expect(screen.getByRole('note')).toHaveTextContent('Anexo I, item 15')
    expect(screen.getByText('5 dias')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Fotos por avaliação'), { target: { value: '2' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Salvar regras' }))

    expect(mocks.transform).toHaveBeenCalledWith(expect.objectContaining({ max_photos: 2 }))
    expect(mocks.formPut).toHaveBeenCalledWith(
      '/backoffice/review-policy',
      expect.objectContaining({ preserveScroll: true })
    )
  })

  it('shows the review rules read-only to someone who cannot change them', () => {
    render(
      <BackofficeReviewPolicy
        policy={{ report_moderation_days: 5 }}
        moderation_rules={{ link_mode: 'flag', blocked_terms_text: '' }}
      />
    )

    expect(screen.queryByRole('form')).not.toBeInTheDocument()
    // Both sections say so: the review rules and the automatic moderation rules.
    expect(screen.getAllByText(/pode consultar, mas não alterar/)).toHaveLength(2)
  })

  it('edits the automatic moderation rules on the same screen, one term per line', () => {
    mocks.permissions = ['settings.update']
    render(
      <BackofficeReviewPolicy
        policy={{ report_moderation_days: 5 }}
        moderation_rules={{
          link_mode: 'flag',
          contact_mode: 'hold',
          payment_data_mode: 'hold',
          blocked_term_mode: 'off',
          blocked_terms_text: 'golpe',
        }}
      />
    )

    expect(screen.getByRole('heading', { name: 'Moderação automática' })).toBeInTheDocument()
    expect(screen.getByText(/Nenhuma regra apaga nada/)).toBeInTheDocument()
    expect((screen.getByLabelText('Dados de contato') as HTMLSelectElement).value).toBe('hold')

    fireEvent.change(screen.getByLabelText('Termos bloqueados'), { target: { value: 'hold' } })
    fireEvent.change(screen.getByLabelText('Lista de termos bloqueados'), {
      target: { value: 'golpe\npirâmide' },
    })
    fireEvent.submit(screen.getByRole('form', { name: 'Salvar regras de moderação' }))

    expect(mocks.transform).toHaveBeenCalledWith(
      expect.objectContaining({ blocked_term_mode: 'hold', blocked_terms_text: 'golpe\npirâmide' })
    )
    expect(mocks.formPut).toHaveBeenCalledWith(
      '/backoffice/moderation-rules',
      expect.objectContaining({ preserveScroll: true })
    )
  })
  it('edits the Concierge parameters and says they are provisional', () => {
    mocks.permissions = ['settings.update']
    render(
      <BackofficeConcierge
        policy={{ enabled: true, max_catalog_items: 20, daily_questions_per_person: 20 }}
        infrastructure={{
          globally_enabled: true,
          provider_configured: true,
          primary_model: 'nvidia/nemotron-3-super-120b-a12b',
          fallback_model: null,
        }}
      />
    )

    expect(screen.getByRole('note')).toHaveTextContent('Valores provisórios')
    expect(screen.getByRole('note')).toHaveTextContent('Anexo I, item 15')
    expect(
      (screen.getByLabelText('Concierge ativo nesta operação') as HTMLInputElement).checked
    ).toBe(true)

    fireEvent.click(screen.getByLabelText('Concierge ativo nesta operação'))
    fireEvent.change(screen.getByLabelText('Perguntas por pessoa por dia'), {
      target: { value: '5' },
    })
    fireEvent.submit(screen.getByRole('form', { name: 'Salvar configuração' }))

    expect(mocks.transform).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false, daily_questions_per_person: 5 })
    )
    expect(mocks.formPut).toHaveBeenCalledWith(
      '/backoffice/concierge',
      expect.objectContaining({ preserveScroll: true })
    )
  })

  it('shows the infrastructure read-only, and never a key', () => {
    mocks.permissions = ['settings.update']
    render(
      <BackofficeConcierge
        policy={{ enabled: true, max_catalog_items: 20, daily_questions_per_person: 20 }}
        infrastructure={{
          globally_enabled: false,
          provider_configured: false,
          primary_model: 'nvidia/nemotron-3-super-120b-a12b',
          fallback_model: null,
        }}
      />
    )

    const infrastructure = screen
      .getByRole('heading', { name: 'Infraestrutura' })
      .closest('section')!
    expect(infrastructure).toHaveTextContent('Desligado')
    expect(infrastructure).toHaveTextContent('Não configurado')
    expect(infrastructure).toHaveTextContent('nvidia/nemotron-3-super-120b-a12b')
    expect(infrastructure).toHaveTextContent('Não definido')
    expect(infrastructure.querySelector('input, select, textarea')).toBeNull()
  })

  it('shows the Concierge parameters read-only to someone who cannot change them', () => {
    render(
      <BackofficeConcierge
        policy={{ enabled: true, max_catalog_items: 20, daily_questions_per_person: 20 }}
        infrastructure={{ globally_enabled: true, provider_configured: true }}
      />
    )

    expect(screen.queryByRole('form')).not.toBeInTheDocument()
    expect(screen.getByText(/pode consultar, mas não alterar/)).toBeInTheDocument()
  })
})
