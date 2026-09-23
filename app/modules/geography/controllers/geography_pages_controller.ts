import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import CityService from '#modules/geography/services/city_service'
import RegionService from '#modules/geography/services/region_service'
import {
  createCityValidator,
  createRegionValidator,
  updateCityValidator,
  updateRegionValidator,
} from '#modules/geography/validators/geography_validator'

/**
 * Regions and cities — Anexo I item 12.
 *
 * The screen over the geography admin API (ADR-0008). Writes reuse the same
 * services and validators, so the timezone that decides when an event is
 * "today" (ADR-0028) and the region a city belongs to are validated once, for
 * both surfaces. Nothing is deleted: a city leaves discovery by being
 * deactivated, and every public read already revalidates that.
 */
@inject()
export default class GeographyPagesController {
  constructor(
    private regions: RegionService,
    private cities: CityService
  ) {}

  async index({ inertia, response, tenant }: HttpContext) {
    this.setPrivateHeaders(response)
    const tenantId = tenant!.id
    const [regions, cities] = await Promise.all([
      this.regions.list(tenantId, true),
      this.cities.list(tenantId, { includeInactive: true }),
    ])

    return inertia.render('backoffice/geography/index', {
      regions: regions.map((region) => region.serialize()),
      cities: cities.map((city) => city.serialize()),
    })
  }

  async storeRegion({ request, response, session, tenant }: HttpContext) {
    const payload = await request.validateUsing(createRegionValidator)
    await this.regions.create(tenant!.id, payload)
    session.flash('success', 'Região criada.')
    return response.redirect().back()
  }

  async updateRegion({ params, request, response, session, tenant }: HttpContext) {
    const payload = await request.validateUsing(updateRegionValidator)
    await this.regions.update(tenant!.id, Number(params.id), payload)
    session.flash('success', 'Região atualizada.')
    return response.redirect().back()
  }

  async storeCity({ request, response, session, tenant }: HttpContext) {
    const payload = await request.validateUsing(createCityValidator)
    await this.cities.create(tenant!.id, payload)
    session.flash('success', 'Cidade criada.')
    return response.redirect().back()
  }

  async updateCity({ params, request, response, session, tenant }: HttpContext) {
    const payload = await request.validateUsing(updateCityValidator)
    await this.cities.update(tenant!.id, Number(params.id), payload)
    session.flash('success', 'Cidade atualizada.')
    return response.redirect().back()
  }

  private setPrivateHeaders(response: HttpContext['response']): void {
    response.header('X-Robots-Tag', 'noindex, nofollow')
    response.header('Cache-Control', 'private, no-store')
  }
}
