import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import CategoryFamilyService from '#modules/taxonomy/services/category_family_service'
import CategoryService from '#modules/taxonomy/services/category_service'
import {
  createCategoryFamilyValidator,
  createCategoryValidator,
  updateCategoryFamilyValidator,
  updateCategoryValidator,
} from '#modules/taxonomy/validators/taxonomy_validator'

/**
 * Category families and categories — Anexo I item 12, "gestão de categorias".
 *
 * The admin API has existed since EP-02; this is the screen over it. Every
 * write goes through the same services and validators as the API, so slug
 * generation, the family/parent consistency rules and uniqueness are decided in
 * one place. Nothing is deleted here: deactivating is the lifecycle the domain
 * offers, and a category in use by published establishments keeps its history.
 */
@inject()
export default class TaxonomyPagesController {
  constructor(
    private families: CategoryFamilyService,
    private categories: CategoryService
  ) {}

  async index({ inertia, response, tenant }: HttpContext) {
    this.setPrivateHeaders(response)
    const tenantId = tenant!.id
    const [families, categories] = await Promise.all([
      this.families.list(tenantId, true),
      this.categories.list(tenantId, { includeInactive: true }),
    ])

    return inertia.render('backoffice/taxonomy/index', {
      families: families.map((family) => family.serialize()),
      categories: categories.map((category) => category.serialize()),
    })
  }

  async storeFamily({ request, response, session, tenant }: HttpContext) {
    const payload = await request.validateUsing(createCategoryFamilyValidator)
    await this.families.create(tenant!.id, payload)
    session.flash('success', 'Família criada.')
    return response.redirect().back()
  }

  async updateFamily({ params, request, response, session, tenant }: HttpContext) {
    const payload = await request.validateUsing(updateCategoryFamilyValidator)
    await this.families.update(tenant!.id, Number(params.id), payload)
    session.flash('success', 'Família atualizada.')
    return response.redirect().back()
  }

  async storeCategory({ request, response, session, tenant }: HttpContext) {
    const payload = await request.validateUsing(createCategoryValidator)
    await this.categories.create(tenant!.id, payload)
    session.flash('success', 'Categoria criada.')
    return response.redirect().back()
  }

  async updateCategory({ params, request, response, session, tenant }: HttpContext) {
    const payload = await request.validateUsing(updateCategoryValidator)
    await this.categories.update(tenant!.id, Number(params.id), payload)
    session.flash('success', 'Categoria atualizada.')
    return response.redirect().back()
  }

  private setPrivateHeaders(response: HttpContext['response']): void {
    response.header('X-Robots-Tag', 'noindex, nofollow')
    response.header('Cache-Control', 'private, no-store')
  }
}
