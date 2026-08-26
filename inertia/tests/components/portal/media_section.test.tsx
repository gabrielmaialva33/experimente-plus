import { describe, expect, it, vi } from 'vitest'

import { MediaSection } from '~/components/portal/establishment_editor/media_section'
import type { EstablishmentMediaEditor } from '~/components/portal/establishment_editor/use_media_editor'
import { render, screen } from '~/tests/test_utils'

function mediaEditor(overrides: Partial<EstablishmentMediaEditor> = {}): EstablishmentMediaEditor {
  return {
    busy: false,
    uploading: false,
    uploadError: null,
    uploadPurpose: 'gallery',
    uploadAsCover: false,
    uploadDraftDirty: false,
    mediaAction: null,
    mediaActionError: null,
    setUploadPurpose: vi.fn(),
    setUploadAsCover: vi.fn(),
    markUploadDraftDirty: vi.fn(),
    resetUploadDraft: vi.fn(),
    uploadMedia: vi.fn(),
    setMediaCover: vi.fn(async () => undefined),
    deleteMedia: vi.fn(async () => undefined),
    ...overrides,
  }
}

describe('MediaSection', () => {
  it('uses an accessible confirmation dialog before deleting an image', async () => {
    const editor = mediaEditor()
    const { user } = render(
      <MediaSection
        editable
        issues={[]}
        editor={editor}
        media={[
          {
            id: 7,
            purpose: 'gallery',
            moderation_status: 'approved',
            is_cover: false,
            alt_text: 'Fachada iluminada do estabelecimento',
            asset: {
              width: 1200,
              height: 900,
              file: { url: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' },
            },
          },
        ]}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Remover' }))

    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toHaveTextContent('Fachada iluminada do estabelecimento')
    expect(editor.deleteMedia).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /remover imagem/i }))
    expect(editor.deleteMedia).toHaveBeenCalledWith(7)
  })

  it('lets the user clear a pending upload draft without reloading the editor', async () => {
    const editor = mediaEditor({ uploadDraftDirty: true })
    const { user } = render(<MediaSection editable issues={[]} editor={editor} media={[]} />)

    await user.click(screen.getByRole('button', { name: 'Limpar formulário' }))
    expect(editor.resetUploadDraft).toHaveBeenCalledOnce()
  })
})
