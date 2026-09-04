import { describe, expect, it } from 'vitest'

import { fileCategoryLabel } from '~/lib/file_presentation'

describe('file presentation', () => {
  it('translates every file category emitted by the upload service', () => {
    expect(fileCategoryLabel('image')).toBe('Imagem')
    expect(fileCategoryLabel('document')).toBe('Documento')
    expect(fileCategoryLabel('video')).toBe('Vídeo')
    expect(fileCategoryLabel('audio')).toBe('Áudio')
    expect(fileCategoryLabel('file')).toBe('Arquivo')
  })

  it('uses a safe human fallback for an unknown category', () => {
    expect(fileCategoryLabel('future_category')).toBe('Arquivo')
  })
})
