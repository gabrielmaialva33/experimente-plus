import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import IPartnerContent from '#modules/partner_content/interfaces/partner_content_interface'
import PartnerContentService from '#modules/partner_content/services/partner_content_service'
import {
  contentIdParamsValidator,
  contentKindParamsValidator,
  createContentValidator,
  listContentQueryValidator,
  publicContentParamsValidator,
  updateContentValidator,
  updatePartnerContentPolicyValidator,
} from '#modules/partner_content/validators/partner_content_validator'
import PublicOperationResolver from '#modules/tenants/services/public_operation_resolver'

@inject()
export default class PartnerContentController {
  constructor(
    private contentService: PartnerContentService,
    private publicResolver: PublicOperationResolver
  ) {}

  /** Public: the operation comes from the hostname, never from the visitor. */
  async publicList({ request, params }: HttpContext) {
    const { kind: path, establishmentId } = await publicContentParamsValidator.validate(params)
    const kind = IPartnerContent.kindOfPath(path)
    const tenant = await this.publicResolver.resolve(request.hostname())
    const items = await this.contentService.listPublic(kind, tenant.id, establishmentId)
    return { data: items }
  }

  async index({ tenant, auth, request, params }: HttpContext) {
    const { kind: path } = await contentKindParamsValidator.validate(params)
    const kind = IPartnerContent.kindOfPath(path)
    const query = await request.validateUsing(listContentQueryValidator)
    return this.contentService.listForPartner(kind, tenant!.id, auth.getUserOrFail(), query)
  }

  async store({ tenant, auth, request, params, response }: HttpContext) {
    const { kind: path } = await contentKindParamsValidator.validate(params)
    const kind = IPartnerContent.kindOfPath(path)
    const payload = await request.validateUsing(createContentValidator)
    const content = await this.contentService.create(
      kind,
      tenant!.id,
      auth.getUserOrFail(),
      payload
    )
    return response.created(content)
  }

  async update({ tenant, auth, request, params }: HttpContext) {
    const { kind: path, id } = await contentIdParamsValidator.validate(params)
    const kind = IPartnerContent.kindOfPath(path)
    const payload = await request.validateUsing(updateContentValidator)
    return this.contentService.update(kind, tenant!.id, id, auth.getUserOrFail(), payload)
  }

  async submit({ tenant, auth, params }: HttpContext) {
    const { kind: path, id } = await contentIdParamsValidator.validate(params)
    const kind = IPartnerContent.kindOfPath(path)
    return this.contentService.submit(kind, tenant!.id, id, auth.getUserOrFail())
  }

  /** The partner withdrawing their own content. */
  async archive({ tenant, auth, params }: HttpContext) {
    const { kind: path, id } = await contentIdParamsValidator.validate(params)
    const kind = IPartnerContent.kindOfPath(path)
    return this.contentService.archive(kind, tenant!.id, id, auth.getUserOrFail())
  }

  async moderationIndex({ tenant, auth, request, params }: HttpContext) {
    const { kind: path } = await contentKindParamsValidator.validate(params)
    const kind = IPartnerContent.kindOfPath(path)
    const query = await request.validateUsing(listContentQueryValidator)
    return this.contentService.listForModeration(kind, tenant!.id, auth.getUserOrFail(), query)
  }

  async approve({ tenant, auth, params }: HttpContext) {
    const { kind: path, id } = await contentIdParamsValidator.validate(params)
    const kind = IPartnerContent.kindOfPath(path)
    return this.contentService.approve(kind, tenant!.id, id, auth.getUserOrFail())
  }

  async reject({ tenant, auth, params }: HttpContext) {
    const { kind: path, id } = await contentIdParamsValidator.validate(params)
    const kind = IPartnerContent.kindOfPath(path)
    return this.contentService.reject(kind, tenant!.id, id, auth.getUserOrFail())
  }

  /**
   * Administrative withdrawal. The scope calls it "excluir"; it archives, and
   * ADR-0028 says why: destroying the trail is the one thing that cannot be
   * undone when a removal turns out to be wrong.
   */
  async moderationArchive({ tenant, auth, params }: HttpContext) {
    const { kind: path, id } = await contentIdParamsValidator.validate(params)
    const kind = IPartnerContent.kindOfPath(path)
    return this.contentService.archive(kind, tenant!.id, id, auth.getUserOrFail(), {
      asModerator: true,
    })
  }

  async getPolicy({ tenant, auth }: HttpContext) {
    return this.contentService.getPolicy(tenant!.id, auth.getUserOrFail())
  }

  async updatePolicy({ tenant, auth, request }: HttpContext) {
    const payload = await request.validateUsing(updatePartnerContentPolicyValidator)
    return this.contentService.updatePolicy(tenant!.id, auth.getUserOrFail(), payload)
  }
}
