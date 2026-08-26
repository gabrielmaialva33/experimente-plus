import { describe, expect, it } from 'vitest'

import { EditorField } from '~/components/portal/establishment_editor/editor_field'
import { Input } from '~/components/ui/input'
import { render, screen } from '~/tests/test_utils'

describe('EditorField', () => {
  it('connects labels, hints and validation errors to the control', () => {
    render(
      <EditorField
        htmlFor="public-name"
        label="Nome público"
        hint="Até 120 caracteres"
        error="Informe o nome público."
        required
      >
        <Input id="public-name" />
      </EditorField>
    )

    const input = screen.getByRole('textbox', { name: /nome público/i })
    expect(input).toHaveAttribute('aria-required', 'true')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAttribute('aria-describedby', 'public-name-hint public-name-error')
    expect(screen.getByText('Até 120 caracteres')).toHaveAttribute('id', 'public-name-hint')
    expect(screen.getByRole('alert')).toHaveAttribute('id', 'public-name-error')
  })
})
