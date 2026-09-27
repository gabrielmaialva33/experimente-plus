import { describe, expect, it } from 'vitest'

import { MANUAL_CHAPTERS, type ManualChapter } from '~/content/manual'
import { buildManualIndex, normalizeSearchText, searchManual } from '~/content/manual_search'

const index = buildManualIndex(MANUAL_CHAPTERS)
const ids = (query: string) => searchManual(index, query).map((result) => result.section.id)

describe('manual search', () => {
  it('ignores accents, case and the inline marks', () => {
    expect(normalizeSearchText('**Avaliação** [aqui](#x)  É')).toBe('avaliacao aqui e')
  })

  it('finds a task by the words people use, with or without accents', () => {
    expect(ids('validar')[0]).toBe('parceiro-validar')
    expect(ids('Validar QR camera')).toContain('app-validar')
    expect(ids('senha')).toContain('consumidor-senha')
    expect(ids('excluir conta')).toContain('consumidor-excluir-conta')
    expect(ids('iPhone')[0]).toBe('primeiros-passos-iphone')
  })

  it('needs every word of the query and puts title matches first', () => {
    const results = ids('perfil parceiro')
    expect(results[0]).toBe('perfil-parceiro')
    expect(ids('pix cancelar pedido')).toEqual(['app-comprar'])
  })

  it('answers nothing for an empty query or one letter, and nothing unknown', () => {
    expect(ids('')).toEqual([])
    expect(ids('a')).toEqual([])
    expect(ids('xylofone')).toEqual([])
  })

  it('caps the list and reports the chapter of each section', () => {
    const many = searchManual(index, 'como', 5)
    expect(many).toHaveLength(5)
    const first = searchManual(index, 'concierge')[0]
    expect(first.chapter.title).toBeTruthy()
    expect(first.section.title).toMatch(/Concierge/)
  })

  it('indexes the keywords of a section', () => {
    const chapters: ManualChapter[] = [
      {
        ...MANUAL_CHAPTERS[0],
        sections: [
          {
            id: 'teste',
            title: 'Seção',
            intro: 'Uma seção de teste.',
            blocks: [{ kind: 'paragraph', text: 'Texto.' }],
            keywords: ['palavra-chave'],
          },
        ],
      },
    ]
    expect(searchManual(buildManualIndex(chapters), 'palavra-chave')).toHaveLength(1)
  })
})
