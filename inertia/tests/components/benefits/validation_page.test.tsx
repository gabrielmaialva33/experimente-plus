import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { ComponentProps, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import PartnerValidationPage from '~/pages/portal/redemptions/validate'
import { server } from '~/tests/mocks/server'
import { render } from '~/tests/test_utils'
import {
  PRESENTATION_TOKEN,
  PRESENTATION_URL,
  previewFixture,
  receiptFixture,
} from '~/tests/utils/redemption_fixtures'
import type { OrganizationAllowedActions } from '~/types'

const mocks = vi.hoisted(() => ({
  pageProps: {} as Record<string, unknown>,
  router: {
    get: vi.fn(),
    post: vi.fn(),
    visit: vi.fn(),
    replace: vi.fn(),
    push: vi.fn(),
  },
  decisions: [] as boolean[],
}))

vi.mock('@inertiajs/react', () => ({
  Head: () => null,
  Link: ({ href, children, ...props }: ComponentProps<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  router: mocks.router,
  usePage: () => ({ props: mocks.pageProps }),
}))

vi.mock('~/layouts/main_layout', () => ({
  MainLayout: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))

// The camera is covered by qr_scanner.test.tsx; here a "read" is a button that
// hands the page what the camera would have decoded.
vi.mock('~/components/benefits/qr_scanner', () => ({
  QrScanner: ({
    onDecode,
    onTypeInstead,
    rejectedMessage,
  }: {
    onDecode: (value: string) => boolean
    onTypeInstead?: () => void
    rejectedMessage: string
  }) => (
    <div>
      <button type="button" onClick={() => mocks.decisions.push(onDecode(PRESENTATION_URL))}>
        Câmera lê o benefício
      </button>
      <button
        type="button"
        onClick={() => mocks.decisions.push(onDecode('https://example.com/cardapio'))}
      >
        Câmera lê outro QR
      </button>
      <p>{rejectedMessage}</p>
      <button type="button" onClick={onTypeInstead}>
        Digitar código
      </button>
    </div>
  ),
}))

const actions: OrganizationAllowedActions = {
  organizations: { read: true, update: false, submit: false },
  establishments: {
    read: true,
    list: true,
    create: false,
    create_revision: false,
    update: false,
    submit: false,
    archive: false,
  },
  benefit_offers: {
    read: true,
    list: true,
    create: false,
    update: false,
    activate: false,
    pause: false,
    archive: false,
  },
  redemptions: { read: true, validate: true },
  analytics: { read: true },
} as OrganizationAllowedActions

interface Recorded {
  path: string
  url: string
  body: unknown
}

function recordRequests() {
  const requests: Recorded[] = []
  server.events.on('request:start', async ({ request }) => {
    requests.push({
      path: new URL(request.url).pathname,
      url: request.url,
      body: request.method === 'POST' ? await request.clone().json() : null,
    })
  })
  return requests
}

function answerPreview(...responses: Array<() => Response>) {
  server.use(
    http.post('/portal/redemptions/preview', () =>
      (responses.length > 1 ? responses.shift()! : responses[0])()
    )
  )
}

function answerConfirm(...responses: Array<() => Response>) {
  server.use(
    http.post('/portal/redemptions/confirm', () =>
      (responses.length > 1 ? responses.shift()! : responses[0])()
    )
  )
}

const preview = () => HttpResponse.json({ outcome: 'preview', preview: previewFixture })
const confirmed = () => HttpResponse.json({ outcome: 'confirmed', receipt: receiptFixture })

function renderPage(props: Partial<ComponentProps<typeof PartnerValidationPage>> = {}) {
  return render(
    <PartnerValidationPage token="" preview={null} allowed_actions={actions} {...props} />
  )
}

async function readBenefit(user: ReturnType<typeof renderPage>['user']) {
  await user.click(screen.getByRole('button', { name: 'Ler QR code' }))
  await user.click(screen.getByRole('button', { name: 'Câmera lê o benefício' }))
}

describe('Validar benefício', () => {
  beforeEach(() => {
    mocks.pageProps = {}
    mocks.decisions = []
    for (const fn of Object.values(mocks.router)) fn.mockClear()
  })

  afterEach(() => {
    server.events.removeAllListeners()
    window.history.replaceState(null, '', '/')
  })

  it('reads a QR, previews without redeeming, then confirms only on request', async () => {
    const requests = recordRequests()
    answerPreview(preview)
    answerConfirm(confirmed)
    const { user } = renderPage()

    expect(screen.getByRole('button', { name: 'Ler QR code' })).toHaveClass('bg-primary')
    await user.click(screen.getByRole('button', { name: 'Ler QR code' }))
    // The reader opened where the button was; the keyboard lands on it.
    expect(screen.getByRole('heading', { name: 'Ler QR code' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Câmera lê o benefício' }))

    const ticket = await screen.findByRole('region', { name: 'Benefício apresentado' })
    expect(mocks.decisions).toEqual([true])
    expect(within(ticket).getByRole('heading', { name: 'Sobremesa cortesia' })).toBeVisible()
    expect(within(ticket).getByText('Ana Souza')).toBeVisible()
    expect(within(ticket).getByText('Café Central')).toBeVisible()
    expect(within(ticket).getByText('Validade do código')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Apresentação válida' })).toHaveFocus()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Apresentação válida: Sobremesa cortesia para Ana Souza.'
    )
    expect(requests.map((request) => request.path)).toEqual(['/portal/redemptions/preview'])

    await user.click(screen.getByRole('button', { name: 'Confirmar utilização' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(requests).toHaveLength(1)
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar utilização' }))

    const receipt = await screen.findByRole('region', { name: 'Sobremesa cortesia' })
    expect(within(receipt).getByText('Utilização registrada')).toBeVisible()
    expect(within(receipt).getByText('EXP-0123456789ABCDEF')).toBeVisible()
    expect(within(receipt).getByRole('link', { name: 'Abrir comprovante' })).toHaveAttribute(
      'href',
      '/portal/redemptions/EXP-0123456789ABCDEF'
    )
    expect(screen.getByRole('status')).toHaveTextContent(
      'Utilização registrada. Comprovante EXP-0123456789ABCDEF.'
    )
    expect(requests.map((request) => [request.path, request.body])).toEqual([
      ['/portal/redemptions/preview', { token: PRESENTATION_TOKEN }],
      ['/portal/redemptions/confirm', { token: PRESENTATION_TOKEN }],
    ])

    // The next customer: the reader opens again.
    await user.click(within(receipt).getByRole('button', { name: 'Ler próximo QR code' }))
    expect(screen.getByRole('button', { name: 'Câmera lê o benefício' })).toBeVisible()
  })

  it('refuses a QR that is not a benefit without calling the server', async () => {
    const requests = recordRequests()
    const { user } = renderPage()

    await user.click(screen.getByRole('button', { name: 'Ler QR code' }))
    await user.click(screen.getByRole('button', { name: 'Câmera lê outro QR' }))

    expect(mocks.decisions).toEqual([false])
    expect(screen.getByText('Este QR não é um benefício do Experimente+.')).toBeVisible()
    expect(requests).toHaveLength(0)
  })

  it.each([
    [
      'foreign',
      404,
      'Benefício de outro estabelecimento',
      'Este benefício é de um estabelecimento que sua conta não administra, ou não está mais disponível, e por isso não pode ser validado aqui.',
    ],
    ['already_used', 400, 'Benefício já utilizado', 'Este cliente já usou este benefício.'],
    ['invalid', 400, 'QR code expirado ou inválido', 'Esta apresentação é inválida ou expirou.'],
    ['paused', 400, 'Benefício pausado', 'A oferta não está recebendo utilizações agora.'],
    ['blocked', 400, 'Benefício bloqueado', 'O acesso deste cliente está bloqueado.'],
    ['outside_window', 400, 'Fora do período de uso', 'Este benefício não vale neste horário.'],
  ])('explains the %s refusal and offers the next read', async (reason, status, title, message) => {
    answerPreview(() =>
      HttpResponse.json({ outcome: 'refused', refusal: { reason, title, message } }, { status })
    )
    const { user } = renderPage()

    await readBenefit(user)

    const panel = await screen.findByRole('region', { name: title })
    expect(panel).toHaveAttribute('data-reason', reason)
    expect(within(panel).getByRole('heading', { name: title })).toHaveFocus()
    expect(within(panel).getByText(message)).toBeVisible()
    expect(within(panel).getByText('Nada foi registrado.')).toBeVisible()
    expect(screen.queryByText(/Algo deu errado/)).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(`${title}. ${message}`)
    expect(within(panel).getByRole('button', { name: 'Ler outro QR code' })).toBeVisible()
    await user.click(within(panel).getByRole('button', { name: 'Digitar código' }))
    expect(screen.getByLabelText('Link ou código da apresentação')).toHaveFocus()
  })

  it('shows the original receipt when the same QR is read after its confirmation', async () => {
    answerPreview(() => HttpResponse.json({ outcome: 'redeemed', receipt: receiptFixture }))
    const { user } = renderPage()

    await readBenefit(user)

    const receipt = await screen.findByRole('region', { name: 'Sobremesa cortesia' })
    expect(within(receipt).getByText('Este QR code já tinha sido confirmado')).toBeVisible()
    expect(within(receipt).getByText(/Nenhuma utilização nova foi registrada/)).toBeVisible()
    expect(within(receipt).getByText('EXP-0123456789ABCDEF')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Confirmar utilização' })).not.toBeInTheDocument()
  })

  it('retries a preview whose answer did not arrive', async () => {
    answerPreview(() => HttpResponse.error(), preview)
    const { user } = renderPage()

    await readBenefit(user)

    expect(await screen.findByRole('heading', { name: 'Sem conexão' })).toHaveFocus()
    const problem = screen.getByRole('region', { name: 'Sem conexão' })
    expect(within(problem).getByText(/Nada foi registrado/)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByRole('region', { name: 'Benefício apresentado' })).toBeVisible()
  })

  it('keeps the token for a safe retry when the confirmation answer is lost', async () => {
    const requests = recordRequests()
    answerPreview(preview)
    answerConfirm(() => HttpResponse.error(), confirmed)
    const { user } = renderPage()

    await readBenefit(user)
    await user.click(await screen.findByRole('button', { name: 'Confirmar utilização' }))
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Confirmar utilização',
      })
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A confirmação não completou. Tentar de novo é seguro'
    )
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByText('Utilização registrada')).toBeVisible()
    expect(
      requests
        .filter((request) => request.path === '/portal/redemptions/confirm')
        .map((r) => r.body)
    ).toEqual([{ token: PRESENTATION_TOKEN }, { token: PRESENTATION_TOKEN }])
  })

  it('accepts a pasted link, refuses unknown text locally and clears the field', async () => {
    const requests = recordRequests()
    answerPreview(preview)
    const { user } = renderPage()

    await user.click(screen.getByRole('button', { name: 'Digitar código' }))
    const field = screen.getByLabelText('Link ou código da apresentação')
    expect(field).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Conferir' })).toBeDisabled()

    await user.type(field, 'https://example.com/cardapio')
    await user.click(screen.getByRole('button', { name: 'Conferir' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Não reconhecemos este código.')
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(requests).toHaveLength(0)

    await user.clear(field)
    await user.click(field)
    await user.paste(PRESENTATION_URL)
    await user.keyboard('{Enter}')

    expect(await screen.findByRole('region', { name: 'Benefício apresentado' })).toBeVisible()
    expect(requests.map((request) => request.body)).toEqual([{ token: PRESENTATION_TOKEN }])
    expect(document.body.innerHTML).not.toContain(PRESENTATION_TOKEN)
  })

  it('never puts the token in the address, the history, the router or the console', async () => {
    const consoleSpies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((method) =>
      vi.spyOn(console, method)
    )
    const pushState = vi.spyOn(window.history, 'pushState')
    const replaceState = vi.spyOn(window.history, 'replaceState')
    answerPreview(preview)
    answerConfirm(() => HttpResponse.error(), confirmed)
    const { user } = renderPage()

    await readBenefit(user)
    await user.click(await screen.findByRole('button', { name: 'Confirmar utilização' }))
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Confirmar utilização',
      })
    )
    await user.click(await screen.findByRole('button', { name: 'Tentar de novo' }))
    await screen.findByText('Utilização registrada')

    const leaked = (calls: unknown[][]) =>
      calls.some((call) => JSON.stringify(call).includes(PRESENTATION_TOKEN))
    for (const spy of consoleSpies) expect(leaked(spy.mock.calls)).toBe(false)
    expect(leaked(pushState.mock.calls)).toBe(false)
    expect(leaked(replaceState.mock.calls)).toBe(false)
    for (const method of Object.values(mocks.router)) expect(method).not.toHaveBeenCalled()
    expect(window.location.href).not.toContain(PRESENTATION_TOKEN)
    expect(JSON.stringify(window.history.state ?? null)).not.toContain(PRESENTATION_TOKEN)
    expect(document.body.innerHTML).not.toContain(PRESENTATION_TOKEN)
    vi.restoreAllMocks()
  })

  it('takes the token of a link opened by the phone camera out of the address', async () => {
    const requests = recordRequests()
    answerConfirm(confirmed)
    window.history.replaceState(
      null,
      '',
      `/portal/redemptions/validate?token=${PRESENTATION_TOKEN}&from=camera`
    )
    const { user } = renderPage({
      token: PRESENTATION_TOKEN,
      preview: { ...previewFixture, token: PRESENTATION_TOKEN },
    })

    expect(mocks.router.replace).toHaveBeenCalledTimes(1)
    const [visit] = mocks.router.replace.mock.calls[0]
    expect(visit.url).toBe('/portal/redemptions/validate?from=camera')
    expect(visit).toMatchObject({ preserveState: true, preserveScroll: true })
    const cleared = visit.props({
      token: PRESENTATION_TOKEN,
      preview: {},
      allowed_actions: actions,
    })
    expect(cleared).toMatchObject({ token: '', preview: null, receipt: null, refusal: null })
    expect(JSON.stringify(cleared)).not.toContain(PRESENTATION_TOKEN)

    // The page kept it in memory: the confirmation still works.
    expect(screen.getByRole('region', { name: 'Benefício apresentado' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Confirmar utilização' }))
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Confirmar utilização',
      })
    )
    expect(await screen.findByText('Utilização registrada')).toBeVisible()
    expect(requests.map((request) => request.body)).toEqual([{ token: PRESENTATION_TOKEN }])
  })

  it('renders the refusal of a link in Portuguese instead of an error page', () => {
    renderPage({
      refusal: {
        reason: 'foreign',
        title: 'Benefício de outro estabelecimento',
        message: 'Este benefício é de um estabelecimento que sua conta não administra.',
      },
    })

    const panel = screen.getByRole('region', { name: 'Benefício de outro estabelecimento' })
    expect(within(panel).getByText('Nada foi registrado.')).toBeVisible()
  })

  it('keeps every action at least 44 px tall', async () => {
    answerPreview(preview)
    const { user } = renderPage()

    for (const button of screen.getAllByRole('button')) {
      expect(button.className).toMatch(/\bh-(11|12|13)\b/)
    }
    await readBenefit(user)
    await screen.findByRole('region', { name: 'Benefício apresentado' })
    for (const name of ['Confirmar utilização', 'Conferir outro']) {
      expect(screen.getByRole('button', { name }).className).toMatch(/\bh-(11|12|13)\b/)
    }
  })

  it('does not offer the reader to an account that cannot validate', () => {
    renderPage({
      allowed_actions: { ...actions, redemptions: { read: true, validate: false } },
    })

    expect(screen.getByRole('heading', { name: 'Validação indisponível' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Ler QR code' })).not.toBeInTheDocument()
  })
})
