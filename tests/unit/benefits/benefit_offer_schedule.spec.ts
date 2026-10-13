import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import {
  usableLaterToday,
  weekdayBit,
  type OfferSchedule,
} from '#modules/benefits/utils/benefit_offer_schedule'

const SAO_PAULO = 'America/Sao_Paulo'
const SUNDAY = 1
const MONDAY = 2
const TUESDAY = 4
const SATURDAY = 64

const at = (iso: string) => DateTime.fromISO(iso, { zone: SAO_PAULO })

const edition = {
  usage_starts_at: at('2026-10-01T00:00:00'),
  usage_ends_at: at('2026-12-31T23:59:59'),
}

const offer = (overrides: Partial<OfferSchedule> = {}): OfferSchedule => ({
  available_weekdays_mask: 127,
  daily_start_time: null,
  daily_end_time: null,
  starts_at: null,
  ends_at: null,
  ...overrides,
})

test.group('Benefit offer schedule', () => {
  test('numbers the weekdays from Sunday, as the mask and PostgreSQL do', ({ assert }) => {
    // 2026-10-11 is a Sunday, 2026-10-12 a Monday, 2026-10-17 a Saturday.
    assert.equal(weekdayBit(at('2026-10-11T12:00:00')), SUNDAY)
    assert.equal(weekdayBit(at('2026-10-12T12:00:00')), MONDAY)
    assert.equal(weekdayBit(at('2026-10-13T12:00:00')), TUESDAY)
    assert.equal(weekdayBit(at('2026-10-17T12:00:00')), SATURDAY)
  })

  test('reads today in the city timezone, not in UTC, near midnight', ({ assert }) => {
    // 01:30 UTC on Tuesday is still 22:30 on Monday in São Paulo.
    const lateMonday = DateTime.fromISO('2026-10-13T01:30:00Z')
    assert.isTrue(
      usableLaterToday(offer({ available_weekdays_mask: MONDAY }), edition, SAO_PAULO, lateMonday)
    )
    assert.isFalse(
      usableLaterToday(offer({ available_weekdays_mask: TUESDAY }), edition, SAO_PAULO, lateMonday)
    )

    // 03:05 UTC on Tuesday is 00:05 on Tuesday there: the day has turned.
    const earlyTuesday = DateTime.fromISO('2026-10-13T03:05:00Z')
    assert.isFalse(
      usableLaterToday(offer({ available_weekdays_mask: MONDAY }), edition, SAO_PAULO, earlyTuesday)
    )
    assert.isTrue(
      usableLaterToday(
        offer({ available_weekdays_mask: TUESDAY }),
        edition,
        SAO_PAULO,
        earlyTuesday
      )
    )
  })

  test('keeps the last minute of the day and of the daily window usable', ({ assert }) => {
    const lastMinute = at('2026-10-12T23:59:30')
    assert.isTrue(
      usableLaterToday(offer({ available_weekdays_mask: MONDAY }), edition, SAO_PAULO, lastMinute)
    )

    const lunch = offer({ daily_start_time: '11:00', daily_end_time: '14:00' })
    assert.isTrue(usableLaterToday(lunch, edition, SAO_PAULO, at('2026-10-12T09:00:00')))
    assert.isTrue(usableLaterToday(lunch, edition, SAO_PAULO, at('2026-10-12T14:00:59')))
    assert.isFalse(usableLaterToday(lunch, edition, SAO_PAULO, at('2026-10-12T14:01:00')))
  })

  test('refuses a day outside the edition or the offer windows', ({ assert }) => {
    const beforeEdition = at('2026-09-30T10:00:00')
    assert.isFalse(usableLaterToday(offer(), edition, SAO_PAULO, beforeEdition))

    // The edition opens tonight: what is left of today already reaches it.
    const openingTonight = {
      usage_starts_at: at('2026-10-12T19:00:00'),
      usage_ends_at: edition.usage_ends_at,
    }
    assert.isTrue(usableLaterToday(offer(), openingTonight, SAO_PAULO, at('2026-10-12T08:00:00')))

    const ended = offer({
      starts_at: at('2026-10-01T00:00:00'),
      ends_at: at('2026-10-12T12:00:00'),
    })
    assert.isTrue(usableLaterToday(ended, edition, SAO_PAULO, at('2026-10-12T11:59:00')))
    assert.isFalse(usableLaterToday(ended, edition, SAO_PAULO, at('2026-10-12T12:00:01')))

    const tomorrow = offer({
      starts_at: at('2026-10-13T00:00:00'),
      ends_at: at('2026-10-20T00:00:00'),
    })
    assert.isFalse(usableLaterToday(tomorrow, edition, SAO_PAULO, at('2026-10-12T22:00:00')))
  })
})
