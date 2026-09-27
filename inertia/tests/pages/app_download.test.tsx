import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AndroidDistribution } from '#config/app_distribution'
import AppDownload from '~/pages/app/download'
import { captureInstallPrompt, resetInstallPrompt } from '~/pwa/install_prompt'
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

/** Chromium's install offer, as the browser fires it. */
function offerInstall(outcome: 'accepted' | 'dismissed') {
  const offer = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt: vi.fn(async () => {}),
    userChoice: Promise.resolve({ outcome }),
  })
  act(() => {
    window.dispatchEvent(offer)
  })
  return offer
}

captureInstallPrompt(window)

afterEach(() => {
  vi.restoreAllMocks()
  Reflect.deleteProperty(navigator, 'standalone')
  act(() => resetInstallPrompt())
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

  it('walks through the three Android install steps and keeps the browser one tap away', () => {
    render(<AppDownload {...props} />)

    const install = screen.getByRole('heading', { level: 2, name: 'Como instalar' })
      .parentElement as HTMLElement
    expect(within(install).getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByRole('link', { name: /Usar no navegador/ })).toHaveAttribute(
      'href',
      '/cidades'
    )
    expect(
      screen.getByRole('img', { name: 'Código QR que abre esta página no celular' })
    ).toHaveAttribute('src', expect.stringMatching(/^data:image\/svg\+xml/))
  })

  it('shows iPhone users how to add the site to the Home Screen from Safari', () => {
    render(<AppDownload {...props} />)

    const section = screen.getByRole('region', { name: 'Instale no iPhone' })
    expect(section).toHaveAttribute('id', 'instalar-no-iphone')
    const steps = within(section).getAllByRole('listitem')
    expect(
      steps.map((step) => within(step).getByRole('heading', { level: 3 }).textContent)
    ).toEqual([
      'Abra no Safari',
      'Toque em Compartilhar',
      'Adicione à Tela de Início',
      'Abra pelo ícone',
    ])
    expect(steps[0]).toHaveTextContent('Safari')
    expect(steps[1]).toHaveTextContent('Compartilhar')
    expect(steps[1]).toHaveTextContent('Mais opções')
    expect(steps[2]).toHaveTextContent('Adicionar à Tela de Início')
    expect(section).toHaveTextContent('O app para iOS chega depois, pela App Store.')
  })

  it.each([
    ['an iPhone', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 0],
    ['an iPad that reports a Mac', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5],
  ])('points a visitor on %s to the Home Screen steps', (_, agent, touchPoints) => {
    setUserAgent(agent, touchPoints)
    render(<AppDownload {...props} />)

    const note = screen.getByRole('status')
    expect(note).toHaveTextContent('O app para iOS ainda não está disponível')
    expect(within(note).getByRole('link', { name: 'Veja como' })).toHaveAttribute(
      'href',
      '#instalar-no-iphone'
    )
  })

  it('tells an iPhone user already in the installed site that it is installed', () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')
    Object.defineProperty(navigator, 'standalone', { value: true, configurable: true })
    render(<AppDownload {...props} />)

    const note = screen.getByRole('status')
    expect(note).toHaveTextContent('instalado na Tela de Início')
    expect(within(note).queryByRole('link')).toBeNull()
  })

  it('says nothing about iOS to an Android visitor', () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 16; SM-A576B)')
    render(<AppDownload {...props} />)

    expect(screen.queryByRole('status')).toBeNull()
  })

  describe('installing the site where the browser offers it', () => {
    it('shows no install button until the browser makes an offer (Safari, Firefox)', () => {
      render(<AppDownload {...props} />)

      expect(screen.queryByRole('button', { name: /Instalar o site/ })).toBeNull()
    })

    it('offers the site below the Android download, which stays the main path', async () => {
      render(<AppDownload {...props} />)
      const offer = offerInstall('accepted')

      const button = await screen.findByRole('button', { name: /Instalar o site/ })
      expect(screen.getByRole('link', { name: /Baixar para Android/ })).toHaveClass('bg-cta')
      expect(button).not.toHaveClass('bg-cta')

      await userEvent.click(button)
      expect(offer.prompt).toHaveBeenCalledTimes(1)
      expect(await screen.findByRole('status')).toHaveTextContent('Site instalado')
    })

    it('explains the browser menu after the offer is dismissed', async () => {
      render(<AppDownload {...props} />)
      offerInstall('dismissed')

      await userEvent.click(await screen.findByRole('button', { name: /Instalar o site/ }))
      expect(await screen.findByRole('status')).toHaveTextContent('menu do navegador')
      expect(screen.queryByRole('button', { name: /Instalar o site/ })).toBeNull()
    })
  })
})
