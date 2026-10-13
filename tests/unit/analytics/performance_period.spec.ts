import { test } from '@japa/runner'

import {
  instantBounds,
  parsePerformancePeriod,
  performanceWindows,
  performanceZone,
  rangeLength,
} from '#modules/analytics/utils/performance_period'

test.group('Performance periods', () => {
  test('compares the month so far with the same days of the month before', ({ assert }) => {
    const windows = performanceWindows('current_month', '2026-10-13', null)

    assert.deepEqual(windows, {
      key: 'current_month',
      current: { from: '2026-10-01', to: '2026-10-13' },
      previous: { from: '2026-09-01', to: '2026-09-13' },
    })
    assert.equal(rangeLength(windows.current), 13)
    assert.equal(rangeLength(windows.previous), 13)
  })

  test('ends the comparison on the last day of a shorter month', ({ assert }) => {
    assert.deepEqual(performanceWindows('current_month', '2026-03-31', null).previous, {
      from: '2026-02-01',
      to: '2026-02-28',
    })
    assert.deepEqual(performanceWindows('current_month', '2028-03-30', null).previous, {
      from: '2028-02-01',
      to: '2028-02-29',
    })
    assert.deepEqual(performanceWindows('current_month', '2026-01-01', null), {
      key: 'current_month',
      current: { from: '2026-01-01', to: '2026-01-01' },
      previous: { from: '2025-12-01', to: '2025-12-01' },
    })
  })

  test('compares the previous month with the whole month before it', ({ assert }) => {
    assert.deepEqual(performanceWindows('previous_month', '2026-10-13', null), {
      key: 'previous_month',
      current: { from: '2026-09-01', to: '2026-09-30' },
      previous: { from: '2026-08-01', to: '2026-08-31' },
    })
    assert.deepEqual(performanceWindows('previous_month', '2026-01-05', null), {
      key: 'previous_month',
      current: { from: '2025-12-01', to: '2025-12-31' },
      previous: { from: '2025-11-01', to: '2025-11-30' },
    })
  })

  test('compares the last 90 days, today included, with the 90 days before', ({ assert }) => {
    const windows = performanceWindows('last_90_days', '2026-10-13', null)

    assert.deepEqual(windows, {
      key: 'last_90_days',
      current: { from: '2026-07-16', to: '2026-10-13' },
      previous: { from: '2026-04-17', to: '2026-07-15' },
    })
    assert.equal(rangeLength(windows.current), 90)
    assert.equal(rangeLength(windows.previous), 90)
  })

  test('runs the edition from its first day and compares as many days before it', ({ assert }) => {
    const edition = { starts_on: '2026-10-01', ends_on: '2026-12-31' }
    const windows = performanceWindows('current_edition', '2026-10-10', edition)

    assert.deepEqual(windows, {
      key: 'current_edition',
      current: { from: '2026-10-01', to: '2026-10-10' },
      previous: { from: '2026-09-21', to: '2026-09-30' },
    })

    // An edition already over stops on its last day.
    assert.deepEqual(performanceWindows('current_edition', '2027-01-15', edition).current, {
      from: '2026-10-01',
      to: '2026-12-31',
    })
  })

  test('falls back to the current month without a started edition', ({ assert }) => {
    assert.equal(performanceWindows('current_edition', '2026-10-13', null).key, 'current_month')
    assert.equal(
      performanceWindows('current_edition', '2026-10-13', {
        starts_on: '2026-10-20',
        ends_on: '2026-12-31',
      }).key,
      'current_month'
    )
  })

  test('reads an unknown period as the default', ({ assert }) => {
    assert.equal(parsePerformancePeriod('last_90_days'), 'last_90_days')
    assert.isUndefined(parsePerformancePeriod('last_year'))
    assert.isUndefined(parsePerformancePeriod(['current_month']))
    assert.isUndefined(parsePerformancePeriod(undefined))
  })

  test('turns local days into the instants of the city calendar', ({ assert }) => {
    assert.deepEqual(instantBounds({ from: '2026-10-01', to: '2026-10-13' }, 'America/Sao_Paulo'), {
      start: '2026-10-01T03:00:00.000Z',
      end: '2026-10-14T03:00:00.000Z',
    })
    assert.equal(performanceZone('America/Manaus', 'America/Sao_Paulo'), 'America/Manaus')
    assert.equal(performanceZone('Not/AZone', 'America/Sao_Paulo'), 'America/Sao_Paulo')
    assert.equal(performanceZone(null, 'America/Sao_Paulo'), 'America/Sao_Paulo')
  })
})
