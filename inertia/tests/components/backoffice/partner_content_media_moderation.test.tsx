import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PartnerContentMediaModeration } from '~/components/backoffice/partner_content_media_moderation'
import type { PartnerContentMediaItem } from '~/lib/partner_content_media'
import { render } from '~/tests/test_utils'

const mocks = vi.hoisted(() => ({
  reload: vi.fn(),
}))

vi.mock('@inertiajs/react', () => ({
  router: {
    reload: mocks.reload,
  },
}))

const pendingMedia: PartnerContentMediaItem = {
  id: 77,
  isCover: true,
  sortOrder: 0,
  altText: 'Palco preparado para o evento',
  caption: null,
  moderationStatus: 'pending',
  reviewNotes: null,
  asset: {
    id: 67,
    url: 'https://example.com/event.jpg',
    width: 1200,
    height: 800,
    mimeType: 'image/jpeg',
  },
}

describe('PartnerContentMediaModeration', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    mocks.reload.mockReset()
    mocks.reload.mockImplementation((options: { onFinish?: () => void }) => options.onFinish?.())
  })

  it('approves a pending image independently from the content decision', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: 77, moderation_status: 'approved' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const { user } = render(
      <PartnerContentMediaModeration
        tenantId={7}
        kind="events"
        contentId={22}
        media={[pendingMedia]}
        canApprove
        canReject
      />
    )

    await user.click(screen.getByRole('button', { name: 'Aprovar imagem' }))

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/admin/content/events/22/media/77/approve',
      expect.objectContaining({
        method: 'POST',
        body: '{}',
      })
    )
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(new Headers(options.headers).get('x-tenant-id')).toBe('7')
    // The queue page takes `sections` and `counts`; reloading anything else refreshed nothing.
    expect(mocks.reload).toHaveBeenCalledWith(
      expect.objectContaining({ only: ['sections', 'counts'] })
    )
    expect(screen.getByRole('status')).toHaveTextContent(
      'Imagem aprovada. Ela já pode aparecer na descoberta pública.'
    )
  })

  it('requires and sends a concrete reason when rejecting media', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: 77, moderation_status: 'rejected' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const { user } = render(
      <PartnerContentMediaModeration
        tenantId={7}
        kind="events"
        contentId={22}
        media={[pendingMedia]}
        canApprove
        canReject
      />
    )

    await user.click(screen.getByRole('button', { name: 'Recusar imagem' }))
    const confirm = screen.getByRole('button', { name: 'Confirmar recusa' })
    expect(confirm).toBeDisabled()

    await user.type(
      screen.getByLabelText('Motivo da recusa'),
      'A imagem contém texto promocional ilegível.'
    )
    expect(confirm).toBeEnabled()
    await user.click(confirm)

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/v1/admin/content/events/22/media/77/reject')
    expect(JSON.parse(String(options.body))).toEqual({
      reason: 'A imagem contém texto promocional ilegível.',
    })
    expect(mocks.reload).toHaveBeenCalledWith(
      expect.objectContaining({ only: ['sections', 'counts'] })
    )
    expect(screen.getByRole('status')).toHaveTextContent(
      'Imagem recusada. O motivo volta para o parceiro.'
    )
  })

  it('clears the last confirmation when the next action starts', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: 77, moderation_status: 'approved' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const { user } = render(
      <PartnerContentMediaModeration
        tenantId={7}
        kind="events"
        contentId={22}
        media={[pendingMedia, { ...pendingMedia, id: 78, isCover: false }]}
        canApprove
        canReject
      />
    )

    await user.click(screen.getAllByRole('button', { name: 'Aprovar imagem' })[0])
    expect(screen.getByRole('status')).toHaveTextContent('Imagem aprovada.')

    await user.click(screen.getAllByRole('button', { name: 'Recusar imagem' })[1])
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('keeps a note on an approved image neutral and a refusal reason in red', () => {
    render(
      <PartnerContentMediaModeration
        tenantId={7}
        kind="events"
        contentId={22}
        media={[
          { ...pendingMedia, moderationStatus: 'approved', reviewNotes: 'Ilustração do catálogo' },
          {
            ...pendingMedia,
            id: 78,
            moderationStatus: 'rejected',
            reviewNotes: 'Mostra o rosto de um cliente',
          },
        ]}
        canApprove
        canReject
      />
    )

    expect(screen.getByText('Ilustração do catálogo').closest('p')).toHaveClass(
      'text-muted-foreground'
    )
    expect(screen.getByText('Mostra o rosto de um cliente').closest('p')).toHaveClass(
      'text-destructive'
    )
  })
})
