import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PartnerContentMediaManager } from '~/components/portal/partner_content_media_manager'
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

const approvedMedia: PartnerContentMediaItem = {
  id: 41,
  isCover: false,
  sortOrder: 0,
  altText: 'Mesa preparada para degustação',
  caption: 'Experiência da casa',
  moderationStatus: 'approved',
  reviewNotes: null,
  asset: {
    id: 31,
    url: 'https://example.com/photo.jpg',
    width: 1200,
    height: 800,
    mimeType: 'image/jpeg',
  },
}

describe('PartnerContentMediaManager', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    mocks.reload.mockReset()
    mocks.reload.mockImplementation((options: { onFinish?: () => void }) => options.onFinish?.())
  })

  it('uploads multipart media with tenant context and accessible metadata', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: 42 }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const { user } = render(
      <PartnerContentMediaManager tenantId={7} kind="events" contentId={22} media={[]} editable />
    )

    expect(screen.queryByText(/0 imagens/)).not.toBeInTheDocument()
    const file = new File(['image-bytes'], 'jazz.jpg', { type: 'image/jpeg' })
    await user.upload(screen.getByLabelText(/^Imagem/), file)
    await user.type(
      screen.getByLabelText(/^Texto alternativo/),
      'Músicos tocando no salão principal'
    )
    await user.type(screen.getByLabelText('Legenda'), 'Noite de jazz')
    await user.click(screen.getByRole('button', { name: 'Enviar imagem' }))

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/v1/portal/content/events/22/media')
    expect(options.method).toBe('POST')
    expect(new Headers(options.headers).get('x-tenant-id')).toBe('7')

    const body = options.body as FormData
    const uploaded = body.get('file') as File
    expect(uploaded.name).toBe(file.name)
    expect(uploaded.type).toBe(file.type)
    expect(uploaded.size).toBe(file.size)
    expect(body.get('alt_text')).toBe('Músicos tocando no salão principal')
    expect(body.get('caption')).toBe('Noite de jazz')
    expect(mocks.reload).toHaveBeenCalledWith(expect.objectContaining({ only: ['content'] }))
  })

  it('selects a non-rejected image as the content cover', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: approvedMedia.id, is_cover: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const { user } = render(
      <PartnerContentMediaManager
        tenantId={7}
        kind="experiences"
        contentId={15}
        media={[approvedMedia]}
        editable
      />
    )

    expect(screen.getByRole('img', { name: 'Mesa preparada para degustação' })).toHaveAttribute(
      'src',
      approvedMedia.asset.url
    )

    await user.click(screen.getByRole('button', { name: 'Definir capa' }))

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/portal/content/experiences/15/media/41/cover',
      expect.objectContaining({
        method: 'PATCH',
        credentials: 'same-origin',
      })
    )
  })

  it('keeps the upload form behind a button once the item has an image', async () => {
    const { user } = render(
      <PartnerContentMediaManager
        tenantId={7}
        kind="events"
        contentId={22}
        media={[approvedMedia]}
        editable
      />
    )

    expect(screen.queryByRole('button', { name: 'Enviar imagem' })).not.toBeInTheDocument()
    const add = screen.getByRole('button', { name: 'Adicionar imagem' })
    expect(add).toHaveAttribute('aria-expanded', 'false')

    await user.click(add)
    expect(screen.getByRole('button', { name: 'Enviar imagem' })).toBeInTheDocument()
    // The button that opened the form is gone, so focus moves into the form.
    expect(screen.getByLabelText(/^Imagem/)).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('button', { name: 'Enviar imagem' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Adicionar imagem' })).toHaveFocus()
  })

  it('draws a moderation note as an error only for a refused or quarantined image', () => {
    render(
      <PartnerContentMediaManager
        tenantId={7}
        kind="events"
        contentId={22}
        media={[
          { ...approvedMedia, reviewNotes: 'Ilustração do catálogo de demonstração' },
          {
            ...approvedMedia,
            id: 42,
            altText: 'Foto recusada',
            moderationStatus: 'rejected',
            reviewNotes: 'Imagem com dados pessoais',
          },
        ]}
        editable={false}
      />
    )

    expect(screen.getByText('Ilustração do catálogo de demonstração').closest('p')).toHaveClass(
      'text-muted-foreground'
    )
    expect(screen.getByText('Imagem com dados pessoais').closest('p')).toHaveClass(
      'text-destructive'
    )
  })
})
