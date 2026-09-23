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
  updateContentValidator,
  updatePartnerContentPolicyValidator,
} from '#modules/partner_content/validators/partner_content_validator'
import PartnerPortalService from '#modules/portal/services/partner_portal_service'

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

  async moderation({ auth, inertia, request, response, tenant }: HttpContext) {
    this.setPrivateHeaders(response)
    const tenantId = tenant!.id
    const actor = auth.getUserOrFail()
    const rawKind = String(request.input('kind', 'events'))
    const path = IPartnerContent.CANONICAL_CONTENT_PATHS.includes(
      rawKind as IPartnerContent.ContentPath
    )
      ? (rawKind as IPartnerContent.ContentPath)
      : 'events'
    const query = await request.validateUsing(listContentQueryValidator)
    const status = query.status ?? 'pending_review'
    const items = await this.contentService.listForModeration(
      IPartnerContent.kindOfPath(path),
      tenantId,
      actor,
      {
        ...query,
        status,
      }
    )
    const authorizationContext = await this.resourceAuthorization.forActorContext(tenantId, actor)
    const isAdmin = authorizationContext.access_snapshot.platform_access === 'platform_admin'
    const policy = isAdmin ? await this.contentService.getPolicy(tenantId, actor) : null

    return inertia.render('backoffice/content/index', {
      items: {
        meta: items.getMeta(),
        data: await this.mediaService.projectAdministrativeContents(
          IPartnerContent.kindOfPath(path),
          tenantId,
          items.all()
        ),
      },
      filters: {
        kind: path,
        status,
        establishment_id: query.establishment_id,
        page: query.page ?? 1,
        per_page: query.per_page ?? 20,
      },
      policy,
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

  async reject({ auth, params, response, session, tenant }: HttpContext) {
    const { kind: path, id } = await contentIdParamsValidator.validate(params)
    await this.contentService.reject(
      IPartnerContent.kindOfPath(path),
      tenant!.id,
      id,
      auth.getUserOrFail()
    )
    session.flash(
      'success',
      'Versão recusada. O parceiro pode corrigir o rascunho e a versão aprovada anterior foi preservada.'
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
