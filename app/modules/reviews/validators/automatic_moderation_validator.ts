import vine from '@vinejs/vine'

import IReview from '#modules/reviews/interfaces/review_interface'

const mode = () => vine.enum(IReview.AUTOMATIC_MODES).optional()

export const updateAutomaticModerationPolicyValidator = vine.compile(
  vine.object({
    link_mode: mode(),
    contact_mode: mode(),
    payment_data_mode: mode(),
    blocked_term_mode: mode(),
    blocked_terms: vine
      .array(vine.string().trim().minLength(2).maxLength(80))
      .maxLength(500)
      .optional(),
  })
)
