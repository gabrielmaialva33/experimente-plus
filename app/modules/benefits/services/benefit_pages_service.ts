import { inject } from '@adonisjs/core'

import BenefitEditionService from '#modules/benefits/services/benefit_edition_service'
import BenefitOfferService from '#modules/benefits/services/benefit_offer_service'
import EstablishmentRepository from '#modules/establishments/repositories/establishment_repository'
import CityRepository from '#modules/geography/repositories/city_repository'
import OrganizationResourceAuthorizationService, {
  projectEstablishmentBenefitAllowedActions,
} from '#modules/organizations/services/organization_resource_authorization_service'
import type User from '#modules/users/models/user'

/**
 * Read side of the benefit pages: the back-office editions list and the
 * portal's offers page of one establishment.
 */
@inject()
export default class BenefitPagesService {
  constructor(
    private editionService: BenefitEditionService,
    private offerService: BenefitOfferService,
    private resourceAuthorization: OrganizationResourceAuthorizationService,
    private cities: CityRepository,
    private establishments: EstablishmentRepository
  ) {}

  async backoffice(tenantId: number, actor: User) {
    const editions = await this.editionService.list(tenantId, actor)
    const cities = await this.cities.listActiveForTenant(tenantId)

    return { editions, cities }
  }

  async establishment(tenantId: number, establishmentId: number, actor: User) {
    const offers = await this.offerService.listForPortalEstablishment(
      tenantId,
      establishmentId,
      actor
    )
    const establishment = await this.establishments.findWithPublishedRevisionOrFail(
      tenantId,
      establishmentId
    )
    const cityId = establishment.published_revision?.city_id ?? null
    const availableEditions = await this.editionService.listAvailable(tenantId)
    const editions = availableEditions.filter((edition) => edition.city_id === cityId)
    const organizationActions = await this.resourceAuthorization.forOrganization(
      tenantId,
      establishment.organization_id,
      actor
    )
    const allowedActions = projectEstablishmentBenefitAllowedActions(organizationActions, {
      lifecycle_status: establishment.lifecycle_status,
      business_status: establishment.business_status,
      published_revision_id: establishment.published_revision_id,
    })

    return {
      establishment: {
        id: establishment.id,
        organization_id: establishment.organization_id,
        public_name: establishment.published_revision?.public_name ?? 'Unidade sem publicação',
        city_id: cityId,
        published: Boolean(establishment.published_revision_id),
      },
      editions,
      offers,
      allowed_actions: allowedActions,
    }
  }
}
