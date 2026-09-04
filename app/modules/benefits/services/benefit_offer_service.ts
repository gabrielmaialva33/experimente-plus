import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'

import BadRequestException from '#exceptions/bad_request_exception'
import NotFoundException from '#exceptions/not_found_exception'
import type IBenefit from '#modules/benefits/interfaces/benefit_interface'
import BenefitEdition from '#modules/benefits/models/benefit_edition'
import BenefitOffer from '#modules/benefits/models/benefit_offer'
import BenefitOfferRepository from '#modules/benefits/repositories/benefit_offer_repository'
import BenefitAuditService from '#modules/benefits/services/benefit_audit_service'
import Establishment from '#modules/establishments/models/establishment'
import EstablishmentRevision from '#modules/establishments/models/establishment_revision'
import OrganizationPolicyService from '#modules/organizations/services/organization_policy_service'
import type User from '#modules/users/models/user'

type NormalizedOffer = {
  title: string
  description: string
  benefit_type: IBenefit.Type
  discount_percentage: number | null
  discount_amount_cents: number | null
  terms: string | null
  available_weekdays_mask: number
  daily_start_time: string | null
  daily_end_time: string | null
  starts_at: DateTime | null
  ends_at: DateTime | null
  reservation_required: boolean
  on_premise_only: boolean
  minimum_party_size: number
  max_redemptions_per_access: number
}

@inject()
export default class BenefitOfferService {
  constructor(
    private offerRepository: BenefitOfferRepository,
    private organizationPolicy: OrganizationPolicyService,
    private audit: BenefitAuditService
  ) {}

  async listForEstablishment(
    tenantId: number,
    establishmentId: number,
    actor: User
  ): Promise<BenefitOffer[]> {
    const establishment = await this.getEstablishmentOrFail(tenantId, establishmentId)
    await this.organizationPolicy.authorizeRead(actor, tenantId, establishment.organization_id)
    return this.offerRepository.listForEstablishment(tenantId, establishment.id)
  }

  async listForPortalEstablishment(
    tenantId: number,
    establishmentId: number,
    actor: User
  ): Promise<IBenefit.PortalOffer[]> {
    const offers = await this.listForEstablishment(tenantId, establishmentId, actor)

    return offers.map((offer) => ({
      id: offer.id,
      edition_id: offer.edition_id,
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
      status: offer.status,
      edition: {
        id: offer.edition.id,
        name: offer.edition.name,
        status: offer.edition.status,
        currency: offer.edition.currency,
        usage_starts_at: offer.edition.usage_starts_at.toISO()!,
        usage_ends_at: offer.edition.usage_ends_at.toISO()!,
        city: {
          id: offer.edition.city.id,
          name: offer.edition.city.name,
          state_code: offer.edition.city.state_code,
        },
      },
    }))
  }

  async show(tenantId: number, id: number, actor: User): Promise<BenefitOffer> {
    const offer = await this.getOrFail(tenantId, id)
    await this.organizationPolicy.authorizeRead(
      actor,
      tenantId,
      offer.establishment.organization_id
    )
    return offer
  }

  async create(
    tenantId: number,
    establishmentId: number,
    actor: User,
    payload: IBenefit.CreateOfferPayload
  ): Promise<BenefitOffer> {
    const offerId = await db.transaction(async (client) => {
      const establishment = await this.getEstablishmentOrFail(
        tenantId,
        establishmentId,
        client,
        true
      )
      await this.organizationPolicy.authorizeManageEstablishments(
        actor,
        tenantId,
        establishment.organization_id,
        client
      )

      const edition = await BenefitEdition.query({ client })
        .where('tenant_id', tenantId)
        .where('id', payload.edition_id)
        .forUpdate()
        .first()
      if (!edition || edition.status === 'archived') {
        throw new BadRequestException('Benefit edition is not available for offers')
      }

      await this.validateEstablishmentForEdition(tenantId, establishment, edition, client)
      if (
        await this.offerRepository.existsForEditionEstablishment(
          edition.id,
          establishment.id,
          client
        )
      ) {
        throw new BadRequestException('This establishment already has an offer in the edition')
      }

      const normalized = this.normalizeOffer(payload, null, edition)
      const offer = await this.offerRepository.create(
        {
          tenant_id: tenantId,
          edition_id: edition.id,
          establishment_id: establishment.id,
          ...normalized,
          status: 'draft',
          created_by: actor.id,
          activated_at: null,
          archived_at: null,
        },
        client
      )
      return offer.id
    })

    await this.audit.log({
      actorId: actor.id,
      resource: 'benefit_offers',
      action: 'create',
      resourceId: offerId,
      metadata: { establishment_id: establishmentId, edition_id: payload.edition_id },
    })

    return this.show(tenantId, offerId, actor)
  }

  async update(
    tenantId: number,
    id: number,
    actor: User,
    payload: IBenefit.UpdateOfferPayload
  ): Promise<BenefitOffer> {
    if (Object.keys(payload).length === 0) {
      throw new BadRequestException('At least one offer field must be provided')
    }

    await db.transaction(async (client) => {
      const offer = await this.getLockedOrFail(tenantId, id, client)
      const establishment = await this.getEstablishmentOrFail(
        tenantId,
        offer.establishment_id,
        client
      )
      await this.organizationPolicy.authorizeManageEstablishments(
        actor,
        tenantId,
        establishment.organization_id,
        client
      )
      if (!['draft', 'paused'].includes(offer.status)) {
        throw new BadRequestException('Active offers must be paused before editing')
      }

      const edition = await this.getEditionOrFail(tenantId, offer.edition_id, client)
      if (edition.status === 'archived') {
        throw new BadRequestException('Archived editions cannot receive offer changes')
      }
      await this.validateEstablishmentForEdition(tenantId, establishment, edition, client)

      const normalized = this.normalizeOffer(payload, offer, edition)
      offer.merge(normalized)
      await offer.save()
    })

    await this.audit.log({
      actorId: actor.id,
      resource: 'benefit_offers',
      action: 'update',
      resourceId: id,
      metadata: { fields: Object.keys(payload) },
    })

    return this.show(tenantId, id, actor)
  }

  async activate(tenantId: number, id: number, actor: User): Promise<BenefitOffer> {
    await db.transaction(async (client) => {
      const offer = await this.getLockedOrFail(tenantId, id, client)
      const establishment = await this.getEstablishmentOrFail(
        tenantId,
        offer.establishment_id,
        client
      )
      await this.organizationPolicy.authorizeManageEstablishments(
        actor,
        tenantId,
        establishment.organization_id,
        client
      )
      if (!['draft', 'paused'].includes(offer.status)) {
        throw new BadRequestException(`Benefit offer cannot be activated while ${offer.status}`)
      }

      const edition = await this.getEditionOrFail(tenantId, offer.edition_id, client)
      if (edition.status === 'archived') {
        throw new BadRequestException('Archived editions cannot activate offers')
      }
      await this.validateEstablishmentForEdition(tenantId, establishment, edition, client)
      this.normalizeOffer({}, offer, edition)

      offer.status = 'active'
      offer.activated_at ??= DateTime.utc()
      await offer.save()
    })

    await this.audit.log({
      actorId: actor.id,
      resource: 'benefit_offers',
      action: 'activate',
      resourceId: id,
    })

    return this.show(tenantId, id, actor)
  }

  async pause(tenantId: number, id: number, actor: User): Promise<BenefitOffer> {
    await db.transaction(async (client) => {
      const offer = await this.getLockedOrFail(tenantId, id, client)
      const establishment = await this.getEstablishmentOrFail(
        tenantId,
        offer.establishment_id,
        client
      )
      await this.organizationPolicy.authorizeManageEstablishments(
        actor,
        tenantId,
        establishment.organization_id,
        client
      )
      if (offer.status !== 'active') {
        throw new BadRequestException('Only an active offer can be paused')
      }

      offer.status = 'paused'
      await offer.save()
    })

    await this.audit.log({
      actorId: actor.id,
      resource: 'benefit_offers',
      action: 'pause',
      resourceId: id,
    })

    return this.show(tenantId, id, actor)
  }

  async archive(tenantId: number, id: number, actor: User): Promise<BenefitOffer> {
    await db.transaction(async (client) => {
      const offer = await this.getLockedOrFail(tenantId, id, client)
      const establishment = await this.getEstablishmentOrFail(
        tenantId,
        offer.establishment_id,
        client
      )
      await this.organizationPolicy.authorizeManageEstablishments(
        actor,
        tenantId,
        establishment.organization_id,
        client
      )
      if (offer.status === 'active') {
        throw new BadRequestException('Pause an active offer before archiving it')
      }
      if (offer.status === 'archived') {
        throw new BadRequestException('Benefit offer is already archived')
      }

      offer.status = 'archived'
      offer.archived_at = DateTime.utc()
      await offer.save()
    })

    await this.audit.log({
      actorId: actor.id,
      resource: 'benefit_offers',
      action: 'archive',
      resourceId: id,
    })

    return this.show(tenantId, id, actor)
  }

  private async getOrFail(tenantId: number, id: number): Promise<BenefitOffer> {
    const offer = await this.offerRepository.findByIdForTenant(tenantId, id)
    if (!offer) {
      throw new NotFoundException('Benefit offer not found')
    }
    return offer
  }

  private async getLockedOrFail(
    tenantId: number,
    id: number,
    client: TransactionClientContract
  ): Promise<BenefitOffer> {
    const offer = await this.offerRepository.findLocked(tenantId, id, client)
    if (!offer) {
      throw new NotFoundException('Benefit offer not found')
    }
    return offer
  }

  private async getEditionOrFail(
    tenantId: number,
    id: number,
    client: TransactionClientContract
  ): Promise<BenefitEdition> {
    const edition = await BenefitEdition.query({ client })
      .where('tenant_id', tenantId)
      .where('id', id)
      .first()
    if (!edition) {
      throw new NotFoundException('Benefit edition not found')
    }
    return edition
  }

  private async getEstablishmentOrFail(
    tenantId: number,
    id: number,
    client?: TransactionClientContract,
    forUpdate = false
  ): Promise<Establishment> {
    const query = Establishment.query({ client })
      .where('tenant_id', tenantId)
      .where('id', id)
      .preload('organization')
      .preload('published_revision')
    if (forUpdate) {
      query.forUpdate()
    }

    const establishment = await query.first()
    if (!establishment) {
      throw new NotFoundException('Establishment not found')
    }
    return establishment
  }

  private async validateEstablishmentForEdition(
    tenantId: number,
    establishment: Establishment,
    edition: BenefitEdition,
    client: TransactionClientContract
  ): Promise<void> {
    if (establishment.lifecycle_status !== 'active' || !establishment.published_revision_id) {
      throw new BadRequestException('Only active, published establishments can receive offers')
    }
    if (establishment.business_status === 'permanently_closed') {
      throw new BadRequestException('Permanently closed establishments cannot receive offers')
    }

    const revision = await EstablishmentRevision.query({ client })
      .where('tenant_id', tenantId)
      .where('id', establishment.published_revision_id)
      .first()
    if (!revision || revision.city_id !== edition.city_id) {
      throw new BadRequestException('Establishment and edition must belong to the same city')
    }
  }

  private normalizeOffer(
    payload: IBenefit.UpdateOfferPayload | IBenefit.CreateOfferPayload,
    current: BenefitOffer | null,
    edition: BenefitEdition
  ): NormalizedOffer {
    const benefitType = payload.benefit_type ?? current?.benefit_type
    if (!benefitType) {
      throw new BadRequestException('Benefit type is required')
    }
    const typeChanged = Boolean(
      current && payload.benefit_type && payload.benefit_type !== current.benefit_type
    )
    const discountPercentage =
      payload.discount_percentage !== undefined
        ? payload.discount_percentage
        : typeChanged
          ? null
          : (current?.discount_percentage ?? null)
    const discountAmountCents =
      payload.discount_amount_cents !== undefined
        ? payload.discount_amount_cents
        : typeChanged
          ? null
          : (current?.discount_amount_cents ?? null)
    this.validateBenefitValue(benefitType, discountPercentage, discountAmountCents)

    const dailyStartTime =
      payload.daily_start_time === undefined
        ? (current?.daily_start_time ?? null)
        : this.normalizeOptionalText(payload.daily_start_time)
    const dailyEndTime =
      payload.daily_end_time === undefined
        ? (current?.daily_end_time ?? null)
        : this.normalizeOptionalText(payload.daily_end_time)
    this.validateDailyWindow(dailyStartTime, dailyEndTime)

    const startsAt =
      payload.starts_at === undefined
        ? (current?.starts_at ?? null)
        : this.parseOptionalDate(payload.starts_at, 'Offer start')
    const endsAt =
      payload.ends_at === undefined
        ? (current?.ends_at ?? null)
        : this.parseOptionalDate(payload.ends_at, 'Offer end')
    this.validateOfferWindow(startsAt, endsAt, edition)

    return {
      title: this.normalizeRequiredText(payload.title ?? current?.title ?? '', 'Offer title'),
      description: this.normalizeRequiredText(
        payload.description ?? current?.description ?? '',
        'Offer description'
      ),
      benefit_type: benefitType,
      discount_percentage: discountPercentage,
      discount_amount_cents: discountAmountCents,
      terms:
        payload.terms === undefined
          ? (current?.terms ?? null)
          : this.normalizeOptionalText(payload.terms),
      available_weekdays_mask: this.normalizeIntegerInRange(
        payload.available_weekdays_mask ?? current?.available_weekdays_mask ?? 127,
        'Available weekdays mask',
        1,
        127
      ),
      daily_start_time: dailyStartTime,
      daily_end_time: dailyEndTime,
      starts_at: startsAt,
      ends_at: endsAt,
      reservation_required: payload.reservation_required ?? current?.reservation_required ?? false,
      on_premise_only: payload.on_premise_only ?? current?.on_premise_only ?? true,
      minimum_party_size: this.normalizeIntegerInRange(
        payload.minimum_party_size ?? current?.minimum_party_size ?? 1,
        'Minimum party size',
        1,
        100
      ),
      max_redemptions_per_access: this.normalizeIntegerInRange(
        payload.max_redemptions_per_access ?? current?.max_redemptions_per_access ?? 1,
        'Redemption limit',
        1,
        100
      ),
    }
  }

  private validateBenefitValue(
    type: IBenefit.Type,
    percentage: number | null,
    amountCents: number | null
  ): void {
    if (type === 'percentage') {
      if (
        !Number.isInteger(percentage) ||
        percentage === null ||
        percentage < 1 ||
        percentage > 100
      ) {
        throw new BadRequestException('Percentage benefits require an integer between 1 and 100')
      }
      if (amountCents !== null) {
        throw new BadRequestException('Percentage benefits cannot define a fixed amount')
      }
      return
    }

    if (type === 'fixed_amount') {
      if (!Number.isInteger(amountCents) || amountCents === null || amountCents < 1) {
        throw new BadRequestException('Fixed amount benefits require a positive amount in cents')
      }
      if (percentage !== null) {
        throw new BadRequestException('Fixed amount benefits cannot define a percentage')
      }
      return
    }

    if (percentage !== null || amountCents !== null) {
      throw new BadRequestException('This benefit type cannot define percentage or fixed amount')
    }
  }

  private validateDailyWindow(start: string | null, end: string | null): void {
    if (Boolean(start) !== Boolean(end)) {
      throw new BadRequestException('Daily start and end times must be provided together')
    }
    if (!start || !end) {
      return
    }
    const timePattern = /^([01][0-9]|2[0-3]):[0-5][0-9]$/
    if (!timePattern.test(start) || !timePattern.test(end) || end <= start) {
      throw new BadRequestException('Daily usage window must use HH:mm and end after start')
    }
  }

  private validateOfferWindow(
    startsAt: DateTime | null,
    endsAt: DateTime | null,
    edition: BenefitEdition
  ): void {
    if (Boolean(startsAt) !== Boolean(endsAt)) {
      throw new BadRequestException('Offer start and end must be provided together')
    }
    if (!startsAt || !endsAt) {
      return
    }
    if (endsAt <= startsAt) {
      throw new BadRequestException('Offer end must be after offer start')
    }
    if (startsAt < edition.usage_starts_at || endsAt > edition.usage_ends_at) {
      throw new BadRequestException('Offer window must stay inside the edition usage window')
    }
  }

  private normalizeRequiredText(value: string, label: string): string {
    const normalized = value.trim()
    if (!normalized) {
      throw new BadRequestException(`${label} is required`)
    }
    return normalized
  }

  private normalizeOptionalText(value: string | null | undefined): string | null {
    const normalized = value?.trim()
    return normalized || null
  }

  private normalizeIntegerInRange(
    value: number,
    label: string,
    minimum: number,
    maximum: number
  ): number {
    if (!Number.isInteger(value) || value < minimum || value > maximum) {
      throw new BadRequestException(`${label} must be an integer between ${minimum} and ${maximum}`)
    }
    return value
  }

  private parseOptionalDate(value: string | null | undefined, label: string): DateTime | null {
    if (!value) {
      return null
    }
    const date = DateTime.fromISO(value, { setZone: true })
    if (!date.isValid) {
      throw new BadRequestException(`${label} must be a valid ISO date and time`)
    }
    return date.toUTC()
  }
}
