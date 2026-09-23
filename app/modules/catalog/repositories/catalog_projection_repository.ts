import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

/**
 * Writing to the projection's version counter.
 *
 * Reads live in `CatalogSearchRepository`; this is the other half, and it exists
 * because every public catalogue cache key carries `projection_version`
 * (ADR-0016 §5). A publication that does not bump it is a publication the
 * discovery surfaces cannot see: the key does not change, so the old value keeps
 * being served until the TTL expires. The function itself is already in the
 * database — `catalog_bump_tenant_version(integer)`, created with the projection
 * — so nothing new is introduced here and no migration is required.
 */
export default class CatalogProjectionRepository {
  /**
   * The bump takes the caller's transaction on purpose.
   *
   * It must commit with the state change that justified it. Bumping outside the
   * transaction would either advertise a publication that later rolled back, or
   * leave a committed publication invisible if the bump failed on its own.
   *
   * The granularity is the operation, not the establishment. ADR-0028 §5 asks
   * for the establishment's projection to be invalidated; this over-invalidates
   * to the whole tenant, which is coarser and strictly safe — a city agenda
   * spans many establishments, so an item appearing in it has to invalidate keys
   * that are not keyed by any single unit. Per-establishment invalidation would
   * need a key dimension the cache does not have today.
   */
  async bumpTenantVersion(tenantId: number, client: TransactionClientContract): Promise<void> {
    await client.rawQuery('SELECT catalog_bump_tenant_version(?)', [tenantId])
  }
}
