import db from '@adonisjs/lucid/services/db'

import type IConcierge from '#modules/concierge/interfaces/concierge_interface'

/**
 * The only source of fact the Concierge is allowed — ADR-0029.
 *
 * It reads the published projection of ADR-0016 and nothing else: what is not
 * discoverable was withheld on purpose, and the model must never see it. The
 * withheld names are returned alongside so the answer can be checked for
 * mentioning a place the request deliberately excluded, which a consumer could
 * not tell apart from an invented one.
 */
export default class CatalogGroundingRepository {
  async forQuestion(
    tenantId: number,
    citySlug: string | null,
    limit: number
  ): Promise<{ offered: IConcierge.GroundingItem[]; withheld: string[] }> {
    const rows = await db
      .from('catalog_establishments')
      .select('establishment_id', 'public_name', 'city_slug', 'address', 'categories')
      .where('tenant_id', tenantId)
      .where('is_discoverable', true)
      .if(citySlug, (query) => query.where('city_slug', citySlug!))
      .orderBy('public_name', 'asc')
      .limit(limit)

    const offered = rows.map((row) => this.toItem(row))

    // Places of the same operation that this question did not select: a city
    // the person did not ask about, or beyond the limit. Naming one of these
    // would look exactly like invention from the outside.
    const withheldRows = await db
      .from('catalog_establishments')
      .select('public_name')
      .where('tenant_id', tenantId)
      .where('is_discoverable', true)
      .whereNotIn(
        'establishment_id',
        offered.map((item) => item.id)
      )
      .limit(200)

    return { offered, withheld: withheldRows.map((row) => String(row.public_name)) }
  }

  private toItem(row: Record<string, unknown>): IConcierge.GroundingItem {
    const address = (row.address ?? {}) as Record<string, unknown>
    const categories = Array.isArray(row.categories) ? row.categories : []
    const first = (categories[0] ?? {}) as Record<string, unknown>

    return {
      id: Number(row.establishment_id),
      kind: 'establishment',
      name: String(row.public_name),
      city: String(row.city_slug ?? ''),
      district: address.district ? String(address.district) : null,
      category: first.name ? String(first.name) : null,
      opens_at: null,
      closes_at: null,
    }
  }
}
