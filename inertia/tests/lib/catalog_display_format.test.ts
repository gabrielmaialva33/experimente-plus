import { describe, expect, it } from 'vitest'

import { formatPhoneBR, formatPostalCodeBR } from '~/lib/catalog'

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
})
