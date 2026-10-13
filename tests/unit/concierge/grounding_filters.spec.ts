import { test } from '@japa/runner'

import IConcierge from '#modules/concierge/interfaces/concierge_interface'
import {
  contentGroundingQuery,
  establishmentGroundingQuery,
  groundingFilterPredicates,
} from '#modules/concierge/repositories/catalog_grounding_repository'

const now = new Date('2026-10-12T15:00:00.000Z')

/** The SQL of a query with its whitespace folded, for comparing two builds. */
const folded = (sql: string) => sql.replace(/\s+/g, ' ').trim()

test.group('Concierge filters — predicates', () => {
  test('no filter, or an empty one, adds nothing to the query', ({ assert }) => {
    for (const filters of [undefined, null, {}, { kind: [], price: [] }, { open_now: false }]) {
      const predicates = groundingFilterPredicates({ filters, now, openNow: 'place' })
      assert.deepEqual(predicates, { sql: [], bindings: [] }, JSON.stringify(filters))
    }

    const plain = establishmentGroundingQuery({ tenantId: 7, citySlug: 'londrina', limit: 20 })
    const empty = establishmentGroundingQuery({
      tenantId: 7,
      citySlug: 'londrina',
      limit: 20,
      filters: { kind: [], price: [] },
      now,
    })
    assert.equal(folded(empty.sql), folded(plain.sql))
    assert.deepEqual(empty.bindings, plain.bindings)
    assert.deepEqual(plain.bindings, [7, 'londrina', 20])
  })

  test('every value is a binding, in the order of the text', ({ assert }) => {
    const { sql, bindings } = groundingFilterPredicates({
      filters: {
        open_now: true,
        kind: ['leisure', 'food'],
        min_rating: 4,
        price: ['50_100', 'up_to_50'],
      },
      now,
      openNow: 'place',
    })

    assert.lengthOf(sql, 4)
    assert.include(sql[0], 'catalog_is_open_now(')
    assert.include(sql[0], 'place.city_timezone')
    assert.include(sql[1], 'family_match.family_slug = ANY(?::text[])')
    assert.equal(sql[2], 'place.reviews_average >= ?')
    assert.include(sql[3], "ticket->>'key' = ?")
    assert.deepEqual(bindings, [
      now,
      ['cultura-e-lazer', 'ar-livre-e-esportes', 'comer-e-beber'],
      4,
      IConcierge.AVERAGE_TICKET_ATTRIBUTE_KEY,
      50,
      100,
      50,
    ])
    // One placeholder per binding: nothing the person sent is spliced into SQL.
    const placeholders = sql.join(' ').match(/\?/g) ?? []
    assert.lengthOf(placeholders, bindings.length)
  })

  test('maps every kind onto family slugs, and the families onto one kind each', ({ assert }) => {
    assert.sameMembers(Object.keys(IConcierge.KIND_FAMILY_SLUGS), [...IConcierge.FILTER_KINDS])
    const slugs = Object.values(IConcierge.KIND_FAMILY_SLUGS).flat()
    assert.equal(new Set(slugs).size, slugs.length, 'a family belongs to a single kind')
    assert.sameMembers(slugs, [
      'comer-e-beber',
      'cultura-e-lazer',
      'ar-livre-e-esportes',
      'bem-estar-e-estilo',
      'servicos-locais',
    ])
  })

  test('the price buckets meet without a gap or an overlap', ({ assert }) => {
    const matches = (reais: number) =>
      IConcierge.PRICE_BUCKETS.filter((bucket) => {
        const { above, upTo } = IConcierge.PRICE_BUCKET_BOUNDS[bucket]
        return (above === null || reais > above) && (upTo === null || reais <= upTo)
      })

    for (const reais of [0, 12.5, 50, 50.01, 99.9, 100, 100.01, 480]) {
      assert.lengthOf(matches(reais), 1, `R$ ${reais}`)
    }
    assert.deepEqual(matches(50), ['up_to_50'])
    assert.deepEqual(matches(100), ['50_100'])
  })

  test('an event is open now by its own window, not by its host hours', ({ assert }) => {
    const event = groundingFilterPredicates({
      filters: { open_now: true },
      now,
      openNow: 'event_window',
    })
    assert.deepEqual(event.sql, [`(content.published_snapshot->>'starts_at')::timestamptz <= ?`])
    assert.deepEqual(event.bindings, [now])

    const query = contentGroundingQuery({
      kind: 'event',
      tenantId: 7,
      citySlug: 'londrina',
      limit: 5,
      now,
      filters: { open_now: true, min_rating: 4 },
    })
    assert.notInclude(query.sql, 'catalog_is_open_now(')
    assert.deepEqual(query.bindings, [7, 7, now, 'londrina', now, 4, 5])

    const experiences = contentGroundingQuery({
      kind: 'experience',
      tenantId: 7,
      citySlug: null,
      limit: 5,
      now,
      filters: { open_now: true },
    })
    assert.include(experiences.sql, 'catalog_is_open_now(')
    assert.deepEqual(experiences.bindings, [7, 7, now, 5])
  })

  test('filters narrow before the interests reorder', ({ assert }) => {
    const query = establishmentGroundingQuery({
      tenantId: 7,
      citySlug: null,
      limit: 20,
      preferredCategoryIds: [3],
      filters: { kind: ['food'] },
      now,
    })

    assert.isBelow(query.sql.indexOf('WHERE'), query.sql.indexOf('ORDER BY'))
    assert.deepEqual(query.bindings, [7, ['comer-e-beber'], [3], 20])
  })
})
