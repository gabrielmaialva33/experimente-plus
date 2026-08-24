import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import EstablishmentAddressService from '#modules/establishments/services/establishment_address_service'
import EstablishmentAttributesService from '#modules/establishments/services/establishment_attributes_service'
import EstablishmentCategoriesService from '#modules/establishments/services/establishment_categories_service'
import EstablishmentHoursService from '#modules/establishments/services/establishment_hours_service'
import {
  replaceEstablishmentAddressValidator,
  replaceEstablishmentAttributesValidator,
  replaceEstablishmentCategoriesValidator,
  replaceEstablishmentHoursValidator,
  replaceEstablishmentSpecialDaysValidator,
} from '#modules/establishments/validators/establishment_validator'

@inject()
export default class EstablishmentSectionsController {
  constructor(
    private addressService: EstablishmentAddressService,
    private categoriesService: EstablishmentCategoriesService,
    private attributesService: EstablishmentAttributesService,
    private hoursService: EstablishmentHoursService
  ) {}

  async address({ auth, params, request, response, tenant }: HttpContext) {
    const payload = await request.validateUsing(replaceEstablishmentAddressValidator)
    const address = await this.addressService.replace(
      tenant!.id,
      Number(params.id),
      auth.getUserOrFail(),
      payload
    )
    return response.ok(address)
  }

  async categories({ auth, params, request, response, tenant }: HttpContext) {
    const payload = await request.validateUsing(replaceEstablishmentCategoriesValidator)
    const categories = await this.categoriesService.replace(
      tenant!.id,
      Number(params.id),
      auth.getUserOrFail(),
      payload.categories
    )
    return response.ok(categories)
  }

  async attributes({ auth, params, request, response, tenant }: HttpContext) {
    const payload = await request.validateUsing(replaceEstablishmentAttributesValidator)
    const attributes = await this.attributesService.replace(
      tenant!.id,
      Number(params.id),
      auth.getUserOrFail(),
      payload.attributes
    )
    return response.ok(attributes)
  }

  async hours({ auth, params, request, response, tenant }: HttpContext) {
    const payload = await request.validateUsing(replaceEstablishmentHoursValidator)
    const hours = await this.hoursService.replaceWeekly(
      tenant!.id,
      Number(params.id),
      auth.getUserOrFail(),
      payload.hours
    )
    return response.ok(hours)
  }

  async specialDays({ auth, params, request, response, tenant }: HttpContext) {
    const payload = await request.validateUsing(replaceEstablishmentSpecialDaysValidator)
    const specialDays = await this.hoursService.replaceSpecialDays(
      tenant!.id,
      Number(params.id),
      auth.getUserOrFail(),
      payload.special_days
    )
    return response.ok(specialDays)
  }

  async effectiveAttributes({ params, response, tenant }: HttpContext) {
    const attributes = await this.attributesService.effective(tenant!.id, Number(params.categoryId))
    return response.ok(attributes)
  }
}
