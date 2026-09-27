import { afterEach, describe, expect, it } from 'vitest'

import { fileCategoryLabel, formatFileDate, formatFileSize } from '~/lib/file_presentation'

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

  it('writes sizes with the Brazilian decimal comma and no trailing zero', () => {
    expect(formatFileSize(16_998)).toBe('16,6 KB')
    expect(formatFileSize(16_384)).toBe('16 KB')
    expect(formatFileSize(10 * 1024 * 1024)).toBe('10 MB')
    expect(formatFileSize(512)).toBe('512 B')
    expect(formatFileSize(0)).toBe('0 B')
  })

  describe('sent date', () => {
    const originalZone = process.env.TZ
    afterEach(() => {
      process.env.TZ = originalZone
    })

    // Web audit W26: the server renders in UTC and the browser in Brasília; the
    // text must match or React discards the server HTML.
    it('reads the same on a UTC server and in a Brasília browser', () => {
      process.env.TZ = 'UTC'
      const onServer = formatFileDate('2026-09-26T02:30:00.000Z')
      process.env.TZ = 'America/Sao_Paulo'
      const inBrowser = formatFileDate('2026-09-26T02:30:00.000Z')

      expect(onServer).toBe(inBrowser)
      expect(onServer).toContain('23:30')
      expect(onServer).toContain('25 de set.')
    })

    it('shows a dash for a missing or broken date', () => {
      expect(formatFileDate(null)).toBe('—')
      expect(formatFileDate('not a date')).toBe('—')
    })
  })
})
