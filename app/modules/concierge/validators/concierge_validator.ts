import vine from '@vinejs/vine'

/**
 * The question is free text from a consumer and the only thing that leaves the
 * operation besides the catalogue excerpt, so its size is bounded here rather
 * than trusted to the provider — ADR-0029.
 */
export const conciergeAskValidator = vine.compile(
  vine.object({
    question: vine.string().trim().minLength(3).maxLength(300),
    city: vine.string().trim().toLowerCase().maxLength(120).optional(),
  })
)
