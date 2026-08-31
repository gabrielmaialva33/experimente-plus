import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { randomBytes } from 'node:crypto'
import { DateTime } from 'luxon'
import QRCode from 'qrcode'

import BadRequestException from '#exceptions/bad_request_exception'
import NotFoundException from '#exceptions/not_found_exception'
import type IBenefitAccess from '#modules/benefits/interfaces/benefit_access_interface'
import type IBenefitRedemption from '#modules/benefits/interfaces/benefit_redemption_interface'
import BenefitAccess from '#modules/benefits/models/benefit_access'
import BenefitEdition from '#modules/benefits/models/benefit_edition'
import BenefitOffer from '#modules/benefits/models/benefit_offer'
import BenefitRedemption from '#modules/benefits/models/benefit_redemption'
import BenefitRedemptionRepository from '#modules/benefits/repositories/benefit_redemption_repository'
import BenefitAuditService from '#modules/benefits/services/benefit_audit_service'
import BenefitPresentationTokenService from '#modules/benefits/services/benefit_presentation_token_service'
import Establishment from '#modules/establishments/models/establishment'
import EstablishmentRevision from '#modules/establishments/models/establishment_revision'
import City from '#modules/geography/models/city'
import OrganizationMember from '#modules/organizations/models/organization_member'
import OrganizationPolicyService from '#modules/organizations/services/organization_policy_service'
import type User from '#modules/users/models/user'
import UserModel from '#modules/users/models/user'

type RedemptionContext = {
  access: BenefitAccess
  edition: BenefitEdition
  offer: BenefitOffer
  establishment: Establishment
  revision: EstablishmentRevision
  city: City
  holder: UserModel
}

@inject()
export default class BenefitRedemptionService {
  constructor(
    private repository: BenefitRedemptionRepository,
    private tokenService: BenefitPresentationTokenService,
    private organizationPolicy: OrganizationPolicyService,
    private audit: BenefitAuditService
  ) {}

  async decorateWallet(
    tenantId: number,
    userId: number,
    baseWallet: IBenefitAccess.WalletProjection
  ): Promise<IBenefitAccess.WalletProjection> {
    const redemptions = await this.repository.listForHolder(tenantId, userId)
    const byBenefit = new Map<string, BenefitRedemption[]>()

    for (const redemption of redemptions) {
      const key = `${redemption.access_id}:${redemption.offer_id}`
      const matches = byBenefit.get(key) ?? []
      matches.push(redemption)
      byBenefit.set(key, matches)
    }

    const passes = baseWallet.passes.map((pass) => ({
      ...pass,
      benefits: pass.benefits.map((benefit) => {
        const matches = byBenefit.get(`${benefit.access_id}:${benefit.offer_id}`) ?? []
        const latest = matches[0] ?? null
        const redemptionCount = matches.length
        const remainingRedemptions = Math.max(
          0,
          benefit.max_redemptions_per_access - redemptionCount
        )

        return {
          ...benefit,
          availability: remainingRedemptions === 0 ? ('redeemed' as const) : benefit.availability,
          redemption_count: redemptionCount,
          remaining_redemptions: remainingRedemptions,
          latest_redemption: latest
            ? {
                id: String(latest.id),
                receipt_code: latest.receipt_code,
                redeemed_at: latest.redeemed_at.toISO()!,
              }
            : null,
        }
      }),
    }))
    const benefits = passes.flatMap((pass) => pass.benefits)

    return {
      summary: {
        passes: baseWallet.summary.passes,
        benefits: benefits.length,
        available: benefits.filter((benefit) => benefit.availability === 'available').length,
        upcoming: benefits.filter((benefit) => benefit.availability === 'upcoming').length,
        redeemed: benefits.filter((benefit) => benefit.availability === 'redeemed').length,
      },
      passes,
    }
  }

  async present(
    tenantId: number,
    accessId: number,
    offerId: number,
    actor: User,
    origin: string
  ): Promise<IBenefitRedemption.PresentationProjection> {
    const context = await this.resolveContext(tenantId, accessId, offerId)
    if (context.access.user_id !== actor.id) {
      throw new NotFoundException('Benefit not found')
    }

    const redeemedCount = await this.repository.countForAccessOffer(
      tenantId,
      context.access.id,
      context.offer.id
    )
    this.assertRedeemable(context, redeemedCount, DateTime.utc())

    const { token, claims } = this.tokenService.issue({
      tenantId,
      accessId: context.access.id,
      offerId: context.offer.id,
      userId: actor.id,
    })
    const validationUrl = `${origin.replace(/\/$/, '')}/portal/redemptions/validate?token=${encodeURIComponent(token)}`
    const qrDataUrl = await QRCode.toDataURL(validationUrl, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 360,
    })

    return {
      token,
      validation_url: validationUrl,
      qr_data_url: qrDataUrl,
      issued_at: DateTime.fromSeconds(claims.issued_at, { zone: 'utc' }).toISO()!,
      expires_at: DateTime.fromSeconds(claims.expires_at, { zone: 'utc' }).toISO()!,
      expires_in_seconds: claims.expires_at - claims.issued_at,
      benefit: this.toBenefitSummary(context, redeemedCount),
    }
  }

  async preview(
    tenantId: number,
    token: string,
    actor: User
  ): Promise<IBenefitRedemption.PreviewProjection> {
    const claims = this.tokenService.verify(token)
    this.assertTenantClaim(tenantId, claims)
    const context = await this.resolveContext(tenantId, claims.access_id, claims.offer_id)
    this.assertClaims(context, claims)
    await this.organizationPolicy.authorizeManageEstablishments(
      actor,
      tenantId,
      context.establishment.organization_id
    )

    const redeemedCount = await this.repository.countForAccessOffer(
      tenantId,
      context.access.id,
      context.offer.id
    )
    this.assertRedeemable(context, redeemedCount, DateTime.utc())

    return {
      token,
      expires_at: DateTime.fromSeconds(claims.expires_at, { zone: 'utc' }).toISO()!,
      holder: {
        id: context.holder.id,
        full_name: context.holder.full_name,
        email: context.holder.email,
      },
      benefit: this.toBenefitSummary(context, redeemedCount),
    }
  }

  async redeem(
    tenantId: number,
    token: string,
    actor: User
  ): Promise<IBenefitRedemption.ReceiptProjection> {
    const claims = this.tokenService.verify(token)
    this.assertTenantClaim(tenantId, claims)
    const nonceHash = this.tokenService.hashNonce(claims.nonce)
    let redemptionId = 0
    let created = false

    await db.transaction(async (client) => {
      const context = await this.resolveContext(
        tenantId,
        claims.access_id,
        claims.offer_id,
        client,
        true
      )
      this.assertClaims(context, claims)
      await this.organizationPolicy.authorizeManageEstablishments(
        actor,
        tenantId,
        context.establishment.organization_id,
        client
      )

      const existing = await this.repository.findByNonceHash(tenantId, nonceHash, client)
      if (existing) {
        redemptionId = existing.id
        return
      }

      const redeemedCount = await this.repository.countForAccessOffer(
        tenantId,
        context.access.id,
        context.offer.id,
        client
      )
      const redeemedAt = DateTime.utc()
      this.assertRedeemable(context, redeemedCount, redeemedAt)

      const redemption = await this.repository.create(
        {
          tenant_id: tenantId,
          access_id: context.access.id,
          edition_id: context.edition.id,
          offer_id: context.offer.id,
          establishment_id: context.establishment.id,
          organization_id: context.establishment.organization_id,
          user_id: context.holder.id,
          redeemed_by: actor.id,
          redemption_number: redeemedCount + 1,
          presentation_nonce_hash: nonceHash,
          receipt_code: this.createReceiptCode(),
          edition_name_snapshot: context.edition.name,
          offer_title_snapshot: context.offer.title,
          benefit_type_snapshot: context.offer.benefit_type,
          offer_terms_snapshot: context.offer.terms,
          establishment_name_snapshot: context.revision.public_name ?? 'Estabelecimento',
          holder_name_snapshot: context.holder.full_name,
          holder_email_snapshot: context.holder.email,
          redeemed_at: redeemedAt,
        },
        client
      )
      redemptionId = redemption.id
      created = true
    })

    const redemption = await this.getByIdOrFail(tenantId, redemptionId)
    if (created) {
      await this.audit.log({
        actorId: actor.id,
        resource: 'benefit_redemptions',
        action: 'redeem',
        resourceId: redemption.id,
        metadata: {
          access_id: redemption.access_id,
          offer_id: redemption.offer_id,
          establishment_id: redemption.establishment_id,
          receipt_code: redemption.receipt_code,
        },
      })
    }

    return this.toReceipt(redemption)
  }

  async holderHistory(
    tenantId: number,
    actor: User
  ): Promise<IBenefitRedemption.HistoryProjection> {
    const redemptions = await this.repository.listForHolder(tenantId, actor.id)
    return {
      redemptions: redemptions.map((redemption) => this.toReceipt(redemption)),
      total: redemptions.length,
    }
  }

  async partnerHistory(
    tenantId: number,
    actor: User
  ): Promise<IBenefitRedemption.HistoryProjection> {
    const memberships = await OrganizationMember.query()
      .where('tenant_id', tenantId)
      .where('user_id', actor.id)
      .where('status', 'active')
      .whereIn('role', ['owner', 'admin', 'editor'])
      .select('organization_id')
    const organizationIds = memberships.map((membership) => membership.organization_id)
    const redemptions = await this.repository.listForOrganizations(tenantId, organizationIds)

    return {
      redemptions: redemptions.map((redemption) => this.toReceipt(redemption)),
      total: redemptions.length,
    }
  }

  async holderReceipt(
    tenantId: number,
    receiptCode: string,
    actor: User
  ): Promise<IBenefitRedemption.ReceiptProjection> {
    const redemption = await this.getByReceiptOrFail(tenantId, receiptCode)
    if (redemption.user_id !== actor.id) {
      throw new NotFoundException('Redemption receipt not found')
    }
    return this.toReceipt(redemption)
  }

  async partnerReceipt(
    tenantId: number,
    receiptCode: string,
    actor: User
  ): Promise<IBenefitRedemption.ReceiptProjection> {
    const redemption = await this.getByReceiptOrFail(tenantId, receiptCode)
    await this.organizationPolicy.authorizeRead(actor, tenantId, redemption.organization_id)
    return this.toReceipt(redemption)
  }

  private async resolveContext(
    tenantId: number,
    accessId: number,
    offerId: number,
    client?: TransactionClientContract,
    lock = false
  ): Promise<RedemptionContext> {
    const accessQuery = BenefitAccess.query({ client })
      .where('tenant_id', tenantId)
      .where('id', accessId)
    if (lock) accessQuery.forUpdate()
    const access = await accessQuery.first()
    if (!access) throw new NotFoundException('Benefit not found')

    const offerQuery = BenefitOffer.query({ client })
      .where('tenant_id', tenantId)
      .where('id', offerId)
    if (lock) offerQuery.forUpdate()
    const offer = await offerQuery.first()
    if (!offer || offer.edition_id !== access.edition_id) {
      throw new NotFoundException('Benefit not found')
    }

    const edition = await BenefitEdition.query({ client })
      .where('tenant_id', tenantId)
      .where('id', access.edition_id)
      .first()
    const establishment = await Establishment.query({ client })
      .where('tenant_id', tenantId)
      .where('id', offer.establishment_id)
      .first()
    const holder = await UserModel.query({ client }).where('id', access.user_id).first()
    if (!edition || !establishment || !holder || !establishment.published_revision_id) {
      throw new NotFoundException('Benefit not found')
    }

    const revision = await EstablishmentRevision.query({ client })
      .where('tenant_id', tenantId)
      .where('id', establishment.published_revision_id)
      .first()
    const city = await City.query({ client })
      .where('tenant_id', tenantId)
      .where('id', edition.city_id)
      .first()
    if (!revision || !city || revision.city_id !== city.id) {
      throw new NotFoundException('Benefit not found')
    }

    return { access, edition, offer, establishment, revision, city, holder }
  }

  private assertRedeemable(context: RedemptionContext, redeemedCount: number, now: DateTime): void {
    if (context.access.status !== 'active') {
      throw new BadRequestException('Benefit access is not active')
    }
    if (context.edition.status !== 'published') {
      throw new BadRequestException('Benefit edition is not available for redemption')
    }
    if (context.offer.status !== 'active') {
      throw new BadRequestException('Benefit offer is not active')
    }
    if (
      context.establishment.lifecycle_status !== 'active' ||
      context.establishment.business_status === 'permanently_closed'
    ) {
      throw new BadRequestException('Establishment is not available for redemption')
    }

    const nowMillis = now.toMillis()
    if (
      nowMillis < context.edition.usage_starts_at.toMillis() ||
      nowMillis > context.edition.usage_ends_at.toMillis()
    ) {
      throw new BadRequestException('Benefit edition is outside its usage window')
    }
    if (context.offer.starts_at && nowMillis < context.offer.starts_at.toMillis()) {
      throw new BadRequestException('Benefit offer is not available yet')
    }
    if (context.offer.ends_at && nowMillis > context.offer.ends_at.toMillis()) {
      throw new BadRequestException('Benefit offer has expired')
    }

    const localNow = now.setZone(context.city.timezone)
    const weekdayBit = 1 << (localNow.weekday % 7)
    if ((context.offer.available_weekdays_mask & weekdayBit) === 0) {
      throw new BadRequestException('Benefit offer is unavailable today')
    }
    if (context.offer.daily_start_time && context.offer.daily_end_time) {
      const localTime = localNow.toFormat('HH:mm')
      if (localTime < context.offer.daily_start_time || localTime > context.offer.daily_end_time) {
        throw new BadRequestException('Benefit offer is outside its daily usage window')
      }
    }

    if (redeemedCount >= context.offer.max_redemptions_per_access) {
      throw new BadRequestException('Benefit offer redemption limit has been reached')
    }
  }

  private assertTenantClaim(tenantId: number, claims: IBenefitRedemption.PresentationClaims): void {
    if (claims.tenant_id !== tenantId) {
      throw new NotFoundException('Benefit not found')
    }
  }

  private assertClaims(
    context: RedemptionContext,
    claims: IBenefitRedemption.PresentationClaims
  ): void {
    if (
      context.access.id !== claims.access_id ||
      context.offer.id !== claims.offer_id ||
      context.access.user_id !== claims.user_id
    ) {
      throw new NotFoundException('Benefit not found')
    }
  }

  private toBenefitSummary(
    context: RedemptionContext,
    redeemedCount: number
  ): IBenefitRedemption.BenefitSummary {
    return {
      access_id: context.access.id,
      offer_id: context.offer.id,
      edition_id: context.edition.id,
      edition_name: context.edition.name,
      establishment_id: context.establishment.id,
      establishment_name: context.revision.public_name ?? 'Estabelecimento',
      offer_title: context.offer.title,
      offer_description: context.offer.description,
      terms: context.offer.terms,
      benefit_type: context.offer.benefit_type,
      reservation_required: context.offer.reservation_required,
      on_premise_only: context.offer.on_premise_only,
      minimum_party_size: context.offer.minimum_party_size,
      max_redemptions_per_access: context.offer.max_redemptions_per_access,
      redeemed_count: redeemedCount,
      remaining_redemptions: Math.max(0, context.offer.max_redemptions_per_access - redeemedCount),
    }
  }

  private toReceipt(redemption: BenefitRedemption): IBenefitRedemption.ReceiptProjection {
    return {
      id: redemption.id,
      receipt_code: redemption.receipt_code,
      redemption_number: redemption.redemption_number,
      redeemed_at: redemption.redeemed_at.toISO()!,
      edition: {
        id: redemption.edition_id,
        name: redemption.edition_name_snapshot,
      },
      offer: {
        id: redemption.offer_id,
        title: redemption.offer_title_snapshot,
        benefit_type: redemption.benefit_type_snapshot,
        terms: redemption.offer_terms_snapshot,
      },
      establishment: {
        id: redemption.establishment_id,
        name: redemption.establishment_name_snapshot,
      },
      holder: {
        id: redemption.user_id,
        full_name: redemption.holder_name_snapshot,
        email: redemption.holder_email_snapshot,
      },
      redeemed_by: redemption.redeemed_by,
    }
  }

  private async getByIdOrFail(tenantId: number, id: number): Promise<BenefitRedemption> {
    const redemption = await this.repository.findByIdForTenant(tenantId, id)
    if (!redemption) throw new NotFoundException('Redemption receipt not found')
    return redemption
  }

  private async getByReceiptOrFail(
    tenantId: number,
    receiptCode: string
  ): Promise<BenefitRedemption> {
    const redemption = await this.repository.findByReceiptForTenant(
      tenantId,
      receiptCode.trim().toUpperCase()
    )
    if (!redemption) throw new NotFoundException('Redemption receipt not found')
    return redemption
  }

  private createReceiptCode(): string {
    return `EXP-${randomBytes(8).toString('hex').toUpperCase()}`
  }
}
