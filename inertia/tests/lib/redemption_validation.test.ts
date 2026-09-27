import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'

import {
  RedemptionRequestError,
  confirmPresentation,
  inspectPresentation,
} from '~/lib/redemption_validation'
import { server } from '~/tests/mocks/server'
import {
  PRESENTATION_TOKEN,
  previewFixture,
  receiptFixture,
} from '~/tests/utils/redemption_fixtures'

const refusal = {
  reason: 'foreign',
  title: 'Benefício de outro estabelecimento',
  message: 'Este benefício é de um estabelecimento que sua conta não administra.',
}

describe('redemption validation requests', () => {
  afterEach(() => {
    document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
  })

  it('sends the token only in the JSON body, with the XSRF header of the session', async () => {
    document.cookie = 'XSRF-TOKEN=e%3Axsrf-value'
    let seen: { url: string; body: unknown; xsrf: string | null; accept: string | null } | null =
      null
    server.use(
      http.post('/portal/redemptions/preview', async ({ request }) => {
        seen = {
          url: request.url,
          body: await request.json(),
          xsrf: request.headers.get('x-xsrf-token'),
          accept: request.headers.get('accept'),
        }
        return HttpResponse.json({ outcome: 'preview', preview: previewFixture })
      })
    )

    await expect(inspectPresentation(PRESENTATION_TOKEN)).resolves.toEqual({
      outcome: 'preview',
      preview: previewFixture,
    })
    expect(seen).toEqual({
      url: 'http://localhost:3000/portal/redemptions/preview',
      body: { token: PRESENTATION_TOKEN },
      xsrf: 'e%3Axsrf-value',
      accept: 'application/json',
    })
  })

  it('reads an already confirmed presentation as its original receipt', async () => {
    server.use(
      http.post('/portal/redemptions/preview', () =>
        HttpResponse.json({ outcome: 'redeemed', receipt: receiptFixture })
      )
    )
    await expect(inspectPresentation(PRESENTATION_TOKEN)).resolves.toEqual({
      outcome: 'redeemed',
      receipt: receiptFixture,
    })
  })

  it('passes the server refusal through, whatever its status', async () => {
    server.use(
      http.post('/portal/redemptions/preview', () =>
        HttpResponse.json({ outcome: 'refused', refusal }, { status: 404 })
      ),
      http.post('/portal/redemptions/confirm', () =>
        HttpResponse.json({ outcome: 'refused', refusal }, { status: 404 })
      )
    )
    await expect(inspectPresentation(PRESENTATION_TOKEN)).resolves.toEqual({
      outcome: 'refused',
      refusal,
    })
    await expect(confirmPresentation(PRESENTATION_TOKEN)).resolves.toEqual({
      outcome: 'refused',
      refusal,
    })
  })

  it('tells a lost connection, an ended session and a server failure apart', async () => {
    server.use(http.post('/portal/redemptions/preview', () => HttpResponse.error()))
    await expect(inspectPresentation(PRESENTATION_TOKEN)).rejects.toMatchObject({
      problem: 'network',
    })

    server.use(
      http.post('/portal/redemptions/preview', () =>
        HttpResponse.json({ errors: [{ message: 'Unauthorized access' }] }, { status: 401 })
      )
    )
    await expect(inspectPresentation(PRESENTATION_TOKEN)).rejects.toMatchObject({
      problem: 'session',
    })

    server.use(
      http.post('/portal/redemptions/confirm', () => new HttpResponse('boom', { status: 500 }))
    )
    const failure = await confirmPresentation(PRESENTATION_TOKEN).catch((error) => error)
    expect(failure).toBeInstanceOf(RedemptionRequestError)
    expect(failure.problem).toBe('server')
    expect(failure.message).not.toContain(PRESENTATION_TOKEN)
  })

  it('returns the receipt of a confirmation', async () => {
    server.use(
      http.post('/portal/redemptions/confirm', () =>
        HttpResponse.json({ outcome: 'confirmed', receipt: receiptFixture })
      )
    )
    await expect(confirmPresentation(PRESENTATION_TOKEN)).resolves.toEqual({
      outcome: 'confirmed',
      receipt: receiptFixture,
    })
  })
})
