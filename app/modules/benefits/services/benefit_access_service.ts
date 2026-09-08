import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'

import BadRequestException from '#exceptions/bad_request_exception'
import NotFoundException from '#exceptions/not_found_exception'
import type IBenefitAccess from '#modules/benefits/interfaces/benefit_access_interface'
import BenefitAccess from '#modules/benefits/models/benefit_access'
import BenefitEdition from '#modules/benefits/models/benefit_edition'
import BenefitOffer from '#modules/benefits/models/benefit_offer'
import BenefitAccessRepository from '#modules/benefits/repositories/benefit_access_repository'
import BenefitAuditService from '#modules/benefits/services/benefit_audit_service'
import OrganizationPolicyService from '#modules/organizations/services/organization_policy_service'
import BenefitFinancialHoldService from '#modules/benefits/services/benefit_financial_hold_service'
import User from '#modules/users/models/user'

type DatabaseError = Error & { code?: string; constraint?: string }

@inject()
export default class BenefitAccessService {
  constructor(
    private accessRepository: BenefitAccessRepository,
    private organizationPolicy: OrganizationPolicyService,
    private audit: BenefitAuditService
  ) {}

  async list(tenantId: number, actor: User): Promise<BenefitAccess[]> {
    await this.organizationPolicy.requirePlatformModerator(actor)
    return this.accessRepository.listForTenant(tenantId)
  }

  async grant(
    tenantId: number,
    actor: User,
    payload: IBenefitAccess.GrantPayload
  ): Promise<BenefitAccess> {
    await this.organizationPolicy.requirePlatformAdmin(actor)

    const email = payload.email.trim().toLowerCase()
    const source = payload.source ?? 'manual'
    const externalReference = this.normalizeOptionalText(payload.external_reference)
    const notes = this.normalizeOptionalText(payload.notes)

    if (source === 'payment' && !externalReference) {
      throw new BadRequestException('Payment access requires an external reference')
    }

    let accessId: number
    try {
      accessId = await db.transaction(async (client) => {
        const edition = await this.getGrantableEdition(tenantId, payload.edition_id, client)
        const holder = await this.findHolderForTenant(tenantId, email, client)
        if (payload.offer_id !== null && payload.offer_id !== undefined) {
          const offer = await BenefitOffer.query({ client })
            .where({
              id: payload.offer_id,
              tenant_id: tenantId,
              edition_id: edition.id,
            })
            .first()
          if (
            !offer ||
            !['active', 'paused'].includes(offer.status) ||
            (offer.ends_at && offer.ends_at <= DateTime.utc())
          )
            throw new BadRequestException('Offer is not available for access grants')
        }

        if (
          await this.accessRepository.findActive(
            tenantId,
            edition.id,
            holder.id,
            client,
            payload.offer_id ?? null
          )
        ) {
          throw new BadRequestException('This user already has active access to this product')
        }

        const access = await this.accessRepository.create(
          {
            tenant_id: tenantId,
            edition_id: edition.id,
            offer_id: payload.offer_id ?? null,
            user_id: holder.id,
            source,
            status: 'active',
            external_reference: externalReference,
            notes,
            granted_by: actor.id,
            granted_at: DateTime.utc(),
            revoked_by: null,
            revoked_at: null,
            revocation_reason: null,
          },
          client
        )

        return access.id
      })
    } catch (error) {
      const databaseError = error as DatabaseError
      if (
        databaseError.code === '23505' &&
        databaseError.constraint === 'benefit_accesses_active_holder_unique'
      ) {
        throw new BadRequestException('This user already has active access to this product')
      }
      if (
        databaseError.code === '23505' &&
        databaseError.constraint === 'benefit_accesses_external_reference_unique'
      ) {
        throw new BadRequestException('This external access reference was already processed')
      }
      throw error
    }

    await this.audit.log({
      actorId: actor.id,
      resource: 'benefit_accesses',
      action: 'grant',
      resourceId: accessId,
      metadata: {
        edition_id: payload.edition_id,
        offer_id: payload.offer_id ?? null,
        email,
        source,
      },
    })

    return this.getOrFail(tenantId, accessId)
  }

  async revoke(
    tenantId: number,
    id: number,
    actor: User,
    payload: IBenefitAccess.RevokePayload
  ): Promise<BenefitAccess> {
    await this.organizationPolicy.requirePlatformAdmin(actor)
    const reason = this.normalizeOptionalText(payload.reason)

    await db.transaction(async (client) => {
      const access = await this.accessRepository.findLocked(tenantId, id, client)
      if (!access) {
        throw new NotFoundException('Benefit access not found')
      }
      if (access.status !== 'active') {
        throw new BadRequestException('Benefit access is already revoked')
      }

      access.status = 'revoked'
      access.revoked_by = actor.id
      access.revoked_at = DateTime.utc()
      access.revocation_reason = reason
      await access.save()
    })

    await this.audit.log({
      actorId: actor.id,
      resource: 'benefit_accesses',
      action: 'revoke',
      resourceId: id,
      metadata: { reason },
    })

    return this.getOrFail(tenantId, id)
  }

  async wallet(tenantId: number, actor: User): Promise<IBenefitAccess.WalletProjection> {
    return this.buildWallet(tenantId, actor)
  }

  private async buildWallet(
    tenantId: number,
    holder: User
  ): Promise<IBenefitAccess.WalletProjection> {
    const accesses = await this.accessRepository.listForHolder(tenantId, holder.id)
    const latestByScope = new Map<string, BenefitAccess>()

    for (const access of accesses) {
      const scope = [access.edition_id, access.offer_id ?? 'edition'].join(':')
      if (!latestByScope.has(scope)) {
        latestByScope.set(scope, access)
      }
    }

    const blocked = await new BenefitFinancialHoldService().blockedIds(
      tenantId,
      accesses.map((access) => access.id)
    )
    const now = DateTime.utc()
    const passes = [...latestByScope.values()].map((access) => {
      const financiallyBlocked = blocked.has(access.id)
      const selectedOffer =
        access.offer_id === null
          ? null
          : access.edition.offers.find((offer) => offer.id === access.offer_id)
      const usageStartsAt = selectedOffer?.starts_at
        ? DateTime.max(access.edition.usage_starts_at, selectedOffer.starts_at)
        : access.edition.usage_starts_at
      const usageEndsAt = selectedOffer?.ends_at
        ? DateTime.min(access.edition.usage_ends_at, selectedOffer.ends_at)
        : access.edition.usage_ends_at
      let availability =
        financiallyBlocked && access.status === 'active'
          ? 'paused'
          : this.resolvePassAvailability(access, now)
      if (selectedOffer)
        availability = this.resolveOfferAvailability(access, selectedOffer, availability, now)
      const benefits = access.edition.offers
        .filter((offer) =>
          access.offer_id === null ? offer.status === 'active' : access.offer_id === offer.id
        )
        .map((offer) => this.projectBenefit(access, offer, availability, now))

      return {
        access: {
          id: access.id,
          offer_id: access.offer_id,
          product_type: access.offer_id === null ? 'edition' : 'offer',
          usage_starts_at: usageStartsAt.toISO()!,
          usage_ends_at: usageEndsAt.toISO()!,
          source: access.source,
          status: access.status,
          granted_at: access.granted_at.toISO()!,
          availability,
          financially_blocked: financiallyBlocked,
        },
        edition: {
          id: access.edition.id,
          name: access.edition.name,
          slug: access.edition.slug,
          description: access.edition.description,
          price_cents: access.edition.price_cents,
          currency: access.edition.currency,
          usage_starts_at: access.edition.usage_starts_at.toISO()!,
          usage_ends_at: access.edition.usage_ends_at.toISO()!,
          status: access.edition.status,
          city: {
            id: access.edition.city.id,
            name: access.edition.city.name,
            slug: access.edition.city.slug,
            state_code: access.edition.city.state_code,
            timezone: access.edition.city.timezone,
          },
        },
        benefits,
      } satisfies IBenefitAccess.WalletPass
    })

    return {
      summary: {
        passes: passes.length,
        benefits: passes.reduce((total, pass) => total + pass.benefits.length, 0),
        available: passes.reduce(
          (total, pass) =>
            total + pass.benefits.filter((benefit) => benefit.availability === 'available').length,
          0
        ),
        upcoming: passes.reduce(
          (total, pass) =>
            total + pass.benefits.filter((benefit) => benefit.availability === 'upcoming').length,
          0
        ),
        redeemed: 0,
      },
      passes,
    }
  }

  private async getOrFail(tenantId: number, id: number): Promise<BenefitAccess> {
    const access = await this.accessRepository.findByIdForTenant(tenantId, id)
    if (!access) {
      throw new NotFoundException('Benefit access not found')
    }
    return access
  }

  private async getGrantableEdition(
    tenantId: number,
    editionId: number,
    client: TransactionClientContract
  ): Promise<BenefitEdition> {
    const edition = await BenefitEdition.query({ client })
      .where('tenant_id', tenantId)
      .where('id', editionId)
      .forUpdate()
      .first()

    if (!edition) {
      throw new NotFoundException('Benefit edition not found')
    }
    if (!['published', 'paused'].includes(edition.status)) {
      throw new BadRequestException('Only a published edition can receive access grants')
    }
    if (edition.usage_ends_at <= DateTime.utc()) {
      throw new BadRequestException('Expired editions cannot receive access grants')
    }

    return edition
  }

  private async findHolderForTenant(
    tenantId: number,
    email: string,
    client: TransactionClientContract
  ): Promise<User> {
    const holder = await User.query({ client })
      .whereRaw('LOWER(email) = ?', [email])
      .whereHas('tenants', (query) => query.where('tenants.id', tenantId))
      .first()

    if (!holder) {
      throw new BadRequestException('User must already belong to this operation')
    }

    return holder
  }

  private resolvePassAvailability(
    access: BenefitAccess,
    now: DateTime
  ): IBenefitAccess.Availability {
    if (access.status === 'revoked') return 'revoked'
    if (access.edition.status === 'archived' || now > access.edition.usage_ends_at) {
      return 'expired'
    }
    if (now < access.edition.usage_starts_at) return 'upcoming'
    if (access.edition.status !== 'published') return 'paused'
    return 'available'
  }

  private projectBenefit(
    access: BenefitAccess,
    offer: BenefitOffer,
    passAvailability: IBenefitAccess.Availability,
    now: DateTime
  ): IBenefitAccess.WalletBenefit {
    const revision = offer.establishment.published_revision
    const availability = this.resolveOfferAvailability(access, offer, passAvailability, now)

    return {
      key: `${access.id}:${offer.id}`,
      access_id: access.id,
      offer_id: offer.id,
      availability,
      title: offer.title,
      description: offer.description,
      benefit_type: offer.benefit_type,
      discount_percentage: offer.discount_percentage,
      discount_amount_cents: offer.discount_amount_cents,
      terms: offer.terms,
      available_weekdays_mask: offer.available_weekdays_mask,
      daily_start_time: offer.daily_start_time,
      daily_end_time: offer.daily_end_time,
      reservation_required: offer.reservation_required,
      on_premise_only: offer.on_premise_only,
      minimum_party_size: offer.minimum_party_size,
      max_redemptions_per_access: offer.max_redemptions_per_access,
      establishment: {
        id: offer.establishment.id,
        public_name: revision?.public_name ?? 'Estabelecimento participante',
        slug: revision?.slug ?? null,
      },
    }
  }

  private resolveOfferAvailability(
    access: BenefitAccess,
    offer: BenefitOffer,
    passAvailability: IBenefitAccess.Availability,
    now: DateTime
  ): IBenefitAccess.Availability {
    if (passAvailability !== 'available') return passAvailability
    if (offer.status === 'archived') return 'expired'
    if (offer.status !== 'active') return 'paused'
    if (
      offer.establishment.lifecycle_status !== 'active' ||
      offer.establishment.business_status === 'permanently_closed'
    )
      return 'paused'
    if (offer.starts_at && now < offer.starts_at) return 'upcoming'
    if (offer.ends_at && now > offer.ends_at) return 'expired'

    const timezone = access.edition.city.timezone || 'America/Sao_Paulo'
    const localNow = now.setZone(timezone)
    const weekdayBit = localNow.weekday === 7 ? 1 : 1 << localNow.weekday
    if ((offer.available_weekdays_mask & weekdayBit) === 0) {
      return 'outside_schedule'
    }

    if (offer.daily_start_time && offer.daily_end_time) {
      const currentTime = localNow.toFormat('HH:mm')
      if (currentTime < offer.daily_start_time || currentTime > offer.daily_end_time) {
        return 'outside_schedule'
      }
    }

    return 'available'
  }

  private normalizeOptionalText(value: string | null | undefined): string | null {
    const normalized = value?.trim()
    return normalized || null
  }
}
