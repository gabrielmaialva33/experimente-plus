import { router } from '@inertiajs/react'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  PartnerContentAdminEditor,
  PartnerContentHistory,
} from '~/components/backoffice/partner_content_admin_tools'
import { describeChanges, partnerContentEvents } from '~/lib/partner_content_history'
import { render } from '~/tests/test_utils'

const put = vi.mocked(router.put)

const base = {
  kind: 'experiences' as const,
  contentId: 7,
  title: 'Degustaçao de cafés',
  description: null,
  startsAt: null,
  endsAt: null,
  priceCents: null,
  timeZone: 'America/Sao_Paulo',
}

describe('PartnerContentAdminEditor', () => {
  beforeEach(() => put.mockReset())

  it('says before saving that a published item changes for the public at once', () => {
    render(<PartnerContentAdminEditor {...base} status="published" />)

    fireEvent.click(screen.getByRole('button', { name: /Corrigir/ }))

    expect(screen.getByTestId('admin-edit-7-effect')).toHaveTextContent(
      /visível ao público assim que for salva/
    )
  })

  it('says a draft stays where the partner left it', () => {
    render(<PartnerContentAdminEditor {...base} status="draft" />)

    fireEvent.click(screen.getByRole('button', { name: /Corrigir/ }))

    expect(screen.getByTestId('admin-edit-7-effect')).toHaveTextContent(
      /continua onde o parceiro o deixou/
    )
  })

  it('sends the correction to the backoffice route, without empty text', () => {
    render(<PartnerContentAdminEditor {...base} status="published" />)

    fireEvent.click(screen.getByRole('button', { name: /Corrigir/ }))
    fireEvent.change(screen.getByLabelText('Título'), {
      target: { value: '  Degustação de cafés  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar correção' }))

    expect(put).toHaveBeenCalledWith(
      '/backoffice/content/experiences/7',
      { title: 'Degustação de cafés', description: null },
      expect.objectContaining({ preserveScroll: true })
    )
  })

  it('reads and writes event times in the city timezone', () => {
    render(
      <PartnerContentAdminEditor
        {...base}
        kind="events"
        status="pending_review"
        startsAt="2026-10-01T22:00:00.000Z"
        endsAt="2026-10-02T01:00:00.000Z"
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /Corrigir/ }))
    expect(screen.getByLabelText('Início')).toHaveValue('2026-10-01T19:00')

    fireEvent.change(screen.getByLabelText('Início'), { target: { value: '2026-10-01T20:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar correção' }))

    expect(put.mock.calls[0][1]).toMatchObject({
      starts_at: '2026-10-01T23:00:00.000Z',
      ends_at: '2026-10-02T01:00:00.000Z',
    })
  })

  it('offers nothing on archived content', () => {
    const { container } = render(<PartnerContentAdminEditor {...base} status="archived" />)

    expect(container).toBeEmptyDOMElement()
  })
})

describe('PartnerContentHistory', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  it('loads the history on demand, scoped to the operation, and lists who did what', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 2,
            action: 'admin_edited',
            from_status: 'published',
            to_status: 'published',
            actor: { id: 9, full_name: 'Moderadora' },
            changes: { title: { from: 'Degustaçao', to: 'Degustação' } },
            metadata: { republished: true },
            created_at: '2026-09-23T15:00:00.000Z',
          },
          {
            id: 1,
            action: 'created',
            from_status: null,
            to_status: 'draft',
            actor: { id: 3, full_name: 'Parceiro' },
            changes: null,
            metadata: null,
            created_at: '2026-09-22T15:00:00.000Z',
          },
        ],
      }),
    })

    render(
      <PartnerContentHistory tenantId={4} kind="experiences" contentId={7} timeZone={null} />
    )
    expect(fetchMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /Histórico/ }))

    await waitFor(() =>
      expect(screen.getByText(/Corrigido pela moderação · publicado na hora/)).toBeInTheDocument()
    )
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/admin/content/experiences/7/history',
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-tenant-id': '4' }),
      })
    )
    expect(screen.getByText(/Moderadora/)).toBeInTheDocument()
    expect(screen.getByText('Título: Degustaçao → Degustação')).toBeInTheDocument()
    expect(screen.getByText('Criado')).toBeInTheDocument()
  })

  it('says so when the history cannot be loaded', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) })

    render(
      <PartnerContentHistory tenantId={4} kind="experiences" contentId={7} timeZone={null} />
    )
    fireEvent.click(screen.getByRole('button', { name: /Histórico/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/Não foi possível/)
  })
})

describe('partner content history formatting', () => {
  it('names fields and formats money and empty values', () => {
    expect(
      describeChanges(
        {
          informational_price_cents: { from: null, to: 4500 },
          description: { from: 'Antes', to: null },
        },
        null
      )
    ).toEqual(['Preço informativo: — → R$ 45,00', 'Descrição: Antes → —'])
  })

  it('reads a malformed payload as less, never as a crash', () => {
    expect(partnerContentEvents(null)).toEqual([])
    expect(partnerContentEvents({ data: [null, 'x'] })).toEqual([])
  })
})
