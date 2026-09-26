import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ReportDialog } from '~/components/catalog/report_dialog'
import { render, screen, waitFor } from '~/tests/test_utils'

const fetchMock = vi.fn()

function jsonResponse(status: number, body: unknown = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  window.localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function openAndPickReason() {
  const view = render(
    <ReportDialog targetType="review" targetId={42} subject="avaliação de Ana Souza" />
  )
  await view.user.click(
    screen.getByRole('button', { name: 'Denunciar avaliação: avaliação de Ana Souza' })
  )
  const submit = screen.getByRole('button', { name: 'Enviar denúncia' })
  // A reason comes first: the form cannot be sent empty.
  expect(submit).toBeDisabled()
  await view.user.click(screen.getByRole('radio', { name: 'Informação falsa' }))
  expect(submit).toBeEnabled()
  return { ...view, submit }
}

describe('public report dialog (W10)', () => {
  it('sends an anonymous report through the public route and answers with the protocol', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { protocol_number: 'DEN-2026-000123' }))
    const { user, submit } = await openAndPickReason()

    await user.type(screen.getByLabelText('Quer explicar melhor? (opcional)'), '  Não abre mais.  ')
    await user.click(submit)

    expect(await screen.findByText('Denúncia registrada')).toBeInTheDocument()
    expect(screen.getByText('DEN-2026-000123')).toBeInTheDocument()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/v1/catalog/content-reports')
    expect(init.method).toBe('POST')
    const body = JSON.parse(String(init.body))
    expect(body).toMatchObject({
      target_type: 'review',
      target_id: 42,
      reason: 'false_information',
      details: 'Não abre mais.',
    })
    // The opaque token is kept in this browser so a repeat is recognised.
    expect(body.anonymous_token).toMatch(/^[A-Za-z0-9-]{16,128}$/)
    expect(body.anonymous_token).toBe(window.localStorage.getItem('ep.anonymous_report_token'))
  })

  it('sends the same browser token on a later report', async () => {
    window.localStorage.setItem('ep.anonymous_report_token', 'browser-token-0123456789')
    fetchMock.mockResolvedValue(jsonResponse(201, { protocol_number: 'DEN-2' }))
    const { user, submit } = await openAndPickReason()

    await user.click(submit)
    await screen.findByText('Denúncia registrada')

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(String(init.body)).anonymous_token).toBe('browser-token-0123456789')
  })

  it.each([
    [409, 'Você já denunciou este conteúdo. A moderação está analisando.'],
    [404, 'Este conteúdo não está mais disponível.'],
    [429, 'Muitas denúncias em pouco tempo. Tente de novo mais tarde.'],
    [500, 'Não foi possível enviar a denúncia agora. Tente de novo.'],
  ])('explains a %i answer and keeps the form to try again', async (status, message) => {
    fetchMock.mockResolvedValue(jsonResponse(status))
    const { user, submit } = await openAndPickReason()

    await user.click(submit)

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(screen.queryByText('Denúncia registrada')).not.toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Informação falsa' })).toBeChecked()
  })

  it('says so when the network fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const { user, submit } = await openAndPickReason()

    await user.click(submit)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Sem conexão. Confira a internet e tente de novo.'
    )
  })

  it('starts over when closed and reopened', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { protocol_number: 'DEN-1' }))
    const { user, submit } = await openAndPickReason()
    await user.click(submit)
    await user.click(await screen.findByRole('button', { name: 'Fechar' }))

    await waitFor(() => expect(screen.queryByText('Denúncia registrada')).not.toBeInTheDocument())
    await user.click(
      screen.getByRole('button', { name: 'Denunciar avaliação: avaliação de Ana Souza' })
    )
    expect(screen.getByRole('button', { name: 'Enviar denúncia' })).toBeDisabled()
    expect(screen.getByRole('radio', { name: 'Informação falsa' })).not.toBeChecked()
  })
})
