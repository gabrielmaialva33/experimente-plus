import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SettingsPage from '~/pages/settings'
import { render, screen } from '~/tests/test_utils'

const mocks = vi.hoisted(() => ({
  deleteAccount: vi.fn(),
  post: vi.fn(),
  setTheme: vi.fn(),
  permissions: [] as string[],
  tenants: [] as Array<{ id: number; name: string; role: string }>,
}))

vi.mock('@inertiajs/react', async () => {
  const React = await import('react')

  return {
    Head: () => null,
    router: { post: mocks.post },
    usePage: () => ({
      url: '/settings',
      props: {
        errors: {},
        auth: {
          activeTenantId: null,
          permissions: mocks.permissions,
          tenants: mocks.tenants,
        },
      },
    }),
    useForm: <T extends Record<string, string>>(initial: T) => {
      const [data, setDataState] = React.useState(initial)

      return {
        data,
        errors: {},
        processing: false,
        recentlySuccessful: false,
        isDirty: true,
        setData: (field: keyof T, value: string) =>
          setDataState((current) => ({ ...current, [field]: value })),
        post: mocks.post,
        delete: mocks.deleteAccount,
        reset: vi.fn(),
      }
    },
  }
})

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme: mocks.setTheme }),
}))

vi.mock('~/layouts', () => ({
  MainLayout: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))

vi.mock('~/components/confirm_dialog', () => ({
  ConfirmDialog: ({
    open,
    title,
    confirmLabel,
    onConfirm,
  }: {
    open: boolean
    title: string
    confirmLabel: string
    onConfirm: () => void
  }) =>
    open ? (
      <section role="dialog" aria-label={title}>
        <button type="button" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </section>
    ) : null,
}))

const profile = {
  id: 1,
  full_name: 'Ana Parceira',
  email: 'ana@example.test',
  username: 'ana',
}

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.permissions = []
    mocks.tenants = []
  })

  it('presents personal settings in pt-BR without inventing an operation destination', async () => {
    const { user } = render(<SettingsPage profile={profile} />)

    expect(screen.getByRole('heading', { name: 'Conta e preferências' })).toBeVisible()
    expect(screen.getByLabelText('E-mail de acesso')).toHaveAttribute('readonly')
    expect(screen.queryByRole('tab', { name: 'Operações' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Aparência' }))
    const darkTheme = screen.getByRole('button', { name: /Escuro/ })
    expect(darkTheme).toHaveAttribute('aria-pressed', 'false')
    await user.click(darkTheme)
    expect(mocks.setTheme).toHaveBeenCalledWith('dark')
  })

  it('requires typed confirmation and a destructive dialog before account deletion', async () => {
    const { user } = render(<SettingsPage profile={profile} />)

    await user.click(screen.getByRole('tab', { name: 'Segurança' }))
    const deleteButton = screen.getByRole('button', { name: 'Excluir minha conta' })
    expect(deleteButton).toBeDisabled()

    await user.type(screen.getByLabelText(/Senha atual/), 'secret-password')
    await user.type(screen.getByLabelText(/Confirmação de exclusão/), 'EXCLUIR MINHA CONTA')
    expect(deleteButton).toBeEnabled()
    await user.click(deleteButton)

    expect(screen.getByRole('dialog', { name: 'Excluir sua conta permanentemente?' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Confirmar exclusão' }))

    expect(mocks.deleteAccount).toHaveBeenCalledWith(
      '/settings/account',
      expect.objectContaining({ preserveScroll: true })
    )
  })

  it('shows real operations only when the account has an operation context', async () => {
    mocks.tenants = [{ id: 9, name: 'Norte do Paraná', role: 'owner' }]

    const { user } = render(<SettingsPage profile={profile} />)
    await user.click(screen.getByRole('tab', { name: 'Operações' }))

    expect(screen.getByText('Norte do Paraná')).toBeVisible()
    expect(screen.getByText('Responsável pela operação')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Criar operação' })).not.toBeInTheDocument()
  })
})
