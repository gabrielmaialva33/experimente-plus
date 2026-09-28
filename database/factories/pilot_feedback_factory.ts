import factory from '@adonisjs/lucid/factories'
import { DateTime } from 'luxon'

import PilotFeedback from '#modules/pilot_feedback/models/pilot_feedback'

const MESSAGES: Record<number, string> = {
  5: 'Cadastrei a unidade em poucos minutos e as fotos apareceram certinhas.',
  4: 'Gostei do painel, mas senti falta de um aviso quando a revisão é aprovada.',
  3: 'Consegui publicar, só não ficou claro onde editar o horário de feriado.',
  2: 'Demorei para entender por que a revisão voltou com pendências.',
}

/**
 * Feedback a partner left during the pilot, new by default. It is about the
 * pilot in general; merge `organization_id` (and `establishment_id`, which
 * the table only accepts together with its organization) with the matching
 * `context` to point it at a unit. The reviewed states fall back to the
 * author as reviewer so the row stays valid; merge `reviewed_by` with staff.
 */
export const PilotFeedbackFactory = factory
  .define(PilotFeedback, ({ faker }) => {
    const rating = faker.helpers.arrayElement([5, 4, 3, 2])
    return {
      tenant_id: 1,
      user_id: 1,
      organization_id: null,
      establishment_id: null,
      context: 'general' as const,
      rating,
      message: MESSAGES[rating],
      status: 'new' as const,
      reviewed_by: null,
      reviewed_at: null,
      internal_notes: null,
    }
  })
  .state('inReview', (feedback) => {
    feedback.status = 'in_review'
    feedback.reviewed_by ??= feedback.user_id
    feedback.reviewed_at = DateTime.utc()
  })
  .state('resolved', (feedback) => {
    feedback.status = 'resolved'
    feedback.reviewed_by ??= feedback.user_id
    feedback.reviewed_at = DateTime.utc()
    feedback.internal_notes = 'Ajuste incluído no próximo ciclo do piloto.'
  })
  .state('dismissed', (feedback) => {
    feedback.status = 'dismissed'
    feedback.reviewed_by ??= feedback.user_id
    feedback.reviewed_at = DateTime.utc()
    feedback.internal_notes = 'Comportamento esperado; orientação enviada ao parceiro.'
  })
  .build()
