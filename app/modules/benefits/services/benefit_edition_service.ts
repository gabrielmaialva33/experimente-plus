import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'

import BadRequestException from '#exceptions/bad_request_exception'
import NotFoundException from '#exceptions/not_found_exception'
import type IBenefit from '#modules/benefits/interfaces/benefit_interface'
import BenefitEdition from '#modules/benefits/models/benefit_edition'
import BenefitOffer from '#modules/benefits/models/benefit_offer'
import BenefitEditionRepository from '#modules/benefits/repositories/benefit_edition_repository'
import BenefitOfferRepository from '#modules/benefits/repositories/benefit_offer_repository'
import BenefitAuditService from '#modules/benefits/services/benefit_audit_service'
import City from '#modules/geography/models/city'
import OrganizationPolicyService from '#modules/organizations/services/organization_policy_service'
import type User from '#modules/users/models/user'
import { normalizeSlug, resolveUniqueSlug } from '#shared/utils/slug'

@inject()
export default class BenefitEditionService {
  constructor(
    private editionRepository: BenefitEditionRepository,
    private offerRepository: BenefitOfferRepository,
    private organizationPolicy: OrganizationPolicyService,
    private audit: BenefitAuditService
  ) {}

  async list(tenantId: number, actor: User): Promise<BenefitEdition[]> {
    await this.organizationPolicy.requirePlatformModerator(actor)
    return this.editionRepository.listForTenant(tenantId)
  }

  async listAvailable(tenantId: number): Promise<IBenefit.AvailableEdition[]> {
    const editions = await this.editionRepository.listAvailableForTenant(tenantId)

    return editions.map((edition) => ({
      id: edition.id,
      city_id: edition.city_id,
      name: edition.name,
      slug: edition.slug,
      description: edition.description,
      price_cents: edition.price_cents,
      currency: edition.currency,
      sales_starts_at: edition.sales_starts_at?.toISO() ?? null,
      sales_ends_at: edition.sales_ends_at?.toISO() ?? null,
      usage_starts_at: edition.usage_starts_at.toISO()!,
      usage_ends_at: edition.usage_ends_at.toISO()!,
      status: edition.status,
      published_at: edition.published_at?.toISO() ?? null,
      city: {
        id: edition.city.id,
        name: edition.city.name,
        state_code: edition.city.state_code,
      },
    }))
  }

  async show(tenantId: number, id: number, actor: User): Promise<BenefitEdition> {
    await this.organizationPolicy.requirePlatformModerator(actor)
    return this.getOrFail(tenantId, id)
  }

  async create(
    tenantId: number,
    actor: User,
    payload: IBenefit.CreateEditionPayload
  ): Promise<BenefitEdition> {
    await this.organizationPolicy.requirePlatformAdmin(actor)
    await this.validateCity(tenantId, payload.city_id)

    const name = this.normalizeRequiredText(payload.name, 'Edition name')
    const slug = payload.slug
      ? await this.validateExplicitSlug(tenantId, payload.slug)
      : await resolveUniqueSlug(name, (candidate) =>
          this.editionRepository.isSlugTaken(tenantId, candidate)
        )
    const currency = this.normalizeCurrency(payload.currency ?? 'BRL')
    const priceCents = this.normalizeNonNegativeInteger(payload.price_cents ?? 0, 'Price')
    const salesStartsAt = this.parseOptionalDate(payload.sales_starts_at, 'Sales start')
    const salesEndsAt = this.parseOptionalDate(payload.sales_ends_at, 'Sales end')
    const usageStartsAt = this.parseRequiredDate(payload.usage_starts_at, 'Usage start')
    const usageEndsAt = this.parseRequiredDate(payload.usage_ends_at, 'Usage end')
    this.validateWindows(salesStartsAt, salesEndsAt, usageStartsAt, usageEndsAt)

    const edition = await this.editionRepository.create({
      tenant_id: tenantId,
      city_id: payload.city_id,
      name,
      slug,
      description: this.normalizeOptionalText(payload.description),
      price_cents: priceCents,
      currency,
      sales_starts_at: salesStartsAt,
      sales_ends_at: salesEndsAt,
      usage_starts_at: usageStartsAt,
      usage_ends_at: usageEndsAt,
      status: 'draft',
      created_by: actor.id,
      published_at: null,
      archived_at: null,
    })

    await this.audit.log({
      actorId: actor.id,
      resource: 'benefit_editions',
      action: 'create',
      resourceId: edition.id,
      metadata: { city_id: edition.city_id, status: edition.status },
    })

    return this.getOrFail(tenantId, edition.id)
  }

  async update(
    tenantId: number,
    id: number,
    actor: User,
    payload: IBenefit.UpdateEditionPayload
  ): Promise<BenefitEdition> {
    await this.organizationPolicy.requirePlatformAdmin(actor)
    if (Object.keys(payload).length === 0) {
      throw new BadRequestException('At least one edition field must be provided')
    }

    await db.transaction(async (client) => {
      const edition = await this.editionRepository.findLocked(tenantId, id, client)
      if (!edition) {
        throw new NotFoundException('Benefit edition not found')
      }
      if (!['draft', 'paused'].includes(edition.status)) {
        throw new BadRequestException('Published editions must be paused before editing')
      }

      if (payload.city_id !== undefined && payload.city_id !== edition.city_id) {
        const offer = await BenefitOffer.query({ client })
          .where('tenant_id', tenantId)
          .where('edition_id', edition.id)
          .first()
        if (offer) {
          throw new BadRequestException('Edition city cannot change after offers are created')
        }
        await this.validateCity(tenantId, payload.city_id, client)
        edition.city_id = payload.city_id
      }

      if (payload.name !== undefined) {
        edition.name = this.normalizeRequiredText(payload.name, 'Edition name')
      }
      if (payload.slug !== undefined) {
        edition.slug = await this.validateExplicitSlug(tenantId, payload.slug, edition.id, client)
      }
      if (payload.description !== undefined) {
        edition.description = this.normalizeOptionalText(payload.description)
      }
      if (payload.price_cents !== undefined) {
        edition.price_cents = this.normalizeNonNegativeInteger(payload.price_cents, 'Price')
      }
      if (payload.currency !== undefined) {
        edition.currency = this.normalizeCurrency(payload.currency)
      }

      const salesStartsAt =
        payload.sales_starts_at === undefined
          ? edition.sales_starts_at
          : this.parseOptionalDate(payload.sales_starts_at, 'Sales start')
      const salesEndsAt =
        payload.sales_ends_at === undefined
          ? edition.sales_ends_at
          : this.parseOptionalDate(payload.sales_ends_at, 'Sales end')
      const usageStartsAt =
        payload.usage_starts_at === undefined
          ? edition.usage_starts_at
          : this.parseRequiredDate(payload.usage_starts_at, 'Usage start')
      const usageEndsAt =
        payload.usage_ends_at === undefined
          ? edition.usage_ends_at
          : this.parseRequiredDate(payload.usage_ends_at, 'Usage end')

      this.validateWindows(salesStartsAt, salesEndsAt, usageStartsAt, usageEndsAt)
      edition.sales_starts_at = salesStartsAt
      edition.sales_ends_at = salesEndsAt
      edition.usage_starts_at = usageStartsAt
      edition.usage_ends_at = usageEndsAt
      await edition.save()
    })

    await this.audit.log({
      actorId: actor.id,
      resource: 'benefit_editions',
      action: 'update',
      resourceId: id,
      metadata: { fields: Object.keys(payload) },
    })

    return this.getOrFail(tenantId, id)
  }

  async publish(tenantId: number, id: number, actor: User): Promise<BenefitEdition> {
    await this.organizationPolicy.requirePlatformAdmin(actor)

    await db.transaction(async (client) => {
      const edition = await this.editionRepository.findLocked(tenantId, id, client)
      if (!edition) {
        throw new NotFoundException('Benefit edition not found')
      }
      if (!['draft', 'paused'].includes(edition.status)) {
        throw new BadRequestException(`Benefit edition cannot be published while ${edition.status}`)
      }

      const activeOffers = await this.offerRepository.countActiveForEdition(
        tenantId,
        edition.id,
        client
      )
      if (activeOffers === 0) {
        throw new BadRequestException('At least one active offer is required before publication')
      }

      edition.status = 'published'
      edition.published_at ??= DateTime.utc()
      await edition.save()
    })

    await this.audit.log({
      actorId: actor.id,
      resource: 'benefit_editions',
      action: 'publish',
      resourceId: id,
    })

    return this.getOrFail(tenantId, id)
  }

  async pause(tenantId: number, id: number, actor: User): Promise<BenefitEdition> {
    await this.organizationPolicy.requirePlatformAdmin(actor)

    await db.transaction(async (client) => {
      const edition = await this.editionRepository.findLocked(tenantId, id, client)
      if (!edition) {
        throw new NotFoundException('Benefit edition not found')
      }
      if (edition.status !== 'published') {
        throw new BadRequestException('Only a published edition can be paused')
      }

      edition.status = 'paused'
      await edition.save()
    })

    await this.audit.log({
      actorId: actor.id,
      resource: 'benefit_editions',
      action: 'pause',
      resourceId: id,
    })

    return this.getOrFail(tenantId, id)
  }

  async archive(tenantId: number, id: number, actor: User): Promise<BenefitEdition> {
    await this.organizationPolicy.requirePlatformAdmin(actor)

    await db.transaction(async (client) => {
      const edition = await this.editionRepository.findLocked(tenantId, id, client)
      if (!edition) {
        throw new NotFoundException('Benefit edition not found')
      }
      if (edition.status === 'archived') {
        throw new BadRequestException('Benefit edition is already archived')
      }

      edition.status = 'archived'
      edition.archived_at = DateTime.utc()
      await edition.save()
    })

    await this.audit.log({
      actorId: actor.id,
      resource: 'benefit_editions',
      action: 'archive',
      resourceId: id,
    })

    return this.getOrFail(tenantId, id)
  }

  private async getOrFail(tenantId: number, id: number): Promise<BenefitEdition> {
    const edition = await this.editionRepository.findByIdForTenant(tenantId, id)
    if (!edition) {
      throw new NotFoundException('Benefit edition not found')
    }
    return edition
  }

  private async validateCity(
    tenantId: number,
    cityId: number,
    client?: TransactionClientContract
  ): Promise<void> {
    const city = await City.query({ client })
      .where('tenant_id', tenantId)
      .where('id', cityId)
      .where('is_active', true)
      .first()
    if (!city) {
      throw new BadRequestException('Edition city must be active in this operation')
    }
  }

  private async validateExplicitSlug(
    tenantId: number,
    value: string,
    excludeId?: number,
    client?: TransactionClientContract
  ): Promise<string> {
    const slug = normalizeSlug(value)
    if (!slug) {
      throw new BadRequestException('Edition slug is invalid')
    }
    if (await this.editionRepository.isSlugTaken(tenantId, slug, excludeId, client)) {
      throw new BadRequestException('Edition slug is already in use')
    }
    return slug
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

  private normalizeCurrency(value: string): string {
    const currency = value.trim().toUpperCase()
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new BadRequestException('Currency must use a three-letter ISO code')
    }
    return currency
  }

  private normalizeNonNegativeInteger(value: number, label: string): number {
    if (!Number.isInteger(value) || value < 0) {
      throw new BadRequestException(`${label} must be a non-negative integer`)
    }
    return value
  }

  private parseRequiredDate(value: string, label: string): DateTime {
    const date = DateTime.fromISO(value, { setZone: true })
    if (!date.isValid) {
      throw new BadRequestException(`${label} must be a valid ISO date and time`)
    }
    return date.toUTC()
  }

  private parseOptionalDate(value: string | null | undefined, label: string): DateTime | null {
    if (!value) {
      return null
    }
    return this.parseRequiredDate(value, label)
  }

  private validateWindows(
    salesStartsAt: DateTime | null,
    salesEndsAt: DateTime | null,
    usageStartsAt: DateTime,
    usageEndsAt: DateTime
  ): void {
    if (usageEndsAt <= usageStartsAt) {
      throw new BadRequestException('Usage end must be after usage start')
    }
    if (Boolean(salesStartsAt) !== Boolean(salesEndsAt)) {
      throw new BadRequestException('Sales start and end must be provided together')
    }
    if (salesStartsAt && salesEndsAt && salesEndsAt <= salesStartsAt) {
      throw new BadRequestException('Sales end must be after sales start')
    }
  }
}
