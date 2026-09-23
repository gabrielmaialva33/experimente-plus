import { inject } from '@adonisjs/core'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'

import OrganizationPolicyService from '#modules/organizations/services/organization_policy_service'
import IReview from '#modules/reviews/interfaces/review_interface'
import AutomaticModerationPolicy from '#modules/reviews/models/automatic_moderation_policy'
import ContentReport from '#modules/reviews/models/content_report'
import AutomaticModerationPolicyRepository from '#modules/reviews/repositories/automatic_moderation_policy_repository'
import ReviewPolicyRepository from '#modules/reviews/repositories/review_policy_repository'
import {
  runDetectors,
  type DetectorHit,
} from '#modules/reviews/services/automatic_moderation_detectors'
import { buildProtocolNumber } from '#modules/reviews/services/report_protocol'
import type User from '#modules/users/models/user'

export interface AutomaticHit extends DetectorHit {
  mode: Exclude<IReview.AutomaticMode, 'off'>
}

export interface Assessment {
  hits: AutomaticHit[]
  /** True when any hit's mode is `hold`: the caller keeps the content out of public view. */
  hold: boolean
}

const RULE_LABEL: Record<IReview.AutomaticRule, string> = {
  link: 'link externo',
  contact: 'dados de contato',
  payment_data: 'dados de pagamento',
  blocked_term: 'termo bloqueado',
}

const MODE_COLUMN: Record<
  IReview.AutomaticRule,
  keyof IReview.AutomaticModerationPolicyAttributes
> = {
  link: 'link_mode',
  contact: 'contact_mode',
  payment_data: 'payment_data_mode',
  blocked_term: 'blocked_term_mode',
}

/**
 * Automatic moderation — ADR-0031, Anexo I item 9.
 *
 * It never decides alone and never deletes. A rule that fires opens a report in
 * the single queue of ADR-0027, with no reporter, the rule and masked evidence;
 * in `hold` mode the caller also keeps the content out of public view until a
 * person resolves that report. A dismissal releases exactly what the rule held.
 *
 * Callers use it in two steps because the status has to be chosen before the
 * row exists and the report needs the row's id afterwards: `assess` before the
 * write, `record` after it, both inside the caller's transaction.
 */
@inject()
export default class AutomaticModerationService {
  constructor(
    private policies: AutomaticModerationPolicyRepository,
    private reviewPolicies: ReviewPolicyRepository,
    private organizationPolicy: OrganizationPolicyService
  ) {}

  async assess(
    tenantId: number,
    texts: Array<string | null | undefined>,
    client?: TransactionClientContract
  ): Promise<Assessment> {
    const policy = await this.policies.getForTenant(tenantId, client)
    const hits: AutomaticHit[] = []

    for (const hit of runDetectors(texts, policy.blocked_terms)) {
      const mode = policy[MODE_COLUMN[hit.rule]] as IReview.AutomaticMode
      if (mode === 'off') continue
      hits.push({ ...hit, mode })
    }

    return { hits, hold: hits.some((hit) => hit.mode === 'hold') }
  }

  /**
   * Opens — or refreshes — the automatic report of a target.
   *
   * One open automatic report per target: an author editing held text again
   * updates the same case instead of stacking reports about the same words.
   * A hold, once recorded, is not lifted by a later edit; only a person
   * resolving the report releases it.
   */
  async record(
    tenantId: number,
    targetType: IReview.ReportTargetType,
    targetId: number,
    assessment: Assessment,
    client: TransactionClientContract
  ): Promise<ContentReport | null> {
    if (assessment.hits.length === 0) return null

    const primary = assessment.hits.find((hit) => hit.mode === 'hold') ?? assessment.hits[0]
    const details =
      'Aberta por regra automática: ' +
      assessment.hits
        .map(
          (hit) =>
            `${RULE_LABEL[hit.rule]} (${hit.evidence})${hit.mode === 'hold' ? ' — conteúdo retido' : ''}`
        )
        .join('; ') +
      '.'

    const existing = await ContentReport.query({ client })
      .where('tenant_id', tenantId)
      .where('target_type', targetType)
      .where('target_id', targetId)
      .where('origin', 'automatic')
      .whereIn('status', ['pending', 'under_review'])
      .forUpdate()
      .first()

    if (existing) {
      existing.useTransaction(client)
      existing.automatic_rule = primary.rule
      existing.automatic_evidence = primary.evidence
      existing.reason = IReview.AUTOMATIC_RULE_REASON[primary.rule]
      existing.details = details
      existing.holds_content = existing.holds_content || assessment.hold
      await existing.save()
      return existing
    }

    const reviewPolicy = await this.reviewPolicies.getForTenant(tenantId, client)
    return ContentReport.create(
      {
        tenant_id: tenantId,
        protocol_number: buildProtocolNumber(),
        target_type: targetType,
        target_id: targetId,
        reporter_id: null,
        is_anonymous: false,
        reporter_ip_hash: null,
        reporter_token_hash: null,
        reason: IReview.AUTOMATIC_RULE_REASON[primary.rule],
        details,
        status: 'pending',
        assigned_to: null,
        due_at: DateTime.now().plus({ days: reviewPolicy.report_moderation_days }),
        sla_notified_at: null,
        resolved_by: null,
        resolved_at: null,
        resolution_action: null,
        resolution_notes: null,
        origin: 'automatic',
        automatic_rule: primary.rule,
        automatic_evidence: primary.evidence,
        holds_content: assessment.hold,
      },
      { client }
    )
  }

  async getPolicy(tenantId: number, actor: User): Promise<AutomaticModerationPolicy> {
    await this.organizationPolicy.requirePlatformAdmin(actor)
    return this.policies.getForTenant(tenantId)
  }

  async updatePolicy(
    tenantId: number,
    actor: User,
    payload: IReview.UpdateAutomaticModerationPolicyPayload
  ): Promise<AutomaticModerationPolicy> {
    await this.organizationPolicy.requirePlatformAdmin(actor)
    const terms = payload.blocked_terms
    return this.policies.updateForTenant(tenantId, {
      ...payload,
      // Stored trimmed and without duplicates, as the operator would read them.
      ...(terms
        ? { blocked_terms: [...new Set(terms.map((term) => term.trim()).filter(Boolean))] }
        : {}),
    })
  }
}
