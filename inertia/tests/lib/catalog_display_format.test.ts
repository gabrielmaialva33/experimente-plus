import { describe, expect, it } from 'vitest'

import { formatCatalogAttributeValue, formatPhoneBR, formatPostalCodeBR } from '~/lib/catalog'

// W84 of the web audit: the server stores digits, people read masks.
describe('catalog display formatting', () => {
  it.each([
    ['43999998888', '(43) 99999-8888'],
    ['4333214343', '(43) 3321-4343'],
    ['5543999998888', '(43) 99999-8888'],
    ['+55 43 3321-4343', '(43) 3321-4343'],
    ['(43) 3321-4343', '(43) 3321-4343'],
    ['08001234567', '0800 123 4567'],
  ])('formats the phone %s as %s', (input, expected) => {
    expect(formatPhoneBR(input)).toBe(expected)
  })

  it.each(['190', '3321-4343', '+1 415 555 0100', '0800123'])(
    'leaves %s as written rather than guessing a mask',
    (input) => {
      expect(formatPhoneBR(input)).toBe(input)
    }
  )

  it('keeps an absent phone absent', () => {
    expect(formatPhoneBR(null)).toBeNull()
    expect(formatPhoneBR('')).toBe('')
  })

  it.each([
    ['86010000', '86010-000'],
    ['86010-000', '86010-000'],
    ['86.010-000', '86010-000'],
  ])('formats the CEP %s as %s', (input, expected) => {
    expect(formatPostalCodeBR(input)).toBe(expected)
  })

  it('leaves a CEP of the wrong length and an absent one untouched', () => {
    expect(formatPostalCodeBR('8601')).toBe('8601')
    expect(formatPostalCodeBR(null)).toBeNull()
  })

  it.each([
    [{ type: 'decimal', unit: 'BRL', value: 42.5 }, 'R$\u00a042,50'],
    [{ type: 'decimal', unit: 'BRL', value: '42.5' }, 'R$\u00a042,50'],
    [{ type: 'decimal', unit: 'min', value: 7.25 }, '7,25 min'],
    [{ type: 'integer', unit: null, value: 1200 }, '1.200'],
    [{ type: 'text', unit: null, value: 'À mesa' }, 'À mesa'],
    [{ type: 'text', unit: 'lugares', value: 'Cerca de 40' }, 'Cerca de 40 lugares'],
    [{ type: 'boolean', unit: null, value: true }, 'Sim'],
    [{ type: 'text', unit: null, value: '' }, 'Não informado'],
  ])('reads the attribute %o as %s', (attribute, expected) => {
    expect(formatCatalogAttributeValue({ options: [], ...attribute })).toBe(expected)
  })

  it('lists chosen options before any raw value', () => {
    expect(
      formatCatalogAttributeValue({
        type: 'multi_select',
        unit: null,
        value: null,
        options: [
          { label: 'Pet friendly', value: 'pet' },
          { label: 'Wi-Fi', value: 'wifi' },
        ],
      })
    ).toBe('Pet friendly, Wi-Fi')
  })
})
