import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import type IBenefitSavings from '#modules/benefits/interfaces/benefit_savings_interface'
import type BenefitRedemptionRepository from '#modules/benefits/repositories/benefit_redemption_repository'
import BenefitSavingsService, {
  totals,
  valueOfUse,
} from '#modules/benefits/services/benefit_savings_service'
import type EstablishmentRevisionAttributeValueRepository from '#modules/establishments/repositories/establishment_revision_attribute_value_repository'

const NOW = DateTime.fromISO('2026-10-13T12:00:00Z', { zone: 'utc' })

let nextId = 1

function row(
  overrides: Partial<IBenefitSavings.RedemptionRow> = {}
): IBenefitSavings.RedemptionRow {
  return {
    id: nextId++,
    edition_id: 1,
    establishment_id: 10,
    establishment_name_snapshot: 'Café Aurora',
    benefit_type_snapshot: 'custom',
    redeemed_at: new Date('2026-09-01T15:00:00Z'),
    offer_benefit_type: 'custom',
    discount_percentage: null,
    discount_amount_cents: null,
    edition_name: 'Experimente Londrina 2026',
    edition_usage_starts_at: new Date('2026-03-01T03:00:00Z'),
    edition_usage_ends_at: new Date('2027-02-28T03:00:00Z'),
    city_timezone: 'America/Sao_Paulo',
    ...overrides,
  }
}

const percentage = (value: number, extra: Partial<IBenefitSavings.RedemptionRow> = {}) =>
  row({
    benefit_type_snapshot: 'percentage',
    offer_benefit_type: 'percentage',
    discount_percentage: value,
    ...extra,
  })

const fixed = (cents: number, extra: Partial<IBenefitSavings.RedemptionRow> = {}) =>
  row({
    benefit_type_snapshot: 'fixed_amount',
    offer_benefit_type: 'fixed_amount',
    discount_amount_cents: cents,
    ...extra,
  })

function service(rows: IBenefitSavings.RedemptionRow[], tickets: Record<number, number> = {}) {
  const requested: number[][] = []
  const redemptions = {
    async listSavingsRowsForHolder() {
      return rows
    },
  } as unknown as BenefitRedemptionRepository
  const attributes = {
    async listPublishedNumericValues(_tenantId: number, ids: readonly number[], key: string) {
      requested.push([...ids])
      if (key !== 'average_ticket') throw new Error(`unexpected attribute ${key}`)
      return new Map(Object.entries(tickets).map(([id, value]) => [Number(id), value]))
    },
  } as unknown as EstablishmentRevisionAttributeValueRepository
  return { savings: new BenefitSavingsService(redemptions, attributes), requested }
}

test.group('Benefit savings', () => {
  test('values each use by the type it had', ({ assert }) => {
    const tickets = new Map([[10, 42.5]])

    assert.deepEqual(valueOfUse(fixed(1500), tickets), { kind: 'exact', cents: 1500 })
    assert.deepEqual(valueOfUse(percentage(20), tickets), { kind: 'estimated', cents: 850 })
    // 15% of R$ 42,50 is R$ 6,375: rounded to the cent.
    assert.deepEqual(valueOfUse(percentage(15), tickets), { kind: 'estimated', cents: 638 })
    assert.deepEqual(valueOfUse(percentage(20, { establishment_id: 11 }), tickets), {
      kind: 'without_estimate',
    })
    // The offer changed type after the use: its value can no longer be read.
    assert.deepEqual(
      valueOfUse(
        fixed(1500, { offer_benefit_type: 'percentage', discount_amount_cents: null }),
        tickets
      ),
      { kind: 'without_estimate' }
    )
    assert.deepEqual(valueOfUse(percentage(20, { offer_benefit_type: 'fixed_amount' }), tickets), {
      kind: 'without_estimate',
    })
    for (const type of ['buy_one_get_one', 'complimentary_item', 'custom'] as const) {
      assert.deepEqual(
        valueOfUse(row({ benefit_type_snapshot: type, offer_benefit_type: type }), tickets),
        { kind: 'no_money' }
      )
    }
  })

  test('lists at most three places, the most visited first and ties by name', ({ assert }) => {
    const rows = [
      row({ establishment_id: 1, establishment_name_snapshot: 'Zeca Bar' }),
      row({ establishment_id: 2, establishment_name_snapshot: 'Ana Café' }),
      row({ establishment_id: 3, establishment_name_snapshot: 'Bistrô' }),
      row({ establishment_id: 3, establishment_name_snapshot: 'Bistrô (nome antigo)' }),
      row({ establishment_id: 4, establishment_name_snapshot: 'Ébano' }),
    ]

    const result = totals(rows, new Map())
    assert.equal(result.places_visited, 4)
    assert.equal(result.benefits_used, 5)
    // The newest use names the place: rows arrive newest first.
    assert.deepEqual(result.top_places, [
      { name: 'Bistrô', visits: 2 },
      { name: 'Ana Café', visits: 1 },
      { name: 'Ébano', visits: 1 },
    ])
  })

  test('splits current and past editions and names the year on the city clock', async ({
    assert,
  }) => {
    const rows = [
      fixed(1000, { edition_id: 1, redeemed_at: new Date('2026-10-01T15:00:00Z') }),
      // Opens at 23:00 of 31 December in Londrina: an edition of 2024, not 2025.
      percentage(50, {
        edition_id: 2,
        edition_name: 'Experimente Londrina 2024',
        edition_usage_starts_at: new Date('2025-01-01T02:00:00Z'),
        edition_usage_ends_at: new Date('2025-12-31T02:00:00Z'),
        redeemed_at: new Date('2025-02-01T15:00:00Z'),
      }),
      // Same year as the one above, in another city: the later use comes first.
      fixed(700, {
        edition_id: 3,
        establishment_id: 20,
        edition_name: 'Experimente Maringá 2024',
        edition_usage_starts_at: new Date('2024-04-01T03:00:00Z'),
        edition_usage_ends_at: new Date('2025-03-31T03:00:00Z'),
        redeemed_at: new Date('2025-03-01T15:00:00Z'),
      }),
    ]

    const { savings, requested } = service(rows, { 10: 30 })
    const result = await savings.forHolder(1, 1, NOW)

    assert.deepEqual(requested, [[10, 20]])
    assert.equal(result.currency, 'BRL')
    assert.deepEqual(result.current.editions, [
      { id: 1, name: 'Experimente Londrina 2026', year: 2026 },
    ])
    assert.equal(result.current.savings_exact_cents, 1000)
    assert.deepEqual(
      result.past.map((past) => [past.edition.name, past.edition.year]),
      [
        ['Experimente Maringá 2024', 2024],
        ['Experimente Londrina 2024', 2024],
      ]
    )
    assert.equal(result.past[1].savings_estimated_cents, 1500)
  })

  test('names the year on the pilot clock when the city zone is unreadable', async ({ assert }) => {
    const rows = [
      fixed(500, {
        city_timezone: 'Nowhere/Unknown',
        edition_usage_starts_at: new Date('2027-01-01T02:00:00Z'),
      }),
    ]
    const result = await service(rows).savings.forHolder(1, 1, NOW)
    assert.equal(result.current.editions[0].year, 2026)
  })

  test('keeps an edition current until its usage window closes', async ({ assert }) => {
    const closing = fixed(500, { edition_usage_ends_at: NOW.plus({ minutes: 1 }).toJSDate() })
    const closed = fixed(500, {
      edition_id: 2,
      edition_usage_ends_at: NOW.minus({ minutes: 1 }).toJSDate(),
    })

    const result = await service([closing, closed]).savings.forHolder(1, 1, NOW)
    assert.equal(result.current.benefits_used, 1)
    assert.deepEqual(
      result.past.map((past) => past.edition.id),
      [2]
    )
  })
})
