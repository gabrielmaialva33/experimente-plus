import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import CityService from '#modules/geography/services/city_service'
import {
  createCityValidator,
  listCitiesValidator,
  updateCityValidator,
} from '#modules/geography/validators/geography_validator'

@inject()
export default class CitiesController {
  constructor(private cityService: CityService) {}

  async index({ request, response, tenant }: HttpContext) {
    const query = await request.validateUsing(listCitiesValidator)
    const cities = await this.cityService.list(tenant!.id, {
      includeInactive: query.include_inactive ?? false,
      regionId: query.region_id,
    })
    return response.ok(cities)
  }

  async store({ request, response, tenant }: HttpContext) {
    const payload = await request.validateUsing(createCityValidator)
    const city = await this.cityService.create(tenant!.id, payload)
    return response.created(city)
  }

  async show({ params, response, tenant }: HttpContext) {
    const city = await this.cityService.show(tenant!.id, Number(params.id))
    return response.ok(city)
  }

  async update({ request, params, response, tenant }: HttpContext) {
    const payload = await request.validateUsing(updateCityValidator)
    const city = await this.cityService.update(tenant!.id, Number(params.id), payload)
    return response.ok(city)
  }
}
