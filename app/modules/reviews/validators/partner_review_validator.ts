import vine, { SimpleMessagesProvider } from '@vinejs/vine'

import IReview from '#modules/reviews/interfaces/review_interface'

export const partnerReviewsQueryValidator = vine.compile(
  vine.object({
    establishment: vine.number().withoutDecimals().min(1).optional(),
    filter: vine.enum(IReview.PARTNER_REVIEW_FILTERS).optional(),
    page: vine.number().withoutDecimals().min(1).optional(),
  })
)

/**
 * The reply form of the portal. The limits are the API's
 * (`createReplyValidator`), so the page is never a looser or stricter door
 * than the endpoint beside it; only the messages are the partner's language.
 */
export const partnerReplyFormValidator = vine.compile(
  vine.object({
    comment: vine.string().trim().minLength(1).maxLength(4000),
  })
)

/**
 * Passed explicitly to `request.validateUsing`: the request-wide i18n provider
 * would otherwise win over a provider attached to the compiled validator.
 */
export const partnerReplyMessages = new SimpleMessagesProvider({
  'comment.required': 'Escreva a resposta antes de publicar.',
  'comment.string': 'Escreva a resposta antes de publicar.',
  'comment.minLength': 'Escreva a resposta antes de publicar.',
  'comment.maxLength': 'A resposta pode ter até {{ max }} caracteres.',
})
