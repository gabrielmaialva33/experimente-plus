import { describe, expect, it } from 'vitest'

import { formatCep, formatCnpj, formatPhoneBR } from '~/lib/br_format'

describe('Brazilian display formats', () => {
  it('formats landline and mobile numbers stored as digits', () => {
    expect(formatPhoneBR('4335421201')).toBe('(43) 3542-1201')
    expect(formatPhoneBR('43999824100')).toBe('(43) 99982-4100')
    expect(formatPhoneBR('5543999824100')).toBe('(43) 99982-4100')
  })

  it('keeps values that do not match a known shape as typed', () => {
    expect(formatPhoneBR('0800 123')).toBe('0800 123')
    expect(formatPhoneBR(null)).toBe('')
    expect(formatCep('8602')).toBe('8602')
  })

  it('formats postal codes and CNPJ', () => {
    expect(formatCep('86020030')).toBe('86020-030')
    expect(formatCep('86020-030')).toBe('86020-030')
    expect(formatCnpj('12345678000195')).toBe('12.345.678/0001-95')
    expect(formatCnpj(undefined)).toBe('')
  })
})
