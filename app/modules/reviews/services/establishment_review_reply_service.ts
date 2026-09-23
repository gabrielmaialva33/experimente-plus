import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

import BadRequestException from '#exceptions/bad_request_exception'
import ForbiddenException from '#exceptions/forbidden_exception'
import NotFoundException from '#exceptions/not_found_exception'
import Establishment from '#modules/establishments/models/establishment'
import OrganizationPolicyService from '#modules/organizations/services/organization_policy_service'
import type IReview from '#modules/reviews/interfaces/review_interface'
import type EstablishmentReviewReply from '#modules/reviews/models/establishment_review_reply'
import EstablishmentReviewReplyRepository from '#modules/reviews/repositories/establishment_review_reply_repository'
import EstablishmentReviewRepository from '#modules/reviews/repositories/establishment_review_repository'
import AutomaticModerationService from '#modules/reviews/services/automatic_moderation_service'
import type User from '#modules/users/models/user'

@inject()
export default class EstablishmentReviewReplyService {
  constructor(
    private replyRepository: EstablishmentReviewReplyRepository,
    private reviewRepository: EstablishmentReviewRepository,
    private organizationPolicy: OrganizationPolicyService,
    private automod: AutomaticModerationService
  ) {}

  async reply(
    tenantId: number,
    reviewId: number,
    actor: User,
    payload: IReview.CreateReplyPayload
  ): Promise<EstablishmentReviewReply> {
    return db.transaction(async (client) => {
      const review = await this.reviewRepository.findById(tenantId, reviewId, client, true)
      if (!review) {
        throw new NotFoundException('Review not found')
      }

      const establishment = await Establishment.query({ client })
        .where('tenant_id', tenantId)
        .where('id', review.establishment_id)
        .first()

      if (!establishment) {
        throw new NotFoundException('Establishment not found')
      }

      const decision = await this.organizationPolicy.resolveAccess(
        actor,
        tenantId,
        establishment.organization_id,
        client
      )

      if (!decision.capabilities.manage_establishments) {
        throw new ForbiddenException(
          'An active organization membership with management privileges is required'
        )
      }

      const existingReply = await this.replyRepository.findByReviewId(tenantId, reviewId, client)
      if (existingReply) {
        throw new BadRequestException('A reply has already been submitted for this review')
      }

      const comment = payload.comment.trim()
      if (comment.length === 0) {
        throw new BadRequestException('Reply text cannot be empty')
      }

      // ADR-0031: contact data in a partner's reply is exactly the "contatos
      // publicados em desacordo" of Anexo I item 9.
      const assessment = await this.automod.assess(tenantId, [comment], client)

      const reply = await this.replyRepository.create(
        {
          tenant_id: tenantId,
          review_id: review.id,
          organization_id: establishment.organization_id,
          user_id: actor.id,
          comment,
          status: assessment.hold ? 'hidden' : 'published',
        },
        { client }
      )

      await this.automod.record(tenantId, 'reply', reply.id, assessment, client)
      return reply
    })
  }

  async updateReply(
    tenantId: number,
    reviewId: number,
    actor: User,
    payload: IReview.CreateReplyPayload
  ): Promise<EstablishmentReviewReply> {
    return db.transaction(async (client) => {
      const reply = await this.replyRepository.findByReviewId(tenantId, reviewId, client)
      if (!reply) {
        throw new NotFoundException('Reply not found')
      }

      const decision = await this.organizationPolicy.resolveAccess(
        actor,
        tenantId,
        reply.organization_id,
        client
      )

      if (!decision.capabilities.manage_establishments) {
        throw new ForbiddenException(
          'An active organization membership with management privileges is required'
        )
      }

      const comment = payload.comment.trim()
      if (comment.length === 0) {
        throw new BadRequestException('Reply text cannot be empty')
      }

      const assessment =
        comment !== reply.comment && reply.status === 'published'
          ? await this.automod.assess(tenantId, [comment], client)
          : null

      reply.useTransaction(client)
      reply.comment = comment
      reply.edited_at = DateTime.utc()
      if (assessment?.hold) reply.status = 'hidden'
      await reply.save()

      if (assessment) await this.automod.record(tenantId, 'reply', reply.id, assessment, client)
      return reply
    })
  }
}
