import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import Establishment from '#modules/establishments/models/establishment'
import EstablishmentExperience from '#modules/partner_content/models/establishment_experience'
import EstablishmentEvent from '#modules/partner_content/models/establishment_event'
import EstablishmentShowcaseItem from '#modules/partner_content/models/establishment_showcase_item'
import PartnerContentPolicy from '#modules/partner_content/models/partner_content_policy'

test.group('Partner content models (ADR-0028)', () => {
  for (const [Model, table] of [
    [EstablishmentExperience, 'establishment_experiences'],
    [EstablishmentEvent, 'establishment_events'],
    [EstablishmentShowcaseItem, 'establishment_showcase_items'],
  ] as const) {
    test(`${table}: Lucid columns and relation reference the stable establishment`, ({
      assert,
    }) => {
      Model.boot()
      assert.equal(Model.table, table)
      assert.isTrue(Model.$getColumn('id')?.isPrimary)
      for (const name of [
        'tenant_id',
        'establishment_id',
        'created_by',
        'status',
        'title',
        'description',
      ]) {
        assert.equal(Model.$getColumn(name)?.columnName, name)
      }
      assert.isFalse(Model.$hasColumn('revision_id'))
      const relation = Model.$getRelation('establishment')!
      relation.boot()
      assert.equal(relation.relatedModel(), Establishment)
      assert.equal(relation.foreignKey, 'establishment_id')
    })

    test(`${table}: editing pending content preserves the approved snapshot`, ({ assert }) => {
      const content = new Model()
      content.title = 'Título aprovado'
      content.published_snapshot = { title: 'Título aprovado', description: 'Texto aprovado' }
      content.published_at = DateTime.fromISO('2026-09-15T12:00:00-03:00')
      content.status = 'published'
      content.title = 'Título em revisão'
      content.status = 'pending_review'
      assert.equal(content.published_snapshot.title, 'Título aprovado')
      assert.equal(content.title, 'Título em revisão')
      assert.isNotNull(content.published_at)
      assert.isFalse(Model.$hasColumn('deleted_at'))
      assert.isTrue(Model.$hasColumn('archived_at'))
      assert.isTrue(Model.$hasColumn('archived_by'))
    })
  }

  test('event dates serialize as instants independently of the server timezone', ({ assert }) => {
    const event = new EstablishmentEvent()
    event.starts_at = DateTime.fromISO('2026-10-10T21:00:00-03:00', { setZone: true })
    event.ends_at = DateTime.fromISO('2026-10-11T01:00:00-03:00', { setZone: true })
    const serialized = event.serialize()
    assert.equal(DateTime.fromISO(serialized.starts_at).toUTC().toISO(), '2026-10-11T00:00:00.000Z')
    assert.equal(DateTime.fromISO(serialized.ends_at).toUTC().toISO(), '2026-10-11T04:00:00.000Z')
    assert.isFalse(EstablishmentExperience.$hasColumn('starts_at'))
    assert.isFalse(EstablishmentShowcaseItem.$hasColumn('ends_at'))
  })

  test('showcase price serializes as nullable informational cents', ({ assert }) => {
    const item = new EstablishmentShowcaseItem()
    item.informational_price_cents = null
    assert.isNull(item.serialize().informational_price_cents)
    item.informational_price_cents = 2590
    assert.strictEqual(item.serialize().informational_price_cents, 2590)
    for (const column of ['offer_id', 'purchase_id', 'stock', 'quantity']) {
      assert.isFalse(EstablishmentShowcaseItem.$hasColumn(column))
    }
  })

  test('tenant policy maps exactly the five configurable parameters', ({ assert }) => {
    PartnerContentPolicy.boot()
    assert.equal(PartnerContentPolicy.table, 'partner_content_policies')
    assert.sameMembers(
      [...PartnerContentPolicy.$columnsDefinitions.keys()],
      [
        'id',
        'tenant_id',
        'require_experience_approval',
        'require_event_approval',
        'require_showcase_item_approval',
        'max_media_per_content',
        'min_event_notice_minutes',
        'created_at',
        'updated_at',
      ]
    )
    const policy = new PartnerContentPolicy()
    policy.require_event_approval = false
    policy.max_media_per_content = 12
    policy.min_event_notice_minutes = 120
    assert.include(policy.serialize(), {
      require_event_approval: false,
      max_media_per_content: 12,
      min_event_notice_minutes: 120,
    })
  })
})
