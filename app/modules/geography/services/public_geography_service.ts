import { inject } from '@adonisjs/core'

import NotFoundException from '#exceptions/not_found_exception'
import City from '#modules/geography/models/city'
import Region from '#modules/geography/models/region'
import CityRepository from '#modules/geography/repositories/city_repository'
import RegionRepository from '#modules/geography/repositories/region_repository'
import PublicOperationResolver from '#modules/tenants/services/public_operation_resolver'

@inject()
export default class PublicGeographyService {
  constructor(
    private operationResolver: PublicOperationResolver,
    private regionRepository: RegionRepository,
    private cityRepository: CityRepository
  ) {}

  async listRegions(hostname?: string | null): Promise<Region[]> {
    const tenant = await this.operationResolver.resolve(hostname)
    return this.regionRepository.listPublic(tenant.id)
  }

  async listCities(hostname?: string | null): Promise<City[]> {
    const tenant = await this.operationResolver.resolve(hostname)
    return this.cityRepository.listPublic(tenant.id)
  }

  async showCity(hostname: string | null | undefined, slug: string): Promise<City> {
    const tenant = await this.operationResolver.resolve(hostname)
    const city = await this.cityRepository.findBySlugForTenant(tenant.id, slug)

    if (!city || !city.is_active || !city.region.is_active) {
      throw new NotFoundException('City not found')
    }

    return city
  }
}
