import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SettingsPage from '~/pages/settings'
import { render, screen } from '~/tests/test_utils'

const mocks = vi.hoisted(() => ({
  deleteAccount: vi.fn(),
  post: vi.fn(),
  setTheme: vi.fn(),
  permissions: [] as string[],
  tenants: [] as Array<{ id: number; name: string; role: string }>,
  url: '/settings',
  // A partner by default: the backoffice layout and its operations.
  hasActiveOrganizationMembership: true,
  platformAccess: null as string | null,
}))

vi.mock('@inertiajs/react', async () => {
  const React = await import('react')

  return {
    Head: () => null,
    // The profile form's unsaved-changes guard listens to visits.
    router: { post: mocks.post, on: () => () => undefined },
    usePage: () => ({
      url: mocks.url,
      props: {
        errors: {},
        auth: {
          activeTenantId: null,
          permissions: mocks.permissions,
          tenants: mocks.tenants,
          hasActiveOrganizationMembership: mocks.hasActiveOrganizationMembership,
          platformAccess: mocks.platformAccess,
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
  MainLayout: ({ children }: { children: ReactNode }) => <main data-shell="main">{children}</main>,
}))

vi.mock('~/components/consumer/consumer_shell', () => ({
  ConsumerShell: ({ children }: { children: ReactNode }) => (
    <main data-shell="consumer">{children}</main>
  ),
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
    mocks.url = '/settings'
    mocks.hasActiveOrganizationMembership = true
    mocks.platformAccess = null
  })

  it('renders the theme cards the same on the server and before hydration', () => {
    mocks.url = '/settings?tab=appearance'
    // The browser's saved theme is unknown to the server; no card may claim it yet.
    const markup = renderToString(<SettingsPage profile={profile} />)

    expect(markup).toContain('Tema da interface')
    expect(markup).not.toContain('aria-pressed="true"')
  })

  it('presents personal settings in pt-BR without inventing an operation destination', async () => {
    const { user } = render(<SettingsPage profile={profile} />)

    expect(screen.getByRole('heading', { name: 'Conta e preferências' })).toBeVisible()
    expect(screen.getByLabelText('E-mail de acesso')).toHaveAttribute('readonly')
    expect(screen.queryByRole('tab', { name: 'Operações' })).not.toBeInTheDocument()
    // Three sections are pills in one wrapping row, never boxes that overflow sideways.
    const sections = screen.getByRole('tablist', { name: 'Seções da conta' })
    expect(sections).toHaveClass('flex', 'flex-wrap', '[&_[role=tab]]:rounded-full')
    expect(sections).not.toHaveClass('grid')
    expect(screen.getByRole('tab', { name: 'Perfil' })).toBeInTheDocument()
    // The optional hint fits beside its label, so both name fields keep one baseline.
    expect(screen.getByLabelText('Nome de usuário')).toHaveAccessibleDescription('Opcional')

    await user.click(screen.getByRole('tab', { name: 'Aparência' }))
    const darkTheme = screen.getByRole('button', { name: /Escuro/ })
    expect(darkTheme).toHaveAttribute('aria-pressed', 'false')
    await user.click(darkTheme)
    expect(mocks.setTheme).toHaveBeenCalledWith('dark')
  })

  // At 390 px four line tabs ran off the page; pills in a 2×2 grid fit, one row from sm.
  it('lays the section tabs out as pills that never scroll the page on a phone', () => {
    mocks.tenants = [{ id: 9, name: 'Norte do Paraná', role: 'owner' }]
    render(<SettingsPage profile={profile} />)

    const tabs = screen.getByRole('tablist', { name: 'Seções da conta' })
    // The list rounds every tab it holds (`[&_[role=tab]]:rounded-full`).
    expect(tabs).toHaveClass('grid', 'grid-cols-2', 'sm:flex', '[&_[role=tab]]:rounded-full')
    expect(tabs).not.toHaveClass('border-b')
    expect(screen.getAllByRole('tab')).toHaveLength(4)
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

  // Web audit: a consumer's account opened in the backoffice layout, with an
  // "Operações" tab about isolating private data.
  it('opens a consumer account in the consumer shell, with operations only when there is a choice', async () => {
    mocks.hasActiveOrganizationMembership = false
    mocks.tenants = [{ id: 9, name: 'Norte do Paraná', role: 'member' }]

    const view = render(<SettingsPage profile={profile} />)
    expect(view.container.querySelector('[data-shell="consumer"]')).toBeInTheDocument()
    expect(view.container.querySelector('[data-shell="main"]')).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Operações' })).not.toBeInTheDocument()
    view.unmount()

    mocks.tenants = [
      { id: 9, name: 'Norte do Paraná', role: 'member' },
      { id: 10, name: 'Oeste do Paraná', role: 'member' },
    ]
    render(<SettingsPage profile={profile} />)
    expect(screen.getByRole('tab', { name: 'Operações' })).toBeInTheDocument()
  })
})
