import factory from '@adonisjs/lucid/factories'

import EstablishmentReview from '#modules/reviews/models/establishment_review'
import EstablishmentReviewReply from '#modules/reviews/models/establishment_review_reply'

const COMMENTS: Record<number, string[]> = {
  5: ['Atendimento atencioso e tudo muito bem feito. Volto com certeza.'],
  4: ['Gostei bastante, só demorou um pouco no horário de pico.'],
  3: ['Experiência mediana: algumas coisas boas, outras esquecíveis.'],
  2: ['Esperamos muito e o pedido chegou frio.'],
  1: ['Não foi uma boa experiência desta vez.'],
}

/**
 * A published review with a pt-BR comment matching its rating. Rows written
 * here skip the review policy and automatic moderation; use
 * `EstablishmentReviewService` in tests about those rules.
 */
export const EstablishmentReviewFactory = factory
  .define(EstablishmentReview, ({ faker }) => {
    const rating = faker.helpers.weightedArrayElement([
      { value: 5, weight: 5 },
      { value: 4, weight: 3 },
      { value: 3, weight: 1 },
      { value: 2, weight: 1 },
    ])
    return {
      tenant_id: 1,
      establishment_id: 1,
      user_id: 1,
      redemption_id: null,
      rating,
      comment: faker.helpers.arrayElement(COMMENTS[rating]),
      status: 'published' as const,
      photos_count: 0,
      videos_count: 0,
      edited_at: null,
    }
  })
  .state('hidden', (review) => {
    review.status = 'hidden'
  })
  .state('archived', (review) => {
    review.status = 'archived'
  })
  .build()

export const EstablishmentReviewReplyFactory = factory
  .define(EstablishmentReviewReply, () => ({
    tenant_id: 1,
    review_id: 1,
    organization_id: 1,
    user_id: 1,
    comment: 'Obrigado pela visita! Seu retorno já foi compartilhado com a equipe.',
    status: 'published' as const,
    edited_at: null,
  }))
  .build()
