/**
 * One definition of "publicly discoverable establishment" — ADR-0016 §3.
 *
 * The projection of ADR-0016 is reconstructible, not authoritative: a row can
 * survive in it after the establishment behind it was suspended, its
 * organization deactivated, its published revision withdrawn or its city
 * deactivated. That is why the ADR requires every public read to revalidate the
 * critical states of the sources instead of trusting `is_discoverable` alone.
 *
 * The rule lives here, once, because it now has three consumers: the catalogue
 * itself, the partner-owned content of ADR-0028 and the Concierge grounding of
 * ADR-0029. Three private copies would drift apart precisely where the drift is
 * least visible — a withheld establishment reappearing through a side door.
 *
 * Known pendency: `catalog_search_repository` still carries its own inlined
 * `safe_catalog` CTE. That copy is fused with the sponsorship, category and
 * ranking predicates of the search query and cannot be swapped out without
 * PostgreSQL-backed regressions, so it is deliberately left alone rather than
 * refactored blind. The two definitions are identical today; folding the search
 * query into this module belongs to a slice that can run those suites.
 */

/**
 * The revalidation itself, as a `FROM ... WHERE` tail.
 *
 * The tenant is always a binding and never interpolated: the operation is
 * resolved from the trusted hostname (ADR-0003) and a visitor must never be
 * able to widen it.
 */
const SOURCE_REVALIDATION = `
  FROM catalog_establishments projection
  JOIN establishments establishment
    ON establishment.id = projection.establishment_id
   AND establishment.tenant_id = projection.tenant_id
   AND establishment.published_revision_id = projection.published_revision_id
   AND establishment.lifecycle_status = 'active'
  JOIN organizations organization
    ON organization.id = projection.organization_id
   AND organization.tenant_id = projection.tenant_id
   AND organization.status = 'active'
  JOIN establishment_revisions revision
    ON revision.id = projection.published_revision_id
   AND revision.tenant_id = projection.tenant_id
   AND revision.establishment_id = projection.establishment_id
   AND revision.status = 'approved'
  JOIN cities city
    ON city.id = projection.city_id
   AND city.tenant_id = projection.tenant_id
   AND city.is_active = true
  JOIN regions region
    ON region.id = city.region_id
   AND region.tenant_id = city.tenant_id
   AND region.is_active = true
  JOIN tenants tenant
    ON tenant.id = projection.tenant_id
   AND tenant.is_active = true
  WHERE projection.tenant_id = ?
    AND projection.is_discoverable = true
`

/**
 * Every discoverable establishment of one operation.
 *
 * Positional bindings, in order: `tenantId`.
 */
export const discoverableEstablishmentsForTenantSql = `SELECT projection.* ${SOURCE_REVALIDATION}`

/**
 * Every discoverable establishment of one city of one operation.
 *
 * City is a discovery state, not an operation selector (ADR-0008), so it
 * narrows the same tenant-scoped set rather than replacing the tenant filter.
 *
 * Positional bindings, in order: `tenantId`, `cityId`.
 */
export const discoverableEstablishmentsForCitySql = `SELECT projection.* ${SOURCE_REVALIDATION} AND projection.city_id = ?`

/**
 * Whether one establishment of one operation is publicly discoverable, as the
 * body of an `EXISTS`, so a public read can guard itself without a second round
 * trip.
 *
 * Positional bindings, in order: `tenantId`, `establishmentId`.
 */
export const discoverableEstablishmentExistsSql = `SELECT 1 ${SOURCE_REVALIDATION} AND projection.establishment_id = ?`
