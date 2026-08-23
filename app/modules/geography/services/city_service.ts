import { inject } from '@adonisjs/core'

import BadRequestException from '#exceptions/bad_request_exception'
import NotFoundException from '#exceptions/not_found_exception'
import IGeography from '#modules/geography/interfaces/geography_interface'
import City from '#modules/geography/models/city'
import CityRepository from '#modules/geography/repositories/city_repository'
import RegionRepository from '#modules/geography/repositories/region_repository'
import { normalizeSlug, resolveUniqueSlug } from '#shared/utils/slug'

@inject()
export default class CityService {
  constructor(
    private cityRepository: CityRepository,
    private regionRepository: RegionRepository
  ) {}

  async list(
    tenantId: number,
    options: { includeInactive?: boolean; regionId?: number } = {}
  ): Promise<City[]> {
    return this.cityRepository.listByTenant(tenantId, options)
  }

  async show(tenantId: number, id: number): Promise<City> {
    return this.getOrFail(tenantId, id)
  }

  async create(tenantId: number, payload: IGeography.CityPayload): Promise<City> {
    await this.ensureRegion(tenantId, payload.region_id)
    this.validateCoordinates(payload.latitude, payload.longitude)

    const slug = payload.slug
      ? await this.validateExplicitSlug(tenantId, payload.slug)
      : await resolveUniqueSlug(payload.name, (candidate) =>
          this.cityRepository.isSlugTaken(tenantId, candidate)
        )
    const ibgeCode = this.normalizeIbgeCode(payload.ibge_code)

    if (ibgeCode && (await this.cityRepository.isIbgeCodeTaken(tenantId, ibgeCode))) {
      throw new BadRequestException('IBGE code is already in use')
    }

    const timezone = payload.timezone?.trim() || 'America/Sao_Paulo'
    this.validateTimezone(timezone)

    return this.cityRepository.create({
      tenant_id: tenantId,
      region_id: payload.region_id,
      name: payload.name.trim(),
      slug,
      state_code: payload.state_code.trim().toUpperCase(),
      country_code: (payload.country_code ?? 'BR').trim().toUpperCase(),
      ibge_code: ibgeCode,
      timezone,
      latitude: payload.latitude ?? null,
      longitude: payload.longitude ?? null,
      sort_order: payload.sort_order ?? 0,
      is_active: payload.is_active ?? true,
    })
  }

  async update(tenantId: number, id: number, payload: IGeography.CityUpdatePayload): Promise<City> {
    const city = await this.getOrFail(tenantId, id)

    if (payload.region_id !== undefined) {
      await this.ensureRegion(tenantId, payload.region_id)
      city.region_id = payload.region_id
    }
    if (payload.slug !== undefined) {
      city.slug = await this.validateExplicitSlug(tenantId, payload.slug, id)
    }
    if (payload.name !== undefined) {
      city.name = payload.name.trim()
    }
    if (payload.state_code !== undefined) {
      city.state_code = payload.state_code.trim().toUpperCase()
    }
    if (payload.country_code !== undefined) {
      city.country_code = payload.country_code.trim().toUpperCase()
    }
    if (payload.ibge_code !== undefined) {
      const ibgeCode = this.normalizeIbgeCode(payload.ibge_code)
      if (ibgeCode && (await this.cityRepository.isIbgeCodeTaken(tenantId, ibgeCode, id))) {
        throw new BadRequestException('IBGE code is already in use')
      }
      city.ibge_code = ibgeCode
    }
    if (payload.timezone !== undefined) {
      const timezone = payload.timezone.trim()
      this.validateTimezone(timezone)
      city.timezone = timezone
    }

    const latitude = payload.latitude !== undefined ? payload.latitude : city.latitude
    const longitude = payload.longitude !== undefined ? payload.longitude : city.longitude
    this.validateCoordinates(latitude, longitude)

    if (payload.latitude !== undefined) {
      city.latitude = payload.latitude
    }
    if (payload.longitude !== undefined) {
      city.longitude = payload.longitude
    }
    if (payload.sort_order !== undefined) {
      city.sort_order = payload.sort_order
    }
    if (payload.is_active !== undefined) {
      city.is_active = payload.is_active
    }

    await city.save()
    await city.load('region')
    return city
  }

  private async getOrFail(tenantId: number, id: number): Promise<City> {
    const city = await this.cityRepository.findByIdForTenant(tenantId, id)
    if (!city) {
      throw new NotFoundException('City not found')
    }
    return city
  }

  private async ensureRegion(tenantId: number, regionId: number): Promise<void> {
    const region = await this.regionRepository.findByIdForTenant(tenantId, regionId)
    if (!region) {
      throw new BadRequestException('Region is invalid for the active operation')
    }
  }

  private async validateExplicitSlug(
    tenantId: number,
    value: string,
    excludeId?: number
  ): Promise<string> {
    const slug = normalizeSlug(value)
    if (!slug) {
      throw new BadRequestException('City slug is invalid')
    }
    if (await this.cityRepository.isSlugTaken(tenantId, slug, excludeId)) {
      throw new BadRequestException('City slug is already in use')
    }
    return slug
  }

  private normalizeIbgeCode(value: string | null | undefined): string | null {
    if (value === null || value === undefined || value.trim() === '') {
      return null
    }

    const normalized = value.replace(/\D/g, '')
    if (normalized.length !== 7) {
      throw new BadRequestException('IBGE code must contain seven digits')
    }
    return normalized
  }

  private validateCoordinates(
    latitude: number | null | undefined,
    longitude: number | null | undefined
  ): void {
    const hasLatitude = latitude !== null && latitude !== undefined
    const hasLongitude = longitude !== null && longitude !== undefined

    if (hasLatitude !== hasLongitude) {
      throw new BadRequestException('Latitude and longitude must be provided together')
    }
    if (hasLatitude && (latitude! < -90 || latitude! > 90)) {
      throw new BadRequestException('Latitude must be between -90 and 90')
    }
    if (hasLongitude && (longitude! < -180 || longitude! > 180)) {
      throw new BadRequestException('Longitude must be between -180 and 180')
    }
  }

  private validateTimezone(timezone: string): void {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format()
    } catch {
      throw new BadRequestException('Timezone must be a valid IANA identifier')
    }
  }
}
