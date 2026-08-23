import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import RegionService from '#modules/geography/services/region_service'
import {
  createRegionValidator,
  listRegionsValidator,
  updateRegionValidator,
} from '#modules/geography/validators/geography_validator'

@inject()
export default class RegionsController {
  constructor(private regionService: RegionService) {}

  async index({ request, response, tenant }: HttpContext) {
    const query = await request.validateUsing(listRegionsValidator)
    const regions = await this.regionService.list(tenant!.id, query.include_inactive ?? false)
    return response.ok(regions)
  }

  async store({ request, response, tenant }: HttpContext) {
    const payload = await request.validateUsing(createRegionValidator)
    const region = await this.regionService.create(tenant!.id, payload)
    return response.created(region)
  }

  async show({ params, response, tenant }: HttpContext) {
    const region = await this.regionService.show(tenant!.id, Number(params.id))
    return response.ok(region)
  }

  async update({ request, params, response, tenant }: HttpContext) {
    const payload = await request.validateUsing(updateRegionValidator)
    const region = await this.regionService.update(tenant!.id, Number(params.id), payload)
    return response.ok(region)
  }
}
