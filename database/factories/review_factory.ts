import factory from '@adonisjs/lucid/factories'
import { DateTime } from 'luxon'

import { throwawayDigest } from '#database/factories/support/throwaway'
import IReview from '#modules/reviews/interfaces/review_interface'
import AutomaticModerationPolicy from '#modules/reviews/models/automatic_moderation_policy'
import ContentReport from '#modules/reviews/models/content_report'
import EstablishmentReview from '#modules/reviews/models/establishment_review'
import EstablishmentReviewPhoto from '#modules/reviews/models/establishment_review_photo'
import EstablishmentReviewReply from '#modules/reviews/models/establishment_review_reply'
import ReviewPolicy from '#modules/reviews/models/review_policy'
import ReviewPhotoRepository from '#modules/reviews/repositories/review_photo_repository'
import { buildProtocolNumber } from '#modules/reviews/services/report_protocol'

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

const PHOTO_ALT_TEXTS = [
  'Prato servido na visita',
  'Mesa na área externa ao fim da tarde',
  'Vitrine de doces da casa',
  'Fachada vista da calçada',
] as const

/**
 * A photo of a review, reusing a `MediaAsset` of the same establishment (one
 * photo per asset). Without an explicit `sort_order` it goes after the
 * review's other photos, and the review's `photos_count` follows, as
 * `ReviewPhotoService` keeps them.
 */
export const EstablishmentReviewPhotoFactory = factory
  .define(EstablishmentReviewPhoto, ({ faker }) => ({
    tenant_id: 1,
    establishment_id: 1,
    review_id: 1,
    media_asset_id: 1,
    alt_text: faker.helpers.arrayElement(PHOTO_ALT_TEXTS),
  }))
  .before('create', async (_builder, photo, { $trx }) => {
    if (photo.sort_order !== undefined) return
    photo.sort_order = await new ReviewPhotoRepository().nextSortOrder(
      photo.tenant_id,
      photo.review_id,
      $trx!
    )
  })
  .after('create', async (_builder, photo, { $trx }) => {
    const count = await new ReviewPhotoRepository().countForReview(
      photo.tenant_id,
      photo.review_id,
      $trx!
    )
    await EstablishmentReview.query({ client: $trx })
      .where('tenant_id', photo.tenant_id)
      .where('id', photo.review_id)
      .update({ photos_count: count })
  })
  .build()

/**
 * The review rules of an operation, one row per tenant, from the provisional
 * defaults the service applies; the report deadline is the column default,
 * read back as `ReviewPolicyRepository` does.
 */
export const ReviewPolicyFactory = factory
  .define(ReviewPolicy, () => ({
    tenant_id: 1,
    ...IReview.DEFAULT_REVIEW_POLICY,
  }))
  .state('visitProof', (policy) => {
    policy.require_visit_proof = true
  })
  .state('strict', (policy) => {
    policy.min_text_length = 30
    policy.max_text_length = 500
    policy.max_photos = 2
    policy.daily_limit_per_user = 1
    policy.report_moderation_days = 2
  })
  .after('create', async (_builder, policy, { $trx }) => {
    if ($trx) policy.useTransaction($trx)
    await policy.refresh()
  })
  .build()

/**
 * The automatic moderation rules of an operation (ADR-0031), one row per
 * tenant, from the provisional defaults: links flagged, contacts, payment data
 * and blocked terms held, and no blocked vocabulary.
 */
export const AutomaticModerationPolicyFactory = factory
  .define(AutomaticModerationPolicy, () => ({
    tenant_id: 1,
    ...IReview.DEFAULT_AUTOMATIC_MODERATION_POLICY,
    blocked_terms: [],
  }))
  .state('off', (policy) => {
    policy.merge({
      link_mode: 'off',
      contact_mode: 'off',
      payment_data_mode: 'off',
      blocked_term_mode: 'off',
    })
  })
  .state('holdAll', (policy) => {
    policy.merge({
      link_mode: 'hold',
      contact_mode: 'hold',
      payment_data_mode: 'hold',
      blocked_term_mode: 'hold',
    })
  })
  .state('blockedTerms', (policy) => {
    policy.blocked_terms = ['golpe do pix', 'pirâmide financeira']
  })
  .build()

/**
 * A report a signed-in person filed about a review, waiting in the queue with
 * the deadline of the default policy. The reporter must be a member of the
 * tenant and reports a given target once; merge `target_type`/`target_id` for
 * another target (the column is not a foreign key, so keep it pointing at a
 * row of the same tenant). `anonymous`, `automatic` and `held` drop the
 * reporter, as the table requires of those origins.
 */
export const ContentReportFactory = factory
  .define(ContentReport, () => ({
    tenant_id: 1,
    protocol_number: buildProtocolNumber(),
    target_type: 'review' as const,
    target_id: 1,
    reporter_id: 1,
    is_anonymous: false,
    reporter_ip_hash: null,
    reporter_token_hash: null,
    reason: 'offensive' as const,
    details: 'O comentário ofende a equipe do estabelecimento.',
    status: 'pending' as const,
    assigned_to: null,
    due_at: DateTime.now().plus({ days: 5 }),
    sla_notified_at: null,
    resolved_by: null,
    resolved_at: null,
    resolution_action: null,
    resolution_notes: null,
    origin: 'user' as const,
    automatic_rule: null,
    automatic_evidence: null,
    holds_content: false,
  }))
  .state('underReview', (report) => {
    report.status = 'under_review'
  })
  .state('resolved', (report) => {
    // Merge `resolved_by` with a moderator; the fallbacks only keep the row valid.
    report.status = 'resolved'
    report.resolved_by ??= report.assigned_to ?? report.reporter_id
    report.resolved_at = DateTime.now()
    report.resolution_action = 'content_hidden'
    report.resolution_notes = 'Conteúdo ocultado por violar as regras da comunidade.'
  })
  .state('dismissed', (report) => {
    report.status = 'dismissed'
    report.resolved_by ??= report.assigned_to ?? report.reporter_id
    report.resolved_at = DateTime.now()
    report.resolution_notes = 'O conteúdo segue as regras da comunidade.'
  })
  .state('overdue', (report) => {
    report.due_at = DateTime.now().minus({ days: 1 })
  })
  .state('anonymous', (report) => {
    report.reporter_id = null
    report.is_anonymous = true
    report.reporter_ip_hash = throwawayDigest()
    report.reporter_token_hash = throwawayDigest()
  })
  .state('automatic', (report) => {
    report.origin = 'automatic'
    report.reporter_id = null
    report.automatic_rule = 'link'
    report.automatic_evidence = 'link: loja.example.test'
    report.reason = IReview.AUTOMATIC_RULE_REASON.link
    report.details = 'Aberta por regra automática: link externo (link: loja.example.test).'
  })
  .state('held', (report) => {
    report.origin = 'automatic'
    report.reporter_id = null
    report.automatic_rule = 'contact'
    report.automatic_evidence = 'telefone terminado em 21'
    report.reason = IReview.AUTOMATIC_RULE_REASON.contact
    report.details =
      'Aberta por regra automática: dados de contato (telefone terminado em 21) — conteúdo retido.'
    report.holds_content = true
  })
  .build()
