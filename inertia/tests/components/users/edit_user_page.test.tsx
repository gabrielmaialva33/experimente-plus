import type { ReactNode } from 'react'

import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import EditUserPage from '~/pages/users/edit'
import { render } from '~/tests/test_utils'

vi.mock('@inertiajs/react', async () => {
  const React = await import('react')

  return {
    Head: ({ title }: { title: string }) => <title>{title}</title>,
    Link: ({ children, href }: { children: ReactNode; href: string }) => (
      <a href={href}>{children}</a>
    ),
    // The unsaved-changes guard listens to visits.
    router: { on: () => () => undefined },
    useForm: <T extends Record<string, string>>(initial: T) => {
      const [data, setDataState] = React.useState(initial)

      return {
        data,
        errors: {},
        processing: false,
        isDirty: false,
        setData: (field: keyof T, value: string) =>
          setDataState((current) => ({ ...current, [field]: value })),
        put: vi.fn(),
      }
    },
  }
})

vi.mock('~/layouts', () => ({
  MainLayout: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))

describe('EditUserPage', () => {
  it('fills the form and keeps the fixed e-mail legible: read-only, not disabled', () => {
    render(
      <EditUserPage
        user={
          {
            id: 7,
            full_name: 'Ana Souza',
            email: 'ana@example.com',
          } as never
        }
      />
    )

    expect(screen.getByLabelText(/Nome completo/)).toHaveValue('Ana Souza')
    const email = screen.getByLabelText('E-mail')
    expect(email).toHaveValue('ana@example.com')
    expect(email).toHaveAttribute('readonly')
    expect(email).not.toBeDisabled()
  })
})
