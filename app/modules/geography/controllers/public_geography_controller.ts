import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import PublicGeographyService from '#modules/geography/services/public_geography_service'

@inject()
export default class PublicGeographyController {
  constructor(private publicGeographyService: PublicGeographyService) {}

  async regions({ request, response }: HttpContext) {
    const regions = await this.publicGeographyService.listRegions(request.hostname())
    return response.ok(regions)
  }

  async cities({ request, response }: HttpContext) {
    const cities = await this.publicGeographyService.listCities(request.hostname())
    return response.ok(cities)
  }

  async city({ request, params, response }: HttpContext) {
    const city = await this.publicGeographyService.showCity(request.hostname(), params.citySlug)
    return response.ok(city)
  }
}
