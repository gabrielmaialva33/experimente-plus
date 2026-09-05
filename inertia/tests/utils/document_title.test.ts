import { describe, expect, it } from 'vitest'

import { formatDocumentTitle } from '~/app/document_title'

describe('formatDocumentTitle', () => {
  it('formats a page title with the application brand', () => {
    expect(formatDocumentTitle('Página não encontrada', 'Experimente+')).toBe(
      'Página não encontrada - Experimente+'
    )
  })

  it('does not duplicate a brand already present in the page title', () => {
    expect(
      formatDocumentTitle('Experimente+ — Lugares e serviços da sua região', 'Experimente+')
    ).toBe('Experimente+ — Lugares e serviços da sua região')
    expect(formatDocumentTitle('Sobre Experimente+', 'Experimente+')).toBe('Sobre Experimente+')
  })

  it('falls back to the application name when a page has no title', () => {
    expect(formatDocumentTitle('   ', 'Experimente+')).toBe('Experimente+')
    expect(formatDocumentTitle('', '   ')).toBe('Experimente+')
  })
})
