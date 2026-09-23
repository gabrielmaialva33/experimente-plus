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
    expect(mocks.reload).toHaveBeenCalledWith(expect.objectContaining({ only: ['items'] }))
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
  })
})
