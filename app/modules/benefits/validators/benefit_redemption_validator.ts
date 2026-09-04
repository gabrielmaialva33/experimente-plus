import vine from '@vinejs/vine'

import {
  BENEFIT_PRESENTATION_TOKEN_MAX_LENGTH,
  BENEFIT_PRESENTATION_TOKEN_MIN_LENGTH,
  BENEFIT_PRESENTATION_TOKEN_PATTERN,
} from '#modules/benefits/constants/benefit_redemption'

export const benefitPresentationRequestValidator = vine.compile(
  vine.object({
    access_id: vine.number({ strict: true }).withoutDecimals().min(1).max(2_147_483_647),
    offer_id: vine.number({ strict: true }).withoutDecimals().min(1).max(2_147_483_647),
  })
)

export const benefitPresentationTokenValidator = vine.compile(
  vine.object({
    token: vine
      .string()
      .maxLength(BENEFIT_PRESENTATION_TOKEN_MAX_LENGTH)
      .trim()
      .minLength(BENEFIT_PRESENTATION_TOKEN_MIN_LENGTH)
      .regex(BENEFIT_PRESENTATION_TOKEN_PATTERN),
  })
)
