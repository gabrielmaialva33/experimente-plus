import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockPut, putSnapshots } = vi.hoisted(() => ({
  mockPut: vi.fn(),
  putSnapshots: [] as Array<{ url: string; data: unknown }>,
}))

vi.mock('@inertiajs/react', async () => {
  const React = await import('react')

  return {
    useForm: <T extends Record<string, unknown>>(initial: T) => {
      const [data, setDataState] = React.useState(initial)
      const initialRef = React.useRef(initial)
      const isDirty = JSON.stringify(data) !== JSON.stringify(initialRef.current)

      return {
        data,
        isDirty,
        processing: false,
        recentlySuccessful: false,
        errors: {} as Record<string, string>,
        hasErrors: false,
        setData: (field: keyof T, value: T[keyof T]) =>
          setDataState((current) => ({ ...current, [field]: value })),
        setDefaults: vi.fn(),
        reset: () => setDataState(initialRef.current),
        clearErrors: vi.fn(),
        put: (url: string) => {
          putSnapshots.push({ url, data: JSON.parse(JSON.stringify(data)) })
          mockPut(url)
        },
      }
    },
  }
})

import EffectiveAttributesForm, {
  type EffectiveAttribute,
} from '~/components/portal/effective_attributes_form'
import { render, screen } from '~/tests/test_utils'

function attribute(
  overrides: Partial<EffectiveAttribute> &
    Pick<EffectiveAttribute, 'id' | 'key' | 'name' | 'data_type'>
): EffectiveAttribute {
  return {
    description: null,
    unit: null,
    is_required: false,
    source_category_id: 3,
    inherited: false,
    options: [],
    value: null,
    option_ids: [],
    ...overrides,
  }
}

describe('EffectiveAttributesForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    putSnapshots.length = 0
  })

  it('renders every attribute type with the server-resolved metadata and current values', () => {
    render(
      <EffectiveAttributesForm
        establishmentId={7}
        editable
        attributes={[
          attribute({
            id: 1,
            key: 'specialty',
            name: 'Especialidade da casa',
            description: 'Prato ou bebida que define a casa.',
            data_type: 'text',
            is_required: true,
            value: 'Café coado',
          }),
          attribute({
            id: 2,
            key: 'story',
            name: 'História do lugar',
            data_type: 'long_text',
            is_required: true,
            source_category_id: 1,
            inherited: true,
          }),
          attribute({
            id: 3,
            key: 'reservations',
            name: 'Aceita reservas',
            data_type: 'boolean',
            is_required: true,
            source_category_id: 1,
            inherited: true,
            value: true,
          }),
          attribute({
            id: 4,
            key: 'seats',
            name: 'Número de lugares',
            data_type: 'integer',
            unit: 'lugares',
            value: 48,
          }),
          attribute({
            id: 5,
            key: 'average_ticket',
            name: 'Ticket médio',
            data_type: 'decimal',
            unit: 'R$',
            value: 37.5,
          }),
          attribute({
            id: 6,
            key: 'menu_url',
            name: 'Cardápio online',
            data_type: 'url',
            value: 'https://example.com/menu',
          }),
          attribute({
            id: 7,
            key: 'price_level',
            name: 'Faixa de preço',
            data_type: 'single_select',
            options: [
              { id: 71, label: 'Padrão', value: 'standard' },
              { id: 72, label: 'Premium', value: 'premium' },
            ],
            option_ids: [72],
          }),
          attribute({
            id: 8,
            key: 'amenities',
            name: 'Comodidades',
            data_type: 'multi_select',
            options: [
              { id: 81, label: 'Wi-Fi', value: 'wifi' },
              { id: 82, label: 'Acessibilidade', value: 'accessibility' },
            ],
            option_ids: [81],
          }),
        ]}
      />
    )

    const text = screen.getByRole('textbox', { name: 'Especialidade da casa' })
    expect(text).toHaveValue('Café coado')
    expect(text).toHaveAttribute('aria-required', 'true')
    expect(screen.getByText('Prato ou bebida que define a casa.')).toBeInTheDocument()

    const longText = screen.getByRole('textbox', { name: 'História do lugar' })
    expect(longText.tagName).toBe('TEXTAREA')
    expect(longText).toHaveValue('')

    expect(screen.getByRole('combobox', { name: 'Aceita reservas' })).toHaveValue('true')

    expect(screen.getByRole('spinbutton', { name: 'Número de lugares' })).toHaveValue(48)
    expect(screen.getByText('lugares')).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: 'Ticket médio' })).toHaveValue(37.5)
    expect(screen.getByText('R$')).toBeInTheDocument()

    expect(screen.getByRole('textbox', { name: 'Cardápio online' })).toHaveAttribute('type', 'url')

    const singleSelect = screen.getByRole('combobox', { name: 'Faixa de preço' })
    expect(singleSelect).toHaveValue('72')
    expect(screen.getByRole('option', { name: 'Padrão' })).toBeInTheDocument()

    expect(screen.getByRole('checkbox', { name: 'Wi-Fi' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Acessibilidade' })).not.toBeChecked()

    expect(screen.getAllByText('Herdado')).toHaveLength(2)
    expect(screen.getAllByText('Categoria principal')).toHaveLength(6)
    expect(screen.getAllByText('Obrigatório')).toHaveLength(3)
    expect(screen.getByText('2 de 3 preenchidos')).toBeInTheDocument()
  })

  it('collects field input and submits the canonical attributes payload', async () => {
    const { user } = render(
      <EffectiveAttributesForm
        establishmentId={7}
        editable
        attributes={[
          attribute({ id: 10, key: 'specialty', name: 'Especialidade da casa', data_type: 'text' }),
          attribute({
            id: 11,
            key: 'reservations',
            name: 'Aceita reservas',
            data_type: 'boolean',
            inherited: true,
            source_category_id: 1,
          }),
          attribute({
            id: 12,
            key: 'price_level',
            name: 'Faixa de preço',
            data_type: 'single_select',
            options: [
              { id: 121, label: 'Padrão', value: 'standard' },
              { id: 122, label: 'Premium', value: 'premium' },
            ],
          }),
          attribute({
            id: 13,
            key: 'amenities',
            name: 'Comodidades',
            data_type: 'multi_select',
            options: [
              { id: 131, label: 'Wi-Fi', value: 'wifi' },
              { id: 132, label: 'Acessibilidade', value: 'accessibility' },
            ],
          }),
        ]}
      />
    )

    await user.type(
      screen.getByRole('textbox', { name: 'Especialidade da casa' }),
      'Torta de banana'
    )
    await user.selectOptions(screen.getByRole('combobox', { name: 'Aceita reservas' }), 'true')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Faixa de preço' }), '122')
    await user.click(screen.getByRole('checkbox', { name: 'Wi-Fi' }))

    const save = screen.getByRole('button', { name: /salvar características/i })
    expect(save).toBeEnabled()
    await user.click(save)

    expect(mockPut).toHaveBeenCalledExactlyOnceWith('/portal/establishments/7/attributes')
    expect(putSnapshots[0]?.data).toEqual({
      attributes: [
        { attribute_definition_id: 10, value: 'Torta de banana', option_ids: [] },
        { attribute_definition_id: 11, value: true, option_ids: [] },
        { attribute_definition_id: 12, value: null, option_ids: [122] },
        { attribute_definition_id: 13, value: null, option_ids: [131] },
      ],
    })
  })

  it('prevents editing stale fields while category changes are unsaved', async () => {
    const onReviewCategories = vi.fn()
    const { user } = render(
      <EffectiveAttributesForm
        establishmentId={1}
        editable
        categoriesDirty
        attributes={[
          attribute({
            id: 10,
            key: 'ambience',
            name: 'Ambiente',
            description: 'Descreva o perfil do ambiente.',
            data_type: 'text',
            is_required: true,
            value: 'Ambiente tranquilo',
          }),
        ]}
        onReviewCategories={onReviewCategories}
      />
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Salve as categorias para recalcular as características'
    )
    expect(screen.getByRole('textbox', { name: /ambiente/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /salvar características/i })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /ir para categorias/i }))
    expect(onReviewCategories).toHaveBeenCalledOnce()
    expect(mockPut).not.toHaveBeenCalled()
  })
})
