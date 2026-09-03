import db from '@adonisjs/lucid/services/db'

import type ICatalog from '#modules/catalog/interfaces/catalog_interface'

interface VersionRow {
  projection_version: string | number
}

interface SearchOptions {
  tenantId: number
  cityId: number
  query: ICatalog.SearchQuery
  sponsoredOnly: boolean
  page: number
  perPage: number
}

export interface CatalogSearchPage {
  rows: ICatalog.CatalogRow[]
  total: number
  page: number
}

interface SearchEnvelopeRow {
  establishment_id: unknown
  effective_page: unknown
  total_count: unknown
  [key: string]: unknown
}

type CatalogDatabaseRow = Omit<ICatalog.CatalogRow, 'published_at' | 'public_updated_at'> & {
  published_at: string | Date
  public_updated_at: string | Date
}

export default class CatalogSearchRepository {
  async getProjectionVersion(tenantId: number): Promise<number> {
    const result = await db.rawQuery<{ rows: VersionRow[] }>(
      `
        SELECT projection_version
        FROM catalog_tenant_versions
        WHERE tenant_id = ?
        LIMIT 1
      `,
      [tenantId]
    )

    return Number(result.rows[0]?.projection_version ?? 1)
  }

  async listCities(tenantId: number): Promise<ICatalog.CityRow[]> {
    const result = await db.rawQuery<{ rows: ICatalog.CityRow[] }>(
      `
        WITH safe_catalog AS (
          SELECT projection.*
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
          JOIN tenants tenant
            ON tenant.id = projection.tenant_id
           AND tenant.is_active = true
          WHERE projection.tenant_id = ?
            AND projection.is_discoverable = true
        )
        SELECT
          city.id,
          city.slug,
          city.name,
          city.state_code,
          city.country_code,
          city.timezone,
          city.latitude,
          city.longitude,
          region.slug AS region_slug,
          region.name AS region_name,
          count(safe_catalog.establishment_id)::integer AS establishments_count
        FROM cities city
        JOIN regions region
          ON region.id = city.region_id
         AND region.tenant_id = city.tenant_id
         AND region.is_active = true
        LEFT JOIN safe_catalog
          ON safe_catalog.city_id = city.id
         AND safe_catalog.tenant_id = city.tenant_id
        WHERE city.tenant_id = ?
          AND city.is_active = true
        GROUP BY
          city.id,
          city.slug,
          city.name,
          city.state_code,
          city.country_code,
          city.timezone,
          city.latitude,
          city.longitude,
          city.sort_order,
          region.slug,
          region.name
        ORDER BY city.sort_order ASC, city.name ASC, city.id ASC
      `,
      [tenantId, tenantId]
    )

    return result.rows.map((row) => ({
      ...row,
      latitude: row.latitude === null ? null : Number(row.latitude),
      longitude: row.longitude === null ? null : Number(row.longitude),
      establishments_count: Number(row.establishments_count),
    }))
  }

  async listCategories(tenantId: number, cityId: number): Promise<ICatalog.CategoryRow[]> {
    const result = await db.rawQuery<{ rows: ICatalog.CategoryRow[] }>(
      `
        WITH RECURSIVE
        safe_catalog AS (
          SELECT projection.*
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
          JOIN tenants tenant
            ON tenant.id = projection.tenant_id
           AND tenant.is_active = true
          WHERE projection.tenant_id = ?
            AND projection.city_id = ?
            AND projection.is_discoverable = true
        ),
        category_tree AS (
          SELECT category.id AS root_id, category.id AS descendant_id
          FROM categories category
          JOIN category_families family
            ON family.id = category.family_id
           AND family.tenant_id = category.tenant_id
           AND family.is_active = true
          WHERE category.tenant_id = ?
            AND category.is_active = true

          UNION ALL

          SELECT tree.root_id, child.id
          FROM category_tree tree
          JOIN categories child
            ON child.parent_id = tree.descendant_id
           AND child.tenant_id = ?
           AND child.is_active = true
        )
        SELECT
          root.id,
          root.slug,
          root.name,
          root.description,
          root.icon,
          parent.slug AS parent_slug,
          family.slug AS family_slug,
          family.name AS family_name,
          family.icon AS family_icon,
          count(DISTINCT safe_catalog.establishment_id)::integer AS establishments_count
        FROM categories root
        JOIN category_families family
          ON family.id = root.family_id
         AND family.tenant_id = root.tenant_id
         AND family.is_active = true
        LEFT JOIN categories parent
          ON parent.id = root.parent_id
         AND parent.tenant_id = root.tenant_id
         AND parent.is_active = true
        JOIN category_tree tree
          ON tree.root_id = root.id
        JOIN catalog_establishment_categories projection_category
          ON projection_category.tenant_id = root.tenant_id
         AND projection_category.category_id = tree.descendant_id
        JOIN safe_catalog
          ON safe_catalog.tenant_id = projection_category.tenant_id
         AND safe_catalog.establishment_id = projection_category.establishment_id
        WHERE root.tenant_id = ?
          AND root.is_active = true
        GROUP BY
          root.id,
          root.slug,
          root.name,
          root.description,
          root.icon,
          root.sort_order,
          parent.slug,
          family.slug,
          family.name,
          family.icon,
          family.sort_order
        HAVING count(DISTINCT safe_catalog.establishment_id) > 0
        ORDER BY
          family.sort_order ASC,
          family.name ASC,
          root.sort_order ASC,
          root.name ASC,
          root.id ASC
      `,
      [tenantId, cityId, tenantId, tenantId, tenantId]
    )

    return result.rows.map((row) => ({
      ...row,
      establishments_count: Number(row.establishments_count),
    }))
  }

  async findActiveCategoryBySlug(
    tenantId: number,
    categorySlug: string
  ): Promise<ICatalog.CategoryIdentityRow | null> {
    const result = await db.rawQuery<{ rows: ICatalog.CategoryIdentityRow[] }>(
      `
        SELECT
          category.slug,
          category.name,
          category.description,
          category.icon,
          parent.slug AS parent_slug,
          family.slug AS family_slug,
          family.name AS family_name,
          family.icon AS family_icon
        FROM categories category
        JOIN category_families family
          ON family.id = category.family_id
         AND family.tenant_id = category.tenant_id
         AND family.is_active = true
        LEFT JOIN categories parent
          ON parent.id = category.parent_id
         AND parent.tenant_id = category.tenant_id
         AND parent.is_active = true
        WHERE category.tenant_id = ?
          AND category.slug = ?
          AND category.is_active = true
        LIMIT 1
      `,
      [tenantId, categorySlug]
    )

    return result.rows[0] ?? null
  }

  async searchOrganic(
    tenantId: number,
    cityId: number,
    query: ICatalog.SearchQuery
  ): Promise<CatalogSearchPage> {
    return this.runSearch({
      tenantId,
      cityId,
      query,
      sponsoredOnly: false,
      page: query.page,
      perPage: query.per_page,
    })
  }

  async searchSponsored(
    tenantId: number,
    cityId: number,
    query: ICatalog.SearchQuery
  ): Promise<ICatalog.CatalogRow[]> {
    const page = await this.runSearch({
      tenantId,
      cityId,
      query,
      sponsoredOnly: true,
      page: 1,
      perPage: 3,
    })

    return page.rows
  }

  async findBySlug(
    tenantId: number,
    cityId: number,
    establishmentSlug: string
  ): Promise<ICatalog.CatalogRow | null> {
    const result = await db.rawQuery<{ rows: CatalogDatabaseRow[] }>(
      `
        SELECT
          projection.*,
          catalog_is_open_now(
            projection.availability_type,
            projection.business_status,
            projection.city_timezone,
            projection.weekly_hours,
            projection.special_days
          ) AS is_open_now,
          0::double precision AS relevance_score,
          1::integer AS total_count
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
          AND projection.city_id = ?
          AND projection.establishment_slug = ?
        LIMIT 1
      `,
      [tenantId, cityId, establishmentSlug]
    )

    const row = result.rows[0]
    return row ? this.normalizeRow(row) : null
  }

  async refresh(tenantId: number, establishmentId: number): Promise<void> {
    await db.rawQuery('SELECT catalog_refresh_establishment(?, ?)', [tenantId, establishmentId])
  }

  async refreshTenant(tenantId: number): Promise<void> {
    const establishments = await db
      .from('establishments')
      .where('tenant_id', tenantId)
      .whereNotNull('published_revision_id')
      .select('id')

    for (const establishment of establishments) {
      await this.refresh(tenantId, Number(establishment.id))
    }
  }

  private async runSearch(options: SearchOptions): Promise<CatalogSearchPage> {
    const rankedOrder = this.orderBy(options.query.sort, 'ranked')
    const pagedOrder = this.orderBy(options.query.sort, 'paged')
    const sponsorshipPredicate = options.sponsoredOnly
      ? 'projection.is_sponsored = true'
      : 'projection.is_sponsored = false'

    const result = await db.rawQuery<{ rows: CatalogDatabaseRow[] }>(
      `
        WITH RECURSIVE
        input AS (
          SELECT
            catalog_normalize_text(?) AS query_text,
            ?::text AS category_slug,
            ?::boolean AS open_now
        ),
        requested_category AS (
          SELECT category.id
          FROM categories category
          JOIN category_families family
            ON family.id = category.family_id
           AND family.tenant_id = category.tenant_id
           AND family.is_active = true
          CROSS JOIN input
          WHERE category.tenant_id = ?
            AND category.slug = input.category_slug
            AND category.is_active = true
        ),
        category_scope AS (
          SELECT id
          FROM requested_category

          UNION ALL

          SELECT child.id
          FROM category_scope scope
          JOIN categories child
            ON child.parent_id = scope.id
           AND child.tenant_id = ?
           AND child.is_active = true
        ),
        safe_catalog AS (
          SELECT projection.*
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
            AND projection.city_id = ?
            AND projection.is_discoverable = true
            AND ${sponsorshipPredicate}
        ),
        ranked AS (
          SELECT
            projection.*,
            catalog_is_open_now(
              projection.availability_type,
              projection.business_status,
              projection.city_timezone,
              projection.weekly_hours,
              projection.special_days
            ) AS is_open_now,
            (
              CASE
                WHEN input.query_text = '' THEN 0
                WHEN projection.normalized_name = input.query_text THEN 1000
                WHEN projection.normalized_name LIKE input.query_text || '%' THEN 800
                ELSE 0
              END
              + CASE
                  WHEN input.query_text = '' THEN 0
                  ELSE ts_rank_cd(
                    projection.search_vector,
                    plainto_tsquery('portuguese', input.query_text)
                  ) * 200
                END
              + CASE
                  WHEN input.query_text = '' THEN 0
                  ELSE similarity(projection.normalized_name, input.query_text) * 100
                END
              + CASE
                  WHEN input.query_text = '' THEN 0
                  ELSE similarity(projection.search_text, input.query_text) * 20
                END
            )::double precision AS relevance_score
          FROM safe_catalog projection
          CROSS JOIN input
          WHERE (
              input.query_text = ''
              OR projection.normalized_name = input.query_text
              OR projection.normalized_name LIKE input.query_text || '%'
              OR projection.search_vector @@ plainto_tsquery('portuguese', input.query_text)
              OR similarity(projection.normalized_name, input.query_text) >= 0.18
              OR similarity(projection.search_text, input.query_text) >= 0.08
            )
            AND (
              input.category_slug IS NULL
              OR EXISTS (
                SELECT 1
                FROM catalog_establishment_categories projection_category
                JOIN category_scope scope
                  ON scope.id = projection_category.category_id
                WHERE projection_category.tenant_id = projection.tenant_id
                  AND projection_category.establishment_id = projection.establishment_id
              )
            )
            AND (
              input.open_now IS FALSE
              OR catalog_is_open_now(
                projection.availability_type,
                projection.business_status,
                projection.city_timezone,
                projection.weekly_hours,
                projection.special_days
              )
            )
        ),
        totals AS (
          SELECT count(*)::integer AS total_count
          FROM ranked
        ),
        pagination AS (
          SELECT
            totals.total_count,
            CASE
              WHEN totals.total_count = 0 THEN 1
              ELSE GREATEST(
                1::numeric,
                LEAST(
                  ?::numeric,
                  ceil(totals.total_count::numeric / ?::numeric)
                )
              )::integer
            END AS effective_page
          FROM totals
        ),
        paged AS (
          SELECT ranked.*
          FROM ranked
          ORDER BY ${rankedOrder}
          LIMIT ?
          OFFSET (
            SELECT (pagination.effective_page::bigint - 1) * ?::bigint
            FROM pagination
          )
        )
        SELECT
          paged.*,
          pagination.total_count,
          pagination.effective_page
        FROM pagination
        LEFT JOIN paged ON TRUE
        ORDER BY ${pagedOrder}
      `,
      [
        options.query.q,
        options.query.category ?? null,
        options.query.open_now,
        options.tenantId,
        options.tenantId,
        options.tenantId,
        options.cityId,
        options.page,
        options.perPage,
        options.perPage,
        options.perPage,
      ]
    )

    const rows = result.rows as unknown as SearchEnvelopeRow[]

    return {
      total: Number(rows[0]?.total_count ?? 0),
      page: Number(rows[0]?.effective_page ?? 1),
      rows: rows.flatMap((row) => {
        if (row.establishment_id === null || row.establishment_id === undefined) {
          return []
        }

        return [this.normalizeRow(row as unknown as CatalogDatabaseRow)]
      }),
    }
  }

  private normalizeRow(row: CatalogDatabaseRow): ICatalog.CatalogRow {
    return {
      ...row,
      establishment_id: Number(row.establishment_id),
      tenant_id: Number(row.tenant_id),
      organization_id: Number(row.organization_id),
      published_revision_id: Number(row.published_revision_id),
      city_id: Number(row.city_id),
      latitude: row.latitude === null ? null : Number(row.latitude),
      longitude: row.longitude === null ? null : Number(row.longitude),
      sponsored_priority: row.sponsored_priority === null ? null : Number(row.sponsored_priority),
      relevance_score: Number(row.relevance_score ?? 0),
      total_count: Number(row.total_count ?? 0),
      is_open_now: Boolean(row.is_open_now),
      published_at: this.serializeTimestamp(row.published_at, 'published_at'),
      public_updated_at: this.serializeTimestamp(row.public_updated_at, 'public_updated_at'),
    }
  }

  private serializeTimestamp(
    value: string | Date,
    field: 'published_at' | 'public_updated_at'
  ): string {
    if (typeof value === 'string' && value.trim()) return value.trim()

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString()
    }

    throw new TypeError(`Catalog projection ${field} must be a valid timestamp`)
  }

  private orderBy(sort: ICatalog.Sort, relation: 'ranked' | 'paged'): string {
    if (sort === 'name') {
      return `${relation}.normalized_name ASC, ${relation}.establishment_id ASC`
    }

    if (sort === 'recent') {
      return `${relation}.published_at DESC, ${relation}.establishment_id ASC`
    }

    return `${relation}.relevance_score DESC, ${relation}.normalized_name ASC, ${relation}.establishment_id ASC`
  }
}
