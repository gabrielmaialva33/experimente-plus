import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ThemeToggle } from '~/components/theme/theme_toggle'
import { render } from '~/tests/test_utils'

const themeMock = vi.hoisted(() => ({
  setTheme: vi.fn(),
}))

vi.mock('next-themes', () => ({
  useTheme: () => ({
    theme: 'light',
    setTheme: themeMock.setTheme,
  }),
}))

describe('ThemeToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders an accessible theme toggle button', () => {
    render(<ThemeToggle />)

    expect(screen.getByRole('button', { name: 'Alterar tema' })).toBeInTheDocument()
  })

  it('shows the localized options and changes the selected theme', async () => {
    const { user } = render(<ThemeToggle />)

    await user.click(screen.getByRole('button', { name: 'Alterar tema' }))

    expect(await screen.findByText('Claro')).toBeInTheDocument()
    expect(screen.getByText('Escuro')).toBeInTheDocument()
    expect(screen.getByText('Sistema')).toBeInTheDocument()

    await user.click(screen.getByText('Escuro'))
    expect(themeMock.setTheme).toHaveBeenCalledWith('dark')
  })
})
