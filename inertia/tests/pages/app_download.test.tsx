import { screen, within } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AndroidDistribution } from '#config/app_distribution'
import AppDownload from '~/pages/app/download'
import { render } from '~/tests/test_utils'

vi.mock('@inertiajs/react', () => ({
  Head: () => null,
  Link: ({ href, children, ...props }: ComponentProps<'a'> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  usePage: () => ({
    url: '/app',
    props: {
      app: {
        name: 'Experimente+',
        url: 'http://experimente.test',
        sourceUrl: null,
        environment: 'test',
        demoPagesEnabled: false,
      },
      auth: { user: null, tenants: [], activeTenantId: null, permissions: [] },
    },
  }),
}))

vi.mock('~/components/theme/theme_toggle', () => ({
  ThemeToggle: () => <button type="button">Alterar tema</button>,
}))

const android: AndroidDistribution = {
  channel: 'beta',
  version: '1.0.0 beta 1',
  releasedAt: '2026-09-27',
  sizeMegabytes: 110,
  minimumAndroid: '7.0',
  downloadUrl:
    'https://github.com/gabrielmaialva33/experimente-plus-app/releases/latest/download/experimente-plus.apk',
  releaseUrl: 'https://github.com/gabrielmaialva33/experimente-plus-app/releases/latest',
  sha256: 'b3715062cfbb209db739c66ffb71492e017dd04304c877f63fbe70824e6dc580',
}

const props = {
  android,
  pageUrl: 'http://experimente.test/app',
  qrSvg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
}

const setUserAgent = (agent: string, touchPoints = 0) => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(agent)
  // jsdom has no touch points at all; the page only reads the number.
  Object.defineProperty(navigator, 'maxTouchPoints', { value: touchPoints, configurable: true })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('app download page', () => {
  it('says it is a beta and hands out the Android file from the fixed latest link', () => {
    render(<AppDownload {...props} />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'O Experimente+ no seu celular.' })
    ).toBeVisible()
    expect(screen.getByText('Beta')).toBeVisible()
    expect(screen.getByRole('link', { name: /Baixar para Android/ })).toHaveAttribute(
      'href',
      android.downloadUrl
    )
    expect(screen.getByText(/Versão 1\.0\.0 beta 1 · 27 de setembro de 2026/)).toBeVisible()
    expect(screen.getByRole('heading', { level: 2, name: 'Esta é uma versão beta' })).toBeVisible()
    expect(screen.getByText('Pagamentos são simulados; nada é cobrado.')).toBeVisible()
  })

  it('walks through the three install steps and offers the browser to iPhone users', () => {
    render(<AppDownload {...props} />)

    const install = screen.getByRole('heading', { level: 2, name: 'Como instalar' })
      .parentElement as HTMLElement
    expect(within(install).getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByRole('link', { name: /Abrir no navegador/ })).toHaveAttribute(
      'href',
      '/cidades'
    )
    expect(
      screen.getByRole('img', { name: 'Código QR que abre esta página no celular' })
    ).toHaveAttribute('src', expect.stringMatching(/^data:image\/svg\+xml/))
  })

  it.each([
    ['an iPhone', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 0],
    ['an iPad that reports a Mac', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5],
  ])('tells a visitor on %s that iOS is not out yet', (_, agent, touchPoints) => {
    setUserAgent(agent, touchPoints)
    render(<AppDownload {...props} />)

    expect(screen.getByRole('status')).toHaveTextContent('O app para iOS ainda não está disponível')
  })

  it('says nothing about iOS to an Android visitor', () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 16; SM-A576B)')
    render(<AppDownload {...props} />)

    expect(screen.queryByRole('status')).toBeNull()
  })
})
