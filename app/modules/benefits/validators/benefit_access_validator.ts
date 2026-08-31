import vine from '@vinejs/vine'

import { BENEFIT_ACCESS_SOURCES } from '#modules/benefits/interfaces/benefit_access_interface'

export const grantBenefitAccessValidator = vine.compile(
  vine.object({
    edition_id: vine.number().min(1),
    email: vine.string().trim().email().maxLength(254),
    source: vine.enum(BENEFIT_ACCESS_SOURCES).optional(),
    external_reference: vine.string().trim().maxLength(255).nullable().optional(),
    notes: vine.string().trim().maxLength(4000).nullable().optional(),
  })
)

export const revokeBenefitAccessValidator = vine.compile(
  vine.object({
    reason: vine.string().trim().maxLength(4000).nullable().optional(),
  })
)
