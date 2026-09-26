import { test } from '@japa/runner'

import ConciergeQuotaService, {
  QUOTA_TIMEZONE,
} from '#modules/concierge/services/concierge_quota_service'

/**
 * The daily quota of the personal Concierge route — ADR-0029, revision of
 * 26/09/2026. The counting itself is proven against Redis in the functional
 * suite; here are the two decisions a live Redis cannot exercise.
 */
test.group('Concierge daily quota', () => {
  test('the day is the civil day in Brasília, not the UTC day', ({ assert }) => {
    const quota = new ConciergeQuotaService()
    assert.equal(QUOTA_TIMEZONE, 'America/Sao_Paulo')

    // 23:30 in Londrina on the 25th is already the 26th in UTC.
    const lateEvening = new Date('2026-09-26T02:30:00Z')
    assert.equal(quota.key(1, 7, lateEvening), 'concierge:quota:v1:1:7:2026-09-25')

    const afterMidnight = new Date('2026-09-26T03:05:00Z')
    assert.equal(quota.key(1, 7, afterMidnight), 'concierge:quota:v1:1:7:2026-09-26')
  })

  test('the key belongs to one person of one operation', ({ assert }) => {
    const quota = new ConciergeQuotaService()
    const now = new Date('2026-09-26T15:00:00Z')
    const keys = new Set([quota.key(1, 7, now), quota.key(2, 7, now), quota.key(1, 8, now)])
    assert.equal(keys.size, 3)
  })

  test('without Redis it fails closed: no unit is granted, so no model is called', async ({
    assert,
  }) => {
    const unavailable = {
      multi: () => {
        throw new Error('connection refused')
      },
    } as unknown as ConstructorParameters<typeof ConciergeQuotaService>[0]

    const granted = await new ConciergeQuotaService(unavailable).consume(1, 7, 20)
    assert.isFalse(granted)
  })
})
