import { describe, expect, it, vi } from 'vitest'

import { CategoriesSection } from '~/components/portal/establishment_editor/categories_section'
import type { CategoriesForm } from '~/components/portal/establishment_editor/types'
import { render, screen } from '~/tests/test_utils'

function categoriesForm(): CategoriesForm {
  return {
    data: {
      categories: [{ category_id: 1, is_primary: true, sort_order: 0 }],
    },
    errors: {},
    hasErrors: false,
    processing: false,
    recentlySuccessful: false,
    isDirty: false,
    setData: vi.fn(),
  } as unknown as CategoriesForm
}

describe('CategoriesSection', () => {
  it('protects unsaved characteristics before allowing category changes', async () => {
    const onReviewAttributes = vi.fn()
    const { user } = render(
      <CategoriesSection
        form={categoriesForm()}
        categories={[{ id: 1, name: 'Restaurantes', parent_id: null }]}
        editable
        busy={false}
        blockedByUnsavedAttributes
        issues={[]}
        onSubmit={(event) => event.preventDefault()}
        onReviewAttributes={onReviewAttributes}
      />
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Salve as características antes de trocar categorias'
    )
    expect(screen.getByRole('checkbox', { name: 'Restaurantes' })).toBeDisabled()
    expect(screen.getByRole('radio', { name: 'Usar como categoria principal' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /ir para características/i }))
    expect(onReviewAttributes).toHaveBeenCalledOnce()
  })
})
