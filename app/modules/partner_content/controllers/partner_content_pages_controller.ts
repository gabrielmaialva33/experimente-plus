import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import City from '#modules/geography/models/city'
import OrganizationResourceAuthorizationService from '#modules/organizations/services/organization_resource_authorization_service'
import IPartnerContent from '#modules/partner_content/interfaces/partner_content_interface'
import PartnerContentService from '#modules/partner_content/services/partner_content_service'
import PartnerContentMediaService from '#modules/partner_content/services/partner_content_media_service'
import {
  contentIdParamsValidator,
  contentKindParamsValidator,
  createContentValidator,
  listContentQueryValidator,
  rejectContentValidator,
  updateContentValidator,
  updatePartnerContentPolicyValidator,
} from '#modules/partner_content/validators/partner_content_validator'
import PartnerPortalService from '#modules/portal/services/partner_portal_service'

/** Items shown per kind when the queue shows every kind at once. */
const PREVIEW_PER_KIND = 10

@inject()
export default class PartnerContentPagesController {
  constructor(
    private contentService: PartnerContentService,
    private mediaService: PartnerContentMediaService,
    private portalService: PartnerPortalService,
    private resourceAuthorization: OrganizationResourceAuthorizationService
  ) {}

  async portal({ auth, inertia, response, tenant }: HttpContext) {
    this.setPrivateHeaders(response)
    const tenantId = tenant!.id
    const actor = auth.getUserOrFail()
    const authorizationContext = await this.resourceAuthorization.forActorContext(tenantId, actor)
    const overview = await this.portalService.overview(tenantId, actor, authorizationContext)

    const experiences = await this.contentService.listForPartner('experience', tenantId, actor, {
      page: 1,
      per_page: 100,
    })
    const events = await this.contentService.listForPartner('event', tenantId, actor, {
      page: 1,
      per_page: 100,
    })
    const showcaseItems = await this.contentService.listForPartner(
      'showcase_item',
      tenantId,
      actor,
      {
        page: 1,
        per_page: 100,
      }
    )

    return inertia.render('portal/content/index', {
      content: {
        experiences: {
          meta: experiences.getMeta(),
          data: await this.mediaService.projectAdministrativeContents(
            'experience',
            tenantId,
            experiences.all()
          ),
        },
        events: {
          meta: events.getMeta(),
          data: await this.mediaService.projectAdministrativeContents(
            'event',
            tenantId,
            events.all()
          ),
        },
        showcase_items: {
          meta: showcaseItems.getMeta(),
          data: await this.mediaService.projectAdministrativeContents(
            'showcase_item',
            tenantId,
            showcaseItems.all()
          ),
        },
      },
      establishments: await this.portalEstablishments(tenantId, overview),
      requires_approval: await this.contentService.approvalRequirements(tenantId),
      tenant_id: tenantId,
    })
  }

  async create({ auth, params, request, response, session, tenant }: HttpContext) {
    const { kind: path } = await contentKindParamsValidator.validate(params)
    const payload = await request.validateUsing(createContentValidator)
    await this.contentService.create(
      IPartnerContent.kindOfPath(path),
      tenant!.id,
      auth.getUserOrFail(),
      payload
    )

    session.flash('success', 'Conteúdo criado em rascunho. Revise antes de publicar.')
    return response.redirect().back()
  }

  async update({ auth, params, request, response, session, tenant }: HttpContext) {
    const { kind: path, id } = await contentIdParamsValidator.validate(params)
    const payload = await request.validateUsing(updateContentValidator)
    const result = await this.contentService.update(
      IPartnerContent.kindOfPath(path),
      tenant!.id,
      id,
      auth.getUserOrFail(),
      payload
    )

    session.flash(
      'success',
      result.status === 'pending_review'
        ? 'Alteração salva e encaminhada para análise, mantendo a versão aprovada no ar.'
        : 'Conteúdo atualizado.'
    )
    return response.redirect().back()
  }

  async submit({ auth, params, response, session, tenant }: HttpContext) {
    const { kind: path, id } = await contentIdParamsValidator.validate(params)
    const result = await this.contentService.submit(
      IPartnerContent.kindOfPath(path),
      tenant!.id,
      id,
      auth.getUserOrFail()
    )

    session.flash(
      'success',
      result.status === 'pending_review' ? 'Conteúdo enviado para análise.' : 'Conteúdo publicado.'
    )
    return response.redirect().back()
  }

  async archive({ auth, params, response, session, tenant }: HttpContext) {
    const { kind: path, id } = await contentIdParamsValidator.validate(params)
    await this.contentService.archive(
      IPartnerContent.kindOfPath(path),
      tenant!.id,
      id,
      auth.getUserOrFail()
    )

    session.flash('success', 'Conteúdo arquivado e removido da descoberta pública.')
    return response.redirect().back()
  }

  /**
   * The moderation queue.
   *
   * It opens on every kind at once: a queue that opened on one kind showed
   * "0 itens" while an experience waited unseen under another. Each kind shows
   * its count, the first items and a link to its own paginated list.
   */
  async moderation({ auth, inertia, request, response, tenant }: HttpContext) {
    this.setPrivateHeaders(response)
    const tenantId = tenant!.id
    const actor = auth.getUserOrFail()
    const rawKind = String(request.input('kind', 'all'))
    const path = IPartnerContent.CANONICAL_CONTENT_PATHS.includes(
      rawKind as IPartnerContent.ContentPath
    )
      ? (rawKind as IPartnerContent.ContentPath)
      : null
    const query = await request.validateUsing(listContentQueryValidator)
    const status = query.status ?? 'pending_review'
    const counts = await this.contentService.countForModeration(tenantId, actor, {
      status,
      establishment_id: query.establishment_id,
    })

    const sections = []
    for (const sectionPath of path ? [path] : IPartnerContent.CANONICAL_CONTENT_PATHS) {
      const kind = IPartnerContent.kindOfPath(sectionPath)
      const items = await this.contentService.listForModeration(kind, tenantId, actor, {
        ...query,
        status,
        page: path ? query.page : 1,
        per_page: path ? query.per_page : PREVIEW_PER_KIND,
      })
      sections.push({
        kind: sectionPath,
        meta: items.getMeta(),
        data: await this.mediaService.projectAdministrativeContents(kind, tenantId, items.all()),
      })
    }

    // The publication policy is edited with the other rules of the operation
    // (/backoffice/review-policy, audit W35); the queue only links there.
    const authorizationContext = await this.resourceAuthorization.forActorContext(tenantId, actor)

    return inertia.render('backoffice/content/index', {
      sections,
      counts,
      filters: {
        kind: path ?? 'all',
        status,
        establishment_id: query.establishment_id,
        page: query.page ?? 1,
        per_page: query.per_page ?? 20,
      },
      platform_access: authorizationContext.access_snapshot.platform_access,
      tenant_id: tenantId,
    })
  }

  async approve({ auth, params, response, session, tenant }: HttpContext) {
    const { kind: path, id } = await contentIdParamsValidator.validate(params)
    await this.contentService.approve(
      IPartnerContent.kindOfPath(path),
      tenant!.id,
      id,
      auth.getUserOrFail()
    )
    session.flash('success', 'Conteúdo aprovado e publicado.')
    return response.redirect().back()
  }

  async reject({ auth, params, request, response, session, tenant }: HttpContext) {
    const { kind: path, id } = await contentIdParamsValidator.validate(params)
    const { reason } = await request.validateUsing(rejectContentValidator)
    await this.contentService.reject(
      IPartnerContent.kindOfPath(path),
      tenant!.id,
      id,
      auth.getUserOrFail(),
      reason
    )
    session.flash(
      'success',
      'Versão recusada. O parceiro vê o motivo e pode corrigir; a versão aprovada anterior continua no ar.'
    )
    return response.redirect().back()
  }

  async moderationUpdate({ auth, params, request, response, session, tenant }: HttpContext) {
    const { kind: path, id } = await contentIdParamsValidator.validate(params)
    const payload = await request.validateUsing(updateContentValidator)
    const content = await this.contentService.adminUpdate(
      IPartnerContent.kindOfPath(path),
      tenant!.id,
      id,
      auth.getUserOrFail(),
      payload
    )
    session.flash(
      'success',
      content.status === 'published'
        ? 'Correção publicada. O público já vê a nova versão.'
        : 'Correção salva. O item continua onde o parceiro o deixou.'
    )
    return response.redirect().back()
  }

  async moderationArchive({ auth, params, response, session, tenant }: HttpContext) {
    const { kind: path, id } = await contentIdParamsValidator.validate(params)
    await this.contentService.archive(
      IPartnerContent.kindOfPath(path),
      tenant!.id,
      id,
      auth.getUserOrFail(),
      { asModerator: true }
    )
    session.flash('success', 'Conteúdo retirado da descoberta com histórico preservado.')
    return response.redirect().back()
  }

  async updatePolicy({ auth, request, response, session, tenant }: HttpContext) {
    const payload = await request.validateUsing(updatePartnerContentPolicyValidator)
    await this.contentService.updatePolicy(tenant!.id, auth.getUserOrFail(), payload)
    session.flash('success', 'Política de conteúdo do parceiro atualizada.')
    return response.redirect().back()
  }

  private async portalEstablishments(
    tenantId: number,
    overview: Awaited<ReturnType<PartnerPortalService['overview']>>
  ) {
    const cityIds = Array.from(
      new Set(
        overview.organizations.flatMap((organization) =>
          organization.establishments.flatMap((establishment) => {
            const revision = establishment.revision ?? establishment.published_revision
            const cityId = Number(revision?.city_id ?? 0)
            return cityId > 0 ? [cityId] : []
          })
        )
      )
    )
    const cities =
      cityIds.length > 0
        ? await City.query()
            .where('tenant_id', tenantId)
            .whereIn('id', cityIds)
            .select(['id', 'name', 'state_code', 'timezone'])
        : []
    const cityById = new Map(cities.map((city) => [city.id, city]))

    return overview.organizations.flatMap((organization) =>
      organization.establishments.map((establishment) => {
        const revision = establishment.revision ?? establishment.published_revision
        const cityId = Number(revision?.city_id ?? 0)
        const city = cityById.get(cityId)

        return {
          id: establishment.id,
          organization_id: organization.id,
          organization_name: organization.trade_name,
          public_name: establishment.public_name,
          city:
            city === undefined
              ? null
              : {
                  id: city.id,
                  name: city.name,
                  state_code: city.state_code,
                  timezone: city.timezone,
                },
          allowed_actions: {
            update: organization.allowed_actions.establishments.update,
            submit: organization.allowed_actions.establishments.submit,
            archive: organization.allowed_actions.establishments.archive,
          },
        }
      })
    )
  }

  private setPrivateHeaders(response: HttpContext['response']): void {
    response.header('X-Robots-Tag', 'noindex, nofollow')
    response.header('Cache-Control', 'private, no-store')
  }
}
