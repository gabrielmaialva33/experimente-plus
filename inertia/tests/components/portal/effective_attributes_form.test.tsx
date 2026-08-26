import { describe, expect, it, vi } from 'vitest'

const formMock = vi.hoisted(() => ({
  data: {
    attributes: [
      {
        attribute_definition_id: 10,
        value: 'Ambiente tranquilo',
        option_ids: [] as number[],
      },
    ],
  },
  errors: {},
  hasErrors: false,
  processing: false,
  recentlySuccessful: false,
  isDirty: false,
  setData: vi.fn(),
  setDefaults: vi.fn(),
  put: vi.fn(),
}))

vi.mock('@inertiajs/react', () => ({
  useForm: () => formMock,
}))

import EffectiveAttributesForm from '~/components/portal/effective_attributes_form'
import { render, screen } from '~/tests/test_utils'

describe('EffectiveAttributesForm', () => {
  it('prevents editing stale fields while category changes are unsaved', async () => {
    const onReviewCategories = vi.fn()
    const { user } = render(
      <EffectiveAttributesForm
        establishmentId={1}
        editable
        categoriesDirty
        attributes={[
          {
            id: 10,
            key: 'ambience',
            name: 'Ambiente',
            description: 'Descreva o perfil do ambiente.',
            data_type: 'text',
            unit: null,
            is_required: true,
            source_category_id: 3,
            inherited: false,
            options: [],
            value: 'Ambiente tranquilo',
            option_ids: [],
          },
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
  })
})
