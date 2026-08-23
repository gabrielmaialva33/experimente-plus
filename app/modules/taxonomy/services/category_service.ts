import { inject } from '@adonisjs/core'

import BadRequestException from '#exceptions/bad_request_exception'
import NotFoundException from '#exceptions/not_found_exception'
import ITaxonomy from '#modules/taxonomy/interfaces/taxonomy_interface'
import Category from '#modules/taxonomy/models/category'
import CategoryFamilyRepository from '#modules/taxonomy/repositories/category_family_repository'
import CategoryRepository from '#modules/taxonomy/repositories/category_repository'
import { normalizeSlug, resolveUniqueSlug } from '#shared/utils/slug'

@inject()
export default class CategoryService {
  constructor(
    private categoryRepository: CategoryRepository,
    private categoryFamilyRepository: CategoryFamilyRepository
  ) {}

  async list(
    tenantId: number,
    options: {
      includeInactive?: boolean
      familyId?: number
      parentId?: number | null
    } = {}
  ): Promise<Category[]> {
    return this.categoryRepository.listByTenant(tenantId, options)
  }

  async show(tenantId: number, id: number): Promise<Category> {
    return this.getOrFail(tenantId, id)
  }

  async create(tenantId: number, payload: ITaxonomy.CategoryPayload): Promise<Category> {
    await this.ensureFamily(tenantId, payload.family_id)
    const parentId = payload.parent_id ?? null
    await this.ensureValidParent(tenantId, payload.family_id, parentId)

    const slug = payload.slug
      ? await this.validateExplicitSlug(tenantId, payload.slug)
      : await resolveUniqueSlug(payload.name, (candidate) =>
          this.categoryRepository.isSlugTaken(tenantId, candidate)
        )

    return this.categoryRepository.create({
      tenant_id: tenantId,
      family_id: payload.family_id,
      parent_id: parentId,
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
    payload: ITaxonomy.CategoryUpdatePayload
  ): Promise<Category> {
    const category = await this.getOrFail(tenantId, id)
    const targetFamilyId = payload.family_id ?? category.family_id
    const targetParentId = payload.parent_id !== undefined ? payload.parent_id : category.parent_id

    await this.ensureFamily(tenantId, targetFamilyId)

    if (targetParentId === id) {
      throw new BadRequestException('A category cannot be its own parent')
    }

    const hasChildren = await this.categoryRepository.hasChildren(tenantId, id)
    if (hasChildren && targetParentId !== null) {
      throw new BadRequestException('A category with children cannot become a subcategory')
    }
    if (hasChildren && targetFamilyId !== category.family_id) {
      throw new BadRequestException('Move child categories before changing the family')
    }

    await this.ensureValidParent(tenantId, targetFamilyId, targetParentId)

    if (payload.slug !== undefined) {
      category.slug = await this.validateExplicitSlug(tenantId, payload.slug, id)
    }
    if (payload.family_id !== undefined) {
      category.family_id = payload.family_id
    }
    if (payload.parent_id !== undefined) {
      category.parent_id = payload.parent_id
    }
    if (payload.name !== undefined) {
      category.name = payload.name.trim()
    }
    if (payload.description !== undefined) {
      category.description = this.nullableText(payload.description)
    }
    if (payload.icon !== undefined) {
      category.icon = this.nullableText(payload.icon)
    }
    if (payload.sort_order !== undefined) {
      category.sort_order = payload.sort_order
    }
    if (payload.is_active !== undefined) {
      category.is_active = payload.is_active
    }

    await category.save()
    return this.getOrFail(tenantId, id)
  }

  private async getOrFail(tenantId: number, id: number): Promise<Category> {
    const category = await this.categoryRepository.findByIdForTenant(tenantId, id)
    if (!category) {
      throw new NotFoundException('Category not found')
    }
    return category
  }

  private async ensureFamily(tenantId: number, familyId: number): Promise<void> {
    const family = await this.categoryFamilyRepository.findByIdForTenant(tenantId, familyId)
    if (!family) {
      throw new BadRequestException('Category family is invalid for the active operation')
    }
  }

  private async ensureValidParent(
    tenantId: number,
    familyId: number,
    parentId: number | null
  ): Promise<void> {
    if (parentId === null) {
      return
    }

    const parent = await this.categoryRepository.findByIdForTenant(tenantId, parentId)
    if (!parent) {
      throw new BadRequestException('Parent category is invalid for the active operation')
    }
    if (parent.family_id !== familyId) {
      throw new BadRequestException('Parent category must belong to the same family')
    }
    if (parent.parent_id !== null) {
      throw new BadRequestException('Taxonomy supports only category and subcategory levels')
    }
  }

  private async validateExplicitSlug(
    tenantId: number,
    value: string,
    excludeId?: number
  ): Promise<string> {
    const slug = normalizeSlug(value)
    if (!slug) {
      throw new BadRequestException('Category slug is invalid')
    }
    if (await this.categoryRepository.isSlugTaken(tenantId, slug, excludeId)) {
      throw new BadRequestException('Category slug is already in use')
    }
    return slug
  }

  private nullableText(value: string | null | undefined): string | null {
    const normalized = value?.trim()
    return normalized ? normalized : null
  }
}
