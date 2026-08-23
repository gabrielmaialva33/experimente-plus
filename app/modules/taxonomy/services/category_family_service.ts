import { inject } from '@adonisjs/core'

import BadRequestException from '#exceptions/bad_request_exception'
import NotFoundException from '#exceptions/not_found_exception'
import ITaxonomy from '#modules/taxonomy/interfaces/taxonomy_interface'
import CategoryFamily from '#modules/taxonomy/models/category_family'
import CategoryFamilyRepository from '#modules/taxonomy/repositories/category_family_repository'
import { normalizeSlug, resolveUniqueSlug } from '#shared/utils/slug'

@inject()
export default class CategoryFamilyService {
  constructor(private categoryFamilyRepository: CategoryFamilyRepository) {}

  async list(tenantId: number, includeInactive = false): Promise<CategoryFamily[]> {
    return this.categoryFamilyRepository.listByTenant(tenantId, includeInactive)
  }

  async show(tenantId: number, id: number): Promise<CategoryFamily> {
    return this.getOrFail(tenantId, id)
  }

  async create(tenantId: number, payload: ITaxonomy.FamilyPayload): Promise<CategoryFamily> {
    const slug = payload.slug
      ? await this.validateExplicitSlug(tenantId, payload.slug)
      : await resolveUniqueSlug(payload.name, (candidate) =>
          this.categoryFamilyRepository.isSlugTaken(tenantId, candidate)
        )

    return this.categoryFamilyRepository.create({
      tenant_id: tenantId,
      name: payload.name.trim(),
      slug,
      description: this.nullableText(payload.description),
      icon: this.nullableText(payload.icon),
      sort_order: payload.sort_order ?? 0,
      is_active: payload.is_active ?? true,
    })
  }

  async update(
    tenantId: number,
    id: number,
    payload: ITaxonomy.FamilyUpdatePayload
  ): Promise<CategoryFamily> {
    const family = await this.getOrFail(tenantId, id)

    if (payload.slug !== undefined) {
      family.slug = await this.validateExplicitSlug(tenantId, payload.slug, id)
    }
    if (payload.name !== undefined) {
      family.name = payload.name.trim()
    }
    if (payload.description !== undefined) {
      family.description = this.nullableText(payload.description)
    }
    if (payload.icon !== undefined) {
      family.icon = this.nullableText(payload.icon)
    }
    if (payload.sort_order !== undefined) {
      family.sort_order = payload.sort_order
    }
    if (payload.is_active !== undefined) {
      family.is_active = payload.is_active
    }

    await family.save()
    return family
  }

  private async getOrFail(tenantId: number, id: number): Promise<CategoryFamily> {
    const family = await this.categoryFamilyRepository.findByIdForTenant(tenantId, id)
    if (!family) {
      throw new NotFoundException('Category family not found')
    }
    return family
  }

  private async validateExplicitSlug(
    tenantId: number,
    value: string,
    excludeId?: number
  ): Promise<string> {
    const slug = normalizeSlug(value)
    if (!slug) {
      throw new BadRequestException('Category family slug is invalid')
    }
    if (await this.categoryFamilyRepository.isSlugTaken(tenantId, slug, excludeId)) {
      throw new BadRequestException('Category family slug is already in use')
    }
    return slug
  }

  private nullableText(value: string | null | undefined): string | null {
    const normalized = value?.trim()
    return normalized ? normalized : null
  }
}
