import { inject } from '@adonisjs/core'

import BadRequestException from '#exceptions/bad_request_exception'
import NotFoundException from '#exceptions/not_found_exception'
import IGeography from '#modules/geography/interfaces/geography_interface'
import Region from '#modules/geography/models/region'
import RegionRepository from '#modules/geography/repositories/region_repository'
import { normalizeSlug, resolveUniqueSlug } from '#shared/utils/slug'

@inject()
export default class RegionService {
  constructor(private regionRepository: RegionRepository) {}

  async list(tenantId: number, includeInactive = false): Promise<Region[]> {
    return this.regionRepository.listByTenant(tenantId, includeInactive)
  }

  async show(tenantId: number, id: number): Promise<Region> {
    return this.getOrFail(tenantId, id)
  }

  async create(tenantId: number, payload: IGeography.RegionPayload): Promise<Region> {
    const slug = payload.slug
      ? await this.validateExplicitSlug(tenantId, payload.slug)
      : await resolveUniqueSlug(payload.name, (candidate) =>
          this.regionRepository.isSlugTaken(tenantId, candidate)
        )

    return this.regionRepository.create({
      tenant_id: tenantId,
      name: payload.name.trim(),
      slug,
      description: this.nullableText(payload.description),
      sort_order: payload.sort_order ?? 0,
      is_active: payload.is_active ?? true,
    })
  }

  async update(
    tenantId: number,
    id: number,
    payload: IGeography.RegionUpdatePayload
  ): Promise<Region> {
    const region = await this.getOrFail(tenantId, id)

    if (payload.slug !== undefined) {
      region.slug = await this.validateExplicitSlug(tenantId, payload.slug, id)
    }
    if (payload.name !== undefined) {
      region.name = payload.name.trim()
    }
    if (payload.description !== undefined) {
      region.description = this.nullableText(payload.description)
    }
    if (payload.sort_order !== undefined) {
      region.sort_order = payload.sort_order
    }
    if (payload.is_active !== undefined) {
      region.is_active = payload.is_active
    }

    await region.save()
    return region
  }

  private async getOrFail(tenantId: number, id: number): Promise<Region> {
    const region = await this.regionRepository.findByIdForTenant(tenantId, id)
    if (!region) {
      throw new NotFoundException('Region not found')
    }
    return region
  }

  private async validateExplicitSlug(
    tenantId: number,
    value: string,
    excludeId?: number
  ): Promise<string> {
    const slug = normalizeSlug(value)
    if (!slug) {
      throw new BadRequestException('Region slug is invalid')
    }
    if (await this.regionRepository.isSlugTaken(tenantId, slug, excludeId)) {
      throw new BadRequestException('Region slug is already in use')
    }
    return slug
  }

  private nullableText(value: string | null | undefined): string | null {
    const normalized = value?.trim()
    return normalized ? normalized : null
  }
}
