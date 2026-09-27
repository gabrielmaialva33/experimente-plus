import db from '@adonisjs/lucid/services/db'

/**
 * Removes an operation that a test committed outside the global transaction,
 * with everything it created: purchases and their ledger, benefits, reviews
 * and reports, places and their media, and the operation's people.
 *
 * Concurrency tests commit their fixtures on purpose — independent
 * transactions are the point of them — but whatever they leave behind shows
 * up in every later spec that reads across operations (user lists sorted by
 * name, catalog repairs that refresh every operation), so the suite would pass
 * once and fail on the next run against the same database. Call it from the
 * test's `cleanup` or the group's teardown.
 *
 * The purchase ledger is append-only in the schema: `purchase_events` and
 * `purchase_settlements` refuse UPDATE and DELETE through triggers. Only here,
 * for fixtures of the disposable test database, those two triggers are
 * disabled inside the cleanup transaction; the transaction re-enables them and
 * PostgreSQL rolls the change back with it if anything fails.
 */
export async function removeCommittedOperation(
  tenantId: number,
  userIds: readonly number[] = []
): Promise<void> {
  const users = [...new Set(userIds)]

  await db.transaction(async (trx) => {
    const purchases = await trx.from('purchases').where('tenant_id', tenantId).select('id')
    const purchaseIds = purchases.map((row) => String(row.id))

    if (purchaseIds.length > 0) {
      await trx.rawQuery('ALTER TABLE purchase_events DISABLE TRIGGER purchase_events_immutable')
      await trx.rawQuery(
        'ALTER TABLE purchase_settlements DISABLE TRIGGER purchase_settlements_immutable'
      )
      await trx.from('purchase_events').whereIn('purchase_id', purchaseIds).delete()
      await trx.from('purchase_settlements').where('tenant_id', tenantId).delete()
      await trx.rawQuery('ALTER TABLE purchase_events ENABLE TRIGGER purchase_events_immutable')
      await trx.rawQuery(
        'ALTER TABLE purchase_settlements ENABLE TRIGGER purchase_settlements_immutable'
      )

      await trx.from('purchase_commands').whereIn('purchase_id', purchaseIds).delete()
      await trx
        .from('purchase_webhooks')
        .where((query) =>
          query.whereIn('purchase_id', purchaseIds).orWhereIn(
            'resource_id',
            purchaseIds.map((id) => `fake_${id}`)
          )
        )
        .delete()
      await trx.from('purchase_financial_holds').where('tenant_id', tenantId).delete()
      await trx.from('purchase_refunds').where('tenant_id', tenantId).delete()
      await trx.from('purchase_fake_payments').whereIn('purchase_id', purchaseIds).delete()
      await trx.from('purchases').where('tenant_id', tenantId).delete()
    }

    if (users.length > 0) {
      await trx.from('audit_logs').whereIn('user_id', users).delete()
    }
    // Reports and reviews point at the reporter's and author's membership, which the
    // operation's removal would otherwise try to cascade first.
    await trx.from('content_reports').where('tenant_id', tenantId).delete()
    await trx.from('establishment_reviews').where('tenant_id', tenantId).delete()
    await trx.from('benefit_redemptions').where('tenant_id', tenantId).delete()
    await trx.from('benefit_accesses').where('tenant_id', tenantId).delete()
    await trx.from('benefit_offers').where('tenant_id', tenantId).delete()
    await trx.from('benefit_editions').where('tenant_id', tenantId).delete()
    // Media before the files it points at: the file reference restricts deletion.
    await trx.from('establishment_revision_media').where('tenant_id', tenantId).delete()
    await trx.from('media_assets').where('tenant_id', tenantId).delete()
    await trx.from('files').where('tenant_id', tenantId).delete()
    await trx
      .from('establishments')
      .where('tenant_id', tenantId)
      .update({ published_revision_id: null })
    await trx.from('establishments').where('tenant_id', tenantId).delete()
    await trx.from('tenants').where('id', tenantId).delete()
    if (users.length > 0) {
      await trx.from('users').whereIn('id', users).delete()
    }
  })
}

/** The people who belong to this operation and to no other: a fixture's own accounts. */
export async function usersOnlyIn(tenantId: number): Promise<number[]> {
  const rows = await db
    .from('user_tenants as own')
    .where('own.tenant_id', tenantId)
    .whereNotExists((query) =>
      query
        .from('user_tenants as other')
        .whereColumn('other.user_id', 'own.user_id')
        .whereNot('other.tenant_id', tenantId)
    )
    .select('own.user_id')
  return rows.map((row) => Number(row.user_id))
}
