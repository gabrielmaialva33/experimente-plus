import { describe, expect, it } from 'vitest'

import { centsToReais, isoToZonedLocal, reaisToCents, zonedLocalToIso } from '~/lib/partner_content'

describe('partner content time and money helpers', () => {
  it('resolves datetime-local values in the establishment timezone, not the browser timezone', () => {
    expect(zonedLocalToIso('2026-09-20T19:30', 'America/Sao_Paulo')).toBe(
      '2026-09-20T22:30:00.000Z'
    )
    expect(isoToZonedLocal('2026-09-20T22:30:00.000Z', 'America/Sao_Paulo')).toBe(
      '2026-09-20T19:30'
    )
  })

  it('fails closed for invalid timezone input', () => {
    expect(zonedLocalToIso('2026-09-20T19:30', 'Parana/Invalid')).toBeNull()
    expect(isoToZonedLocal('2026-09-20T22:30:00.000Z', 'Parana/Invalid')).toBe('')
  })

  it('round-trips informational BRL values without creating a purchase amount contract', () => {
    expect(reaisToCents('129,90')).toBe(12990)
    expect(centsToReais(12990)).toBe('129,90')
    expect(reaisToCents('')).toBeNull()
    expect(reaisToCents('-1')).toBeNull()
  })
})
