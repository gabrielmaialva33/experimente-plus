import vine from '@vinejs/vine'

export const benefitPresentationRequestValidator = vine.compile(
  vine.object({
    access_id: vine.number().min(1),
    offer_id: vine.number().min(1),
  })
)

export const benefitPresentationTokenValidator = vine.compile(
  vine.object({
    token: vine.string().trim().minLength(1),
  })
)
