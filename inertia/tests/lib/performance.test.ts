import { describe, expect, it } from 'vitest'

import {
  describeChange,
  describeRatingChange,
  formatCount,
  formatDayRange,
  formatEstimate,
  formatTicket,
  hasActivity,
  performancePath,
  type EstablishmentPerformance,
} from '~/lib/performance'

const zero = { current: 0, previous: 0 }

function performance(
  metrics: Partial<EstablishmentPerformance['metrics']> = {}
): EstablishmentPerformance {
  return {
    establishment: {
      id: 8,
      name: 'Café Central',
      organization_id: 4,
      organization_name: 'Grupo Central',
      published: true,
    },
    period: {
      key: 'current_month',
      from: '2026-10-01',
      to: '2026-10-13',
      previous_from: '2026-09-01',
      previous_to: '2026-09-13',
      days: 13,
      previous_days: 13,
    },
    periods: ['current_month', 'previous_month', 'last_90_days'],
    edition: null,
    metrics: {
      impressions: zero,
      views: zero,
      clicks: [{ channel: 'route', published: true, ...zero }],
      new_followers: zero,
      new_favorites: zero,
      redemptions: zero,
      reviews: { count: zero, average: { current: null, previous: null } },
      ...metrics,
    },
    estimate: { status: 'missing', field_available: true },
    trend: [],
  }
}

describe('performance numbers', () => {
  it('gives the change in percent and always says what the number was before', () => {
    expect(describeChange(50, 40)).toEqual({
      direction: 'up',
      label: '+25% · antes 40',
      description: 'Aumento de 25% em relação ao período anterior, que teve 40.',
    })
    expect(describeChange(36, 40)).toEqual({
      direction: 'down',
      label: '−10% · antes 40',
      description: 'Queda de 10% em relação ao período anterior, que teve 40.',
    })
    // Small moves keep one decimal instead of rounding to "0%".
    expect(describeChange(1003, 1000).label).toBe('+0,3% · antes 1.000')
  })

  it('never divides by an empty period', () => {
    expect(describeChange(3, 0)).toEqual({
      direction: 'up',
      label: 'Antes 0',
      description: 'Aumento: o período anterior teve 0.',
    })
    expect(describeChange(0, 0).direction).toBe('none')
    expect(describeChange(0, 0).label).toBe('Sem registros nos dois períodos')
    expect(describeChange(7, 7)).toMatchObject({ direction: 'same', label: 'Igual · antes 7' })
    expect(describeChange(0, 5)).toMatchObject({ direction: 'down', label: '−100% · antes 5' })
  })

  it('compares money with the money format', () => {
    expect(describeChange(850000, 425000, formatEstimate).label).toMatch(
      /^\+100% · antes R\$\s4\.250$/
    )
    expect(formatEstimate(850000)).toMatch(/^R\$\s8\.500$/)
    expect(formatTicket(4250)).toMatch(/^R\$\s42,50$/)
  })

  it('compares the average rating in points, and says when there is nothing to compare', () => {
    expect(describeRatingChange(4.5, 4)).toEqual({
      direction: 'up',
      label: '+0,5 · antes 4,0',
      description: 'Subiu 0,5 ponto em relação à nota média do período anterior, 4,0.',
    })
    expect(describeRatingChange(2, 4.5).description).toBe(
      'Caiu 2,5 pontos em relação à nota média do período anterior, 4,5.'
    )
    expect(describeRatingChange(4, 4).direction).toBe('same')
    expect(describeRatingChange(4.2, null).label).toBe('Sem nota no período anterior')
    expect(describeRatingChange(null, 3.8).label).toBe('Sem nota no período · antes 3,8')
    expect(describeRatingChange(null, null).direction).toBe('none')
  })

  it('writes periods the way people say them', () => {
    expect(formatDayRange('2026-10-01', '2026-10-13')).toBe('1 a 13 de out. de 2026')
    expect(formatDayRange('2026-09-24', '2026-10-03')).toBe('24 de set. a 3 de out. de 2026')
    expect(formatDayRange('2025-12-01', '2026-01-05')).toBe('1 de dez. de 2025 a 5 de jan. de 2026')
    expect(formatDayRange('2026-10-13', '2026-10-13')).toBe('13 de out. de 2026')
  })

  it('formats counts compactly only when they get long', () => {
    expect(formatCount(1234)).toBe('1.234')
    expect(formatCount(12345)).toMatch(/^12,3\smil$/)
  })

  it('knows whether anything happened in the period', () => {
    expect(hasActivity(performance())).toBe(false)
    expect(hasActivity(performance({ redemptions: { current: 1, previous: 0 } }))).toBe(true)
    // Only the previous period moved: this period is still empty.
    expect(hasActivity(performance({ views: { current: 0, previous: 9 } }))).toBe(false)
    expect(
      hasActivity(
        performance({ clicks: [{ channel: 'whatsapp', published: true, current: 2, previous: 0 }] })
      )
    ).toBe(true)
  })

  it('builds the page address with the period', () => {
    expect(performancePath(8)).toBe('/portal/establishments/8/performance')
    expect(performancePath(8, 'last_90_days')).toBe(
      '/portal/establishments/8/performance?period=last_90_days'
    )
  })
})
