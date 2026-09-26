import { describe, expect, it } from 'vitest'

import { dayMonthLabel, greeting, receivedLabel, todayOverline } from '~/lib/today'

describe('today', () => {
  it('writes the overline date on Brasília time, whatever the machine zone', () => {
    // 02:30 UTC on the 27th is still the evening of the 26th in Londrina.
    expect(todayOverline(new Date('2026-09-27T02:30:00Z'))).toBe('sábado, 26 de setembro')
    expect(todayOverline(new Date('2026-09-27T12:00:00Z'))).toBe('domingo, 27 de setembro')
  })

  it('greets by the hour in Brasília', () => {
    expect(greeting(new Date('2026-09-26T07:00:00Z'))).toBe('Boa noite')
    expect(greeting(new Date('2026-09-26T08:00:00-03:00'))).toBe('Bom dia')
    expect(greeting(new Date('2026-09-26T11:59:00-03:00'))).toBe('Bom dia')
    expect(greeting(new Date('2026-09-26T12:00:00-03:00'))).toBe('Boa tarde')
    expect(greeting(new Date('2026-09-26T18:00:00-03:00'))).toBe('Boa noite')
    expect(greeting(new Date('2026-09-26T04:59:00-03:00'))).toBe('Boa noite')
  })

  it('reads when an item arrived, saying "Hoje" for the current day in Brasília', () => {
    const now = new Date('2026-09-26T15:00:00-03:00')
    expect(receivedLabel('2026-09-26T11:13:00-03:00', now)).toBe('Hoje, 11:13')
    // 01:30 UTC on the 26th was still the 25th in Londrina.
    expect(receivedLabel('2026-09-26T01:30:00Z', now)).toBe('25/09, 22:30')
    expect(receivedLabel(null, now)).toBeNull()
    expect(receivedLabel('not a date', now)).toBeNull()
    expect(dayMonthLabel('2026-10-01T12:00:00-03:00')).toBe('01/10')
    expect(dayMonthLabel(null)).toBeNull()
  })
})
