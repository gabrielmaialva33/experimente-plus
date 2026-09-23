import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import IPartnerContent from '#modules/partner_content/interfaces/partner_content_interface'
import CityAgendaService from '#modules/partner_content/services/city_agenda_service'
import PartnerContentService from '#modules/partner_content/services/partner_content_service'
import PartnerContentMediaService from '#modules/partner_content/services/partner_content_media_service'
import {
  cityAgendaParamsValidator,
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
    private mediaService: PartnerContentMediaService,
    private cityAgendaService: CityAgendaService,
    private publicResolver: PublicOperationResolver
  ) {}

  /**
   * Public: the operation comes from the hostname, never from the visitor.
   *
   * The payload is the server-side projection of ADR-0028 §4 — the approved
   * snapshot and approved media only. The response is publicly cacheable, so it
   * must not be able to carry a lifecycle field or an internal identifier.
   */
  async publicList({ request, params, response }: HttpContext) {
    const { kind: path, establishmentId } = await publicContentParamsValidator.validate(params)
    const kind = IPartnerContent.kindOfPath(path)
    const tenant = await this.publicResolver.resolve(request.hostname())
    const items = await this.contentService.listPublic(kind, tenant.id, establishmentId)
    const data: IPartnerContent.PublicProjection[] = await this.mediaService.projectPublicContents(
      kind,
      tenant.id,
      items
    )

    this.publicCache(response, 300)
    return response.ok({ data })
  }

  /**
   * The agenda of a city: what is on today, what was announced and what is new.
   *
   * It lives beside the other public partner-content route rather than in the
   * catalogue module so the `/api/v1/catalog/.../{kind}` family keeps one owner.
   */
  async cityAgenda({ request, params, response }: HttpContext) {
    const { citySlug } = await cityAgendaParamsValidator.validate(params)
    const agenda = await this.cityAgendaService.forCity(request.hostname(), citySlug)

    this.publicCache(response, 60)
    return response.ok(agenda)
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
  /** An administrator's edit; what it does depends on where the item is. */
  async moderationUpdate({ tenant, auth, request, params }: HttpContext) {
    const { kind: path, id } = await contentIdParamsValidator.validate(params)
    const kind = IPartnerContent.kindOfPath(path)
    const payload = await request.validateUsing(updateContentValidator)
    return this.contentService.adminUpdate(kind, tenant!.id, id, auth.getUserOrFail(), payload)
  }

  async history({ tenant, auth, params }: HttpContext) {
    const { kind: path, id } = await contentIdParamsValidator.validate(params)
    const kind = IPartnerContent.kindOfPath(path)
    return {
      data: await this.contentService.history(kind, tenant!.id, id, auth.getUserOrFail()),
    }
  }

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

  /** `Vary: Host` because the hostname is what selects the operation. */
  private publicCache(response: HttpContext['response'], maxAge: number): void {
    response.header(
      'Cache-Control',
      `public, max-age=${maxAge}, stale-while-revalidate=${maxAge * 2}`
    )
    response.vary(['Host', 'Accept-Encoding'])
  }
}
