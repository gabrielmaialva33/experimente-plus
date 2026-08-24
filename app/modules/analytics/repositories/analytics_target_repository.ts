import db from '@adonisjs/lucid/services/db'

import type IAnalytics from '#modules/analytics/interfaces/analytics_interface'

interface CityRow {
  tenant_id: number
  city_id: number
  city_slug: string
  city_timezone: string
}

interface EstablishmentRow {
  tenant_id: number
  establishment_id: number
  published_revision_id: number
  city_id: number
  city_slug: string
  city_timezone: string
  establishment_slug: string
  business_status: IAnalytics.CatalogTarget['business_status']
  is_discoverable: boolean
  public_phone: string | null
  whatsapp: string | null
  website: string | null
  latitude: string | number | null
  longitude: string | number | null
}

export default class AnalyticsTargetRepository {
  async isPublicCategory(tenantId: number, categorySlug: string): Promise<boolean> {
    return Boolean(
      await db
        .from('categories as category')
        .innerJoin('category_families as family', function joinFamily() {
          this.on('family.id', '=', 'category.family_id').andOn(
            'family.tenant_id',
            '=',
            'category.tenant_id'
          )
        })
        .where('category.tenant_id', tenantId)
        .where('category.slug', categorySlug)
        .where('category.is_active', true)
        .where('family.is_active', true)
        .first()
    )
  }

  async findCity(tenantId: number, citySlug: string): Promise<IAnalytics.CityTarget | null> {
    const row = (await db
      .from('cities as city')
      .innerJoin('regions as region', function joinRegion() {
        this.on('region.id', '=', 'city.region_id').andOn('region.tenant_id', '=', 'city.tenant_id')
      })
      .where('city.tenant_id', tenantId)
      .where('city.slug', citySlug)
      .where('city.is_active', true)
      .where('region.is_active', true)
      .select(
        'city.tenant_id',
        'city.id as city_id',
        'city.slug as city_slug',
        'city.timezone as city_timezone'
      )
      .first()) as CityRow | undefined

    return row ?? null
  }

  async findEstablishment(
    tenantId: number,
    citySlug: string,
    establishmentSlug: string
  ): Promise<IAnalytics.CatalogTarget | null> {
    const row = (await db
      .from('catalog_establishments')
      .where('tenant_id', tenantId)
      .where('city_slug', citySlug)
      .where('establishment_slug', establishmentSlug)
      .select(
        'tenant_id',
        'establishment_id',
        'published_revision_id',
        'city_id',
        'city_slug',
        'city_timezone',
        'establishment_slug',
        'business_status',
        'is_discoverable',
        'public_phone',
        'whatsapp',
        'website',
        'latitude',
        'longitude'
      )
      .first()) as EstablishmentRow | undefined

    if (!row) {
      return null
    }

    return {
      ...row,
      latitude: row.latitude === null ? null : Number(row.latitude),
      longitude: row.longitude === null ? null : Number(row.longitude),
    }
  }
}
