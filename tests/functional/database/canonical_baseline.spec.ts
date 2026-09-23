import { readdir } from 'node:fs/promises'
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'

test.group('Canonical homologation baseline', () => {
  test('fresh bootstrap records exactly the executable baseline and canonical columns, indexes and triggers', async ({
    assert,
  }) => {
    const entries = await readdir(app.makePath('database/migrations'))
    const files = entries.filter((name) => name.endsWith('.ts')).sort()
    // Raise this deliberately, never to make a red suite green: the count is the
    // guard that a migration only joins the canonical baseline by decision.
    // 51 canonical + 4 from ADR-0027 + 1 for its revision + 4 from ADR-0028
    // + 1 for the review aggregates the projection owes ADR-0027 §7
    // + 1 for the media partner content assigns to its own items
    // + 5 for the Explorer's own layer of ADR-0030 (favourites, follows,
    // interests, itineraries and their stops)
    // + 2 for the ban of ADR-0027 §6 (its state on the membership and its
    // append-only history)
    // + 1 widening the report targets to partner content, as ADR-0028 decided.
    assert.lengthOf(files, 70)
    assert.isFalse(files.some((name) => /1788556800|178881480[123]/.test(name)))
    const history = await db.from('adonis_schema').select('name')
    assert.lengthOf(history, files.length)
    assert.sameMembers(
      history.map((row) => row.name.split('/').at(-1).replace(/\.ts$/, '')),
      files.map((f) => f.replace(/\.ts$/, ''))
    )
    const columns = await db
      .from('information_schema.columns')
      .where('table_schema', 'public')
      .whereIn('table_name', [
        'users',
        'purchases',
        'benefit_accesses',
        'benefit_offers',
        'purchase_webhooks',
      ])
      .select('table_name', 'column_name', 'data_type', 'is_nullable', 'column_default')
    const column = (table: string, name: string) =>
      columns.find((c) => c.table_name === table && c.column_name === name)
    assert.include(column('users', 'credential_version'), {
      data_type: 'integer',
      is_nullable: 'NO',
    })
    assert.equal(column('users', 'credential_version')!.column_default, '1')
    for (const table of ['purchases', 'benefit_accesses'])
      assert.include(column(table, 'offer_id'), { data_type: 'integer', is_nullable: 'YES' })
    assert.include(column('benefit_offers', 'standalone_price_cents'), {
      data_type: 'integer',
      is_nullable: 'YES',
    })
    assert.exists(column('purchase_webhooks', 'checked_at'))
    assert.equal(column('purchase_webhooks', 'attempts')!.column_default, '0')
    assert.exists(column('purchase_webhooks', 'issue'))
    const constraints = await db.rawQuery<{
      rows: Array<{ conname: string; convalidated: boolean }>
    }>(
      "SELECT conname, convalidated FROM pg_constraint WHERE connamespace = 'public'::regnamespace"
    )
    for (const name of [
      'benefit_accesses_offer_scope_foreign',
      'benefit_offers_scope_unique',
      'benefit_offers_standalone_price_check',
      'users_credential_version_positive_check',
      'users_email_lowercase_check',
      'benefit_redemptions_receipt_code_format_check',
    ]) {
      assert.isTrue(constraints.rows.find((c) => c.conname === name)?.convalidated)
    }
    const indexes = await db
      .from('pg_indexes')
      .where('schemaname', 'public')
      .select('indexname', 'indexdef')
    for (const name of ['benefit_accesses_active_holder_unique', 'purchases_live_holder_unique'])
      assert.include(indexes.find((i) => i.indexname === name)!.indexdef, 'COALESCE(offer_id, 0)')
    assert.include(
      indexes.find((i) => i.indexname === 'catalog_establishments_attribute_slugs_index')!.indexdef,
      'USING gin (attribute_slugs)'
    )
    const triggers = await db.rawQuery<{ rows: Array<{ tgname: string }> }>(
      'SELECT tgname FROM pg_trigger WHERE NOT tgisinternal'
    )
    for (const name of [
      'protect_benefit_access_scope',
      'validate_redemption_access_scope',
      'protect_purchase_identity',
      'protect_purchased_offer_terms',
      'protect_purchased_edition_terms',
      'purchase_events_immutable',
      'purchase_settlements_immutable',
    ])
      assert.include(
        triggers.rows.map((t) => t.tgname),
        name
      )
    assert.lengthOf(await db.from('roles').where('slug', 'editor'), 0)
  })
})
