import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

import BadRequestException from '#exceptions/bad_request_exception'
import ForbiddenException from '#exceptions/forbidden_exception'
import NotFoundException from '#exceptions/not_found_exception'
import BenefitRedemption from '#modules/benefits/models/benefit_redemption'
import Establishment from '#modules/establishments/models/establishment'
import OrganizationPolicyService from '#modules/organizations/services/organization_policy_service'
import type IReview from '#modules/reviews/interfaces/review_interface'
import type EstablishmentReview from '#modules/reviews/models/establishment_review'
import EstablishmentReviewRepository from '#modules/reviews/repositories/establishment_review_repository'
import ReviewPolicyRepository from '#modules/reviews/repositories/review_policy_repository'
import UserBanRepository from '#modules/reviews/repositories/user_ban_repository'
import type User from '#modules/users/models/user'

@inject()
export default class EstablishmentReviewService {
  constructor(
    private reviewRepository: EstablishmentReviewRepository,
    private policyRepository: ReviewPolicyRepository,
    private organizationPolicy: OrganizationPolicyService,
    private userBans: UserBanRepository
  ) {}

  async create(
    tenantId: number,
    actor: User,
    payload: IReview.CreateReviewPayload
  ): Promise<EstablishmentReview> {
    return db.transaction(async (client) => {
      const policy = await this.policyRepository.getForTenant(tenantId, client)

      const establishment = await Establishment.query({ client })
        .where('tenant_id', tenantId)
        .where('id', payload.establishment_id)
        .first()

      if (!establishment || establishment.lifecycle_status !== 'active') {
        throw new NotFoundException('Establishment not found or inactive')
      }

      const existingReview = await this.reviewRepository.findByUserAndEstablishment(
        tenantId,
        actor.id,
        payload.establishment_id,
        client
      )

      if (existingReview) {
        throw new BadRequestException('User has already reviewed this establishment')
      }

      const comment = this.normalizeText(payload.comment)
      this.validateTextLength(comment, policy.min_text_length, policy.max_text_length)

      const photosCount = payload.photos_count ?? 0
      if (photosCount > policy.max_photos) {
        throw new BadRequestException(
          `Maximum photos limit exceeded (allowed: ${policy.max_photos})`
        )
      }

      const startOfDay = DateTime.utc().startOf('day').toJSDate()
      const todayCount = await this.reviewRepository.countUserReviewsSince(
        tenantId,
        actor.id,
        startOfDay,
        client
      )

      if (todayCount >= policy.daily_limit_per_user) {
        throw new BadRequestException('Daily review limit exceeded')
      }

      let redemptionId: number | null = null
      if (policy.require_visit_proof) {
        if (!payload.redemption_id) {
          throw new BadRequestException('Proof of visit redemption is required for this operation')
        }
        await this.validateRedemption(
          tenantId,
          payload.redemption_id,
          actor.id,
          payload.establishment_id,
          client
        )
        redemptionId = payload.redemption_id
      } else if (payload.redemption_id) {
        await this.validateRedemption(
          tenantId,
          payload.redemption_id,
          actor.id,
          payload.establishment_id,
          client
        )
        redemptionId = payload.redemption_id
      }

      const review = await this.reviewRepository.create(
        {
          tenant_id: tenantId,
          establishment_id: payload.establishment_id,
          user_id: actor.id,
          redemption_id: redemptionId,
          rating: payload.rating,
          comment,
          status: 'published',
          photos_count: photosCount,
          videos_count: 0,
        },
        { client }
      )

      return review
    })
  }

  async update(
    tenantId: number,
    id: number,
    actor: User,
    payload: IReview.UpdateReviewPayload
  ): Promise<EstablishmentReview> {
    return db.transaction(async (client) => {
      const review = await this.reviewRepository.findById(tenantId, id, client, true)
      if (!review) {
        throw new NotFoundException('Review not found')
      }

      if (review.user_id !== actor.id) {
        throw new ForbiddenException('You can only edit your own reviews')
      }

      const policy = await this.policyRepository.getForTenant(tenantId, client)
      const now = DateTime.utc()

      const daysSinceCreation = now.diff(review.created_at, 'days').days
      if (daysSinceCreation > policy.edit_window_days) {
        throw new BadRequestException('Edit window has expired')
      }

      if (review.edited_at) {
        const minutesSinceLastEdit = now.diff(review.edited_at, 'minutes').minutes
        if (minutesSinceLastEdit < policy.min_edit_interval_minutes) {
          throw new BadRequestException('Minimum interval between edits not reached')
        }
      }

      const comment =
        payload.comment !== undefined ? this.normalizeText(payload.comment) : review.comment
      this.validateTextLength(comment, policy.min_text_length, policy.max_text_length)

      const photosCount = payload.photos_count ?? review.photos_count
      if (photosCount > policy.max_photos) {
        throw new BadRequestException(
          `Maximum photos limit exceeded (allowed: ${policy.max_photos})`
        )
      }

      review.useTransaction(client)
      if (payload.rating !== undefined) {
        review.rating = payload.rating
      }
      review.comment = comment
      review.photos_count = photosCount
      review.edited_at = now
      await review.save()

      return review
    })
  }

  async delete(tenantId: number, id: number, actor: User): Promise<void> {
    await db.transaction(async (client) => {
      const review = await this.reviewRepository.findById(tenantId, id, client, true)
      if (!review) {
        throw new NotFoundException('Review not found')
      }

      const isOwner = review.user_id === actor.id
      if (!isOwner) {
        await this.organizationPolicy.requirePlatformModerator(actor)
      }

      review.useTransaction(client)
      review.status = 'archived'
      await review.save()
    })
  }

  async listPublic(tenantId: number, establishmentId: number, query: IReview.ListReviewsQuery) {
    return this.reviewRepository.paginateForEstablishment(tenantId, establishmentId, query)
  }

  async showPublic(tenantId: number, id: number): Promise<EstablishmentReview> {
    const review = await this.reviewRepository.findById(tenantId, id)
    // A banned author's review, and a review of an establishment that left
    // the catalogue, answer exactly like one that does not exist: otherwise
    // their address would stay a way around the ban (ADR-0027 §6) or around
    // the withdrawal (Anexo I item 14).
    if (
      !review ||
      review.status !== 'published' ||
      (await this.userBans.isBanned(tenantId, review.user_id)) ||
      !(await this.reviewRepository.isEstablishmentDiscoverable(tenantId, review.establishment_id))
    ) {
      throw new NotFoundException('Review not found')
    }
    return review
  }

  async listMyReviews(tenantId: number, actor: User, query: IReview.ListReviewsQuery) {
    return this.reviewRepository.paginateForUser(tenantId, actor.id, query)
  }

  private normalizeText(value: string | null | undefined): string | null {
    if (value === null || value === undefined) return null
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }

  private validateTextLength(comment: string | null, minLength: number, maxLength: number): void {
    if (comment === null) {
      if (minLength > 0) {
        throw new BadRequestException(`Review text must be at least ${minLength} characters`)
      }
      return
    }

    if (comment.length < minLength) {
      throw new BadRequestException(`Review text must be at least ${minLength} characters`)
    }
    if (comment.length > maxLength) {
      throw new BadRequestException(`Review text cannot exceed ${maxLength} characters`)
    }
  }

  private async validateRedemption(
    tenantId: number,
    redemptionId: number,
    userId: number,
    establishmentId: number,
    client: any
  ): Promise<void> {
    const redemption = await BenefitRedemption.query({ client })
      .where('tenant_id', tenantId)
      .where('id', redemptionId)
      .first()

    if (
      !redemption ||
      redemption.user_id !== userId ||
      redemption.establishment_id !== establishmentId
    ) {
      throw new BadRequestException('Valid proof of visit redemption is required')
    }
  }
}
