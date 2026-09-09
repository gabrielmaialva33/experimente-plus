import { createHash, randomUUID } from 'node:crypto'
import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import encryption from '@adonisjs/core/services/encryption'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'
import env from '#start/env'
import { PurchaseConflictException } from '#modules/purchases/exceptions'
import BadRequestException from '#exceptions/bad_request_exception'
import NotFoundException from '#exceptions/not_found_exception'
import BenefitEdition from '#modules/benefits/models/benefit_edition'
import BenefitOffer from '#modules/benefits/models/benefit_offer'
import BenefitAccess from '#modules/benefits/models/benefit_access'
import User from '#modules/users/models/user'
import Tenant from '#modules/tenants/models/tenant'
import PublicOperationResolver from '#modules/tenants/services/public_operation_resolver'
import OrganizationPolicyService from '#modules/organizations/services/organization_policy_service'
import PaymentMethodsService from '#modules/purchases/services/payment_methods_service'
import PaymentProviderService from '#modules/purchases/services/payment_provider_service'
import PurchaseRepository from '#modules/purchases/repositories/purchase_repository'
import type {
  Purchase,
  PurchaseSnapshot,
  CreatePurchaseInput,
} from '#modules/purchases/models/purchase'

export function purchaseHash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}
export function purchaseKey(key: string) {
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(key))
    throw new BadRequestException('A stable Idempotency-Key of 16 to 128 characters is required')
  return purchaseHash(key)
}

@inject()
export default class PurchaseService {
  constructor(
    private repository: PurchaseRepository,
    private providers: PaymentProviderService,
    private policy: OrganizationPolicyService,
    private resolver: PublicOperationResolver,
    private paymentMethods: PaymentMethodsService
  ) {}

  async catalog(hostname: string | null) {
    const tenant = await this.resolver.resolve(hostname)
    const now = DateTime.utc()
    const editions = await BenefitEdition.query()
      .where('tenant_id', tenant.id)
      .where('status', 'published')
      .where('usage_ends_at', '>', now.toJSDate())
      .where('sales_starts_at', '<=', now.toJSDate())
      .where('sales_ends_at', '>', now.toJSDate())
      .whereColumn('sales_ends_at', '<=', 'usage_ends_at')
      .where('currency', 'BRL')
      .where((q) =>
        q
          .where('price_cents', '>', 0)
          .orWhereHas('offers', (o) => o.where('standalone_price_cents', '>', 0))
      )
      .preload('city')
      .orderBy('id')
      .limit(100)
    const packages = []
    const singles = []
    for (const edition of editions) {
      const packageSnapshot = await this.snapshot(edition)
      if (this.sellable(edition, packageSnapshot)) {
        const methods = this.paymentMethods.forEdition(edition, packageSnapshot.amount_cents)
        if (methods.length) packages.push(this.catalogProduct(edition, packageSnapshot, methods))
      }
      for (const offer of packageSnapshot.offers) {
        const snapshot = await this.snapshot(edition, undefined, offer.id)
        const methods = this.paymentMethods.forEdition(edition, snapshot.amount_cents)
        if (this.sellable(edition, snapshot) && methods.length)
          singles.push(this.catalogProduct(edition, snapshot, methods))
      }
    }
    // Canonical storefront: clients select by product_type, without merging lists themselves.
    // Preserve the original scoped collections for existing consumers.
    return { products: [...packages, ...singles], editions: packages, offers: singles }
  }

  private catalogProduct(
    edition: BenefitEdition,
    snapshot: PurchaseSnapshot,
    methods: Array<'pix' | 'card'>
  ) {
    return {
      id: snapshot.offer_id ?? edition.id,
      edition_id: edition.id,
      offer_id: snapshot.offer_id,
      product_type: snapshot.product_type,
      name: snapshot.name,
      description: snapshot.description,
      city: {
        id: edition.city.id,
        name: edition.city.name,
        slug: edition.city.slug,
        state_code: edition.city.state_code,
        timezone: edition.city.timezone,
      },
      establishment: snapshot.offer_id ? snapshot.offers[0].establishment : null,
      status: edition.status,
      sales_starts_at: snapshot.sales_starts_at,
      sales_ends_at: snapshot.sales_ends_at,
      usage_starts_at: snapshot.usage_starts_at,
      usage_ends_at: snapshot.usage_ends_at,
      payment_methods: methods,
      amount_cents: snapshot.amount_cents,
      currency: snapshot.currency,
      terms_version: snapshot.terms_version,
      snapshot,
      purchasable: true,
    }
  }

  private sellable(edition: BenefitEdition, snapshot: PurchaseSnapshot) {
    const now = DateTime.utc()
    return (
      edition.status === 'published' &&
      snapshot.amount_cents > 0 &&
      snapshot.currency === 'BRL' &&
      snapshot.offers.length > 0 &&
      Boolean(snapshot.sales_starts_at && snapshot.sales_ends_at) &&
      DateTime.fromISO(snapshot.sales_starts_at) <= now &&
      now < DateTime.fromISO(snapshot.sales_ends_at) &&
      now < DateTime.fromISO(snapshot.usage_ends_at) &&
      DateTime.fromISO(snapshot.usage_starts_at) < DateTime.fromISO(snapshot.usage_ends_at) &&
      DateTime.fromISO(snapshot.sales_ends_at) <= DateTime.fromISO(snapshot.usage_ends_at)
    )
  }
  private async snapshot(
    edition: BenefitEdition,
    client?: TransactionClientContract,
    offerId: number | null = null
  ): Promise<PurchaseSnapshot> {
    const query = BenefitOffer.query({ client })
      .where('tenant_id', edition.tenant_id)
      .where('edition_id', edition.id)
      .where('status', 'active')
      .whereHas('establishment', (q) =>
        q
          .where('lifecycle_status', 'active')
          .whereNotNull('published_revision_id')
          .whereNot('business_status', 'permanently_closed')
      )
      .where((q) => q.whereNull('ends_at').orWhere('ends_at', '>', DateTime.utc().toJSDate()))
      .preload('establishment', (q) => q.preload('published_revision'))
      .orderBy('id')
    if (offerId !== null) query.where('id', offerId)
    const offers = await query
    const selected = offerId === null ? null : offers[0]
    const amount = offerId === null ? edition.price_cents : (selected?.standalone_price_cents ?? 0)
    const usageStart = selected?.starts_at
      ? DateTime.max(edition.usage_starts_at, selected.starts_at)
      : edition.usage_starts_at
    const usageEnd = selected?.ends_at
      ? DateTime.min(edition.usage_ends_at, selected.ends_at)
      : edition.usage_ends_at
    const salesEnd = edition.sales_ends_at ? DateTime.min(edition.sales_ends_at, usageEnd) : null
    const details = {
      product_type: offerId === null ? ('edition' as const) : ('offer' as const),
      offer_id: offerId,
      amount_cents: amount,
      currency: edition.currency,
      name: selected?.title ?? edition.name,
      description: selected?.description ?? edition.description,
      usage_starts_at: usageStart.toISO()!,
      usage_ends_at: usageEnd.toISO()!,
      sales_starts_at: edition.sales_starts_at?.toISO() ?? '',
      sales_ends_at: salesEnd?.toISO() ?? '',
      offers: offers.map((o) => ({
        id: o.id,
        title: o.title,
        description: o.description,
        benefit_type: o.benefit_type,
        discount_percentage: o.discount_percentage,
        discount_amount_cents: o.discount_amount_cents,
        available_weekdays_mask: o.available_weekdays_mask,
        daily_start_time: o.daily_start_time,
        daily_end_time: o.daily_end_time,
        starts_at: o.starts_at?.toISO() ?? null,
        ends_at: o.ends_at?.toISO() ?? null,
        reservation_required: o.reservation_required,
        on_premise_only: o.on_premise_only,
        minimum_party_size: o.minimum_party_size,
        establishment_id: o.establishment_id,
        establishment: {
          id: o.establishment_id,
          public_name:
            o.establishment.published_revision?.public_name ?? 'Estabelecimento participante',
          slug: o.establishment.published_revision?.slug ?? null,
        },
        terms: o.terms,
        max_redemptions_per_access: o.max_redemptions_per_access,
      })),
    }
    return {
      ...details,
      terms_version: purchaseHash({
        ...details,
        amount_cents: amount,
        currency: edition.currency,
      }),
    }
  }
  async create(tenantId: number, actor: User, key: string, input: CreatePurchaseInput) {
    const keyHash = purchaseKey(key)
    const requestHash = purchaseHash([
      input.edition_id,
      input.offer_id ?? null,
      input.amount_cents,
      input.terms_version,
      input.method,
      input.payment_method_id ?? null,
      input.document_type ?? null,
      input.document_number ?? null,
      input.card_token ?? null,
    ])
    return db.transaction(async (client) => {
      // Serialize the user's purchase intentions, including different keys from two devices.
      await User.query({ client }).where('id', actor.id).forUpdate().firstOrFail()
      const prior = (await this.repository
        .purchases(client)
        .where({ tenant_id: tenantId, user_id: actor.id, key_hash: keyHash })
        .first()) as Purchase | undefined
      if (prior) {
        if (prior.request_hash !== requestHash)
          throw new PurchaseConflictException('Idempotency key conflicts with original purchase')
        return { id: prior.id }
      }
      const provider = this.providers.get()
      const tenant = await Tenant.query({ client })
        .where('id', tenantId)
        .where('is_active', true)
        .first()
      const member = await client
        .from('user_tenants')
        .where({ tenant_id: tenantId, user_id: actor.id })
        .first()
      if (!tenant || !member) throw new NotFoundException('Operation not found')
      const edition = await BenefitEdition.query({ client })
        .where('tenant_id', tenantId)
        .where('id', input.edition_id)
        .forUpdate()
        .first()
      if (!edition) throw new BadRequestException('Edition is not available for purchase')
      const snapshot = await this.snapshot(edition, client, input.offer_id ?? null)
      if (!this.sellable(edition, snapshot))
        throw new BadRequestException('Product is not available for purchase')
      if (!this.paymentMethods.forEdition(edition, snapshot.amount_cents).includes(input.method))
        throw new BadRequestException(
          'Payment method is not available for this edition; refresh the catalog'
        )
      if (
        !snapshot.offers.length ||
        input.amount_cents !== snapshot.amount_cents ||
        input.terms_version !== snapshot.terms_version
      )
        throw new BadRequestException('Quote changed; review the edition again')
      if (input.method === 'card' && (!input.card_token || !input.payment_method_id))
        throw new BadRequestException('Tokenized card and method are required')
      if (
        await BenefitAccess.query({ client })
          .where({ tenant_id: tenantId, edition_id: edition.id, user_id: actor.id })
          .whereRaw('COALESCE(offer_id, 0) = ?', [input.offer_id ?? 0])
          .first()
      )
        throw new BadRequestException(
          'Existing access must be managed through the wallet or support'
        )
      const pending = await this.repository
        .purchases(client)
        .where({ tenant_id: tenantId, edition_id: edition.id, user_id: actor.id })
        .whereRaw('COALESCE(offer_id, 0) = ?', [input.offer_id ?? 0])
        .whereIn('status', ['pending', 'paid', 'review'])
        .first()
      if (pending)
        throw new BadRequestException('A purchase already exists; resume it from your purchases')
      const id = randomUUID()
      const minutes = env.get('PURCHASE_QUOTE_MINUTES', 15)
      if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 60)
        throw new Error('Invalid purchase quote duration')
      const expires = new Date(
        Math.min(Date.now() + minutes * 60000, DateTime.fromISO(snapshot.sales_ends_at).toMillis())
      )
      await this.repository.insert(
        'purchases',
        {
          id,
          tenant_id: tenantId,
          edition_id: edition.id,
          offer_id: input.offer_id ?? null,
          user_id: actor.id,
          key_hash: keyHash,
          request_hash: requestHash,
          snapshot: JSON.stringify(snapshot),
          amount_cents: snapshot.amount_cents,
          currency: edition.currency,
          method: input.method,
          provider: provider.name,
          provider_account: provider.account,
          provider_environment: provider.environment,
          expires_at: expires,
          payment_input: encryption.encrypt({
            email: actor.email,
            name: actor.full_name,
            card_token: input.card_token,
            payment_method_id: input.payment_method_id,
            document_type: input.document_type,
            document_number: input.document_number,
          }),
        },
        client
      )
      const purchase = (await this.repository.get(id, client))!
      await this.repository.enqueue(id, 'create', `create:${id}`, client)
      await this.repository.audit(
        purchase,
        'created',
        {
          offer_id: purchase.offer_id,
          product_type: snapshot.product_type,
          amount_cents: purchase.amount_cents,
          currency: purchase.currency,
          terms_version: snapshot.terms_version,
        },
        client,
        actor.id
      )
      return { id }
    })
  }
  async list(tenantId: number, actor: User) {
    const rows = (await this.repository
      .purchases()
      .where({ tenant_id: tenantId, user_id: actor.id })
      .orderBy('created_at', 'desc')
      .limit(100)) as Purchase[]
    return { purchases: await Promise.all(rows.map((p) => this.project(p))) }
  }
  async get(tenantId: number, actor: User, id: string) {
    return this.project(await this.owned(tenantId, actor, id))
  }
  private async owned(
    tenantId: number,
    actor: User,
    id: string,
    client?: TransactionClientContract,
    lock = false
  ) {
    const p = await this.repository.get(id, client, lock)
    if (!p || p.tenant_id !== tenantId || p.user_id !== actor.id)
      throw new NotFoundException('Purchase not found')
    return p
  }
  private async project(p: Purchase) {
    const holds = await this.repository
      .holds()
      .where('purchase_id', p.id)
      .whereNull('released_at')
      .first()
    const refunds = await this.repository.refunds().where('purchase_id', p.id).orderBy('created_at')
    return {
      id: p.id,
      edition_id: p.edition_id,
      offer_id: p.offer_id,
      product_type: p.offer_id === null ? 'edition' : 'offer',
      amount_cents: p.amount_cents,
      currency: p.currency,
      status: p.status,
      method: p.method,
      snapshot: p.snapshot,
      access_id: p.access_id,
      financially_blocked: Boolean(holds),
      expires_at: p.expires_at.toISOString(),
      paid_at: p.paid_at?.toISOString() ?? null,
      refunded_cents: p.refunded_cents,
      instructions: p.status === 'pending' && p.expires_at > new Date() ? p.instructions : null,
      created_at: p.created_at.toISOString(),
      refunds: refunds.map((r) => ({
        id: r.id,
        amount_cents: r.amount_cents,
        status: r.status,
        reason: r.reason,
      })),
    }
  }
  async cancel(tenantId: number, actor: User, id: string, key: string) {
    purchaseKey(key)
    return db.transaction(async (client) => {
      const p = await this.owned(tenantId, actor, id, client, true)
      if (p.issue === 'cancel_requested' || p.status === 'cancelled') return { id }
      if (p.status !== 'pending' || p.paid_at)
        throw new BadRequestException('Paid purchase requires a refund')
      await this.repository.update(id, { issue: 'cancel_requested' }, client)
      await this.repository.enqueue(id, 'cancel', `cancel:${id}`, client)
      await this.repository.audit(p, 'cancel_requested', {}, client, actor.id)
      return { id }
    })
  }
  async refund(tenantId: number, actor: User, id: string, key: string, reason: string) {
    const keyHash = purchaseKey(key)
    return db.transaction(async (client) => {
      const p = await this.owned(tenantId, actor, id, client, true)
      const prior = await this.repository
        .refunds(client)
        .where({ purchase_id: id, key_hash: keyHash })
        .first()
      if (prior) {
        if (prior.request_hash !== purchaseHash(reason))
          throw new PurchaseConflictException('Idempotency key conflicts with original refund')
        return { id: prior.id, purchase_id: id }
      }
      if (!p.paid_at || p.refunded_cents >= p.amount_cents)
        throw new BadRequestException('No refundable payment')
      if (
        await this.repository
          .refunds(client)
          .where('purchase_id', id)
          .whereIn('status', ['review', 'approved', 'processing'])
          .first()
      )
        throw new BadRequestException('A refund is already being handled')
      // Same mutex as redeem; read the uses only AFTER acquiring it.
      if (p.access_id)
        await BenefitAccess.query({ client })
          .where('tenant_id', tenantId)
          .where('id', p.access_id)
          .forUpdate()
          .firstOrFail()
      const uses = p.access_id
        ? await client
            .from('benefit_redemptions')
            .where({ tenant_id: tenantId, access_id: p.access_id })
            .count('* as total')
            .first()
        : { total: 0 }
      const refundId = randomUUID()
      const auto = Number(uses?.total) === 0 && env.get('PURCHASE_AUTO_REFUND_UNUSED', false)
      await this.repository.insert(
        'purchase_refunds',
        {
          id: refundId,
          purchase_id: id,
          tenant_id: tenantId,
          key_hash: keyHash,
          request_hash: purchaseHash(reason),
          amount_cents: p.amount_cents - p.refunded_cents,
          baseline_refunded_cents: p.refunded_cents,
          status: auto ? 'approved' : 'review',
          reason,
          requested_by: actor.id,
        },
        client
      )
      await this.repository.hold(p, `refund:${refundId}`, client)
      if (auto) await this.repository.enqueue(id, 'refund', `refund:${refundId}`, client, refundId)
      await this.repository.audit(
        p,
        'refund_requested',
        { refund_id: refundId, uses: Number(uses?.total), automatic: auto },
        client,
        actor.id
      )
      return { id: refundId, purchase_id: id }
    })
  }
  async decideRefund(
    tenantId: number,
    actor: User,
    purchaseId: string,
    refundId: string,
    input: { approve: boolean; amount_cents?: number; reason: string }
  ) {
    await this.policy.requirePlatformAdmin(actor)
    return db.transaction(async (client) => {
      const p = await this.repository.get(purchaseId, client, true)
      const r = await this.repository.refund(refundId, client)
      if (!p || p.tenant_id !== tenantId || !r || r.purchase_id !== p.id)
        throw new NotFoundException('Refund not found')
      if (r.status !== 'review') {
        if (
          r.decided_by === actor.id &&
          r.decision_reason === input.reason &&
          ((input.approve &&
            r.status !== 'rejected' &&
            r.amount_cents === (input.amount_cents ?? r.amount_cents)) ||
            (!input.approve && r.status === 'rejected'))
        )
          return { id: r.id, purchase_id: p.id }
        throw new BadRequestException('Refund already decided')
      }
      if (p.access_id)
        await BenefitAccess.query({ client })
          .where('id', p.access_id)
          .where('tenant_id', tenantId)
          .forUpdate()
          .firstOrFail()
      const amount = input.amount_cents ?? r.amount_cents
      if (!Number.isInteger(amount) || amount <= 0 || amount > p.amount_cents - p.refunded_cents)
        throw new BadRequestException('Invalid refund amount')
      await this.repository
        .refunds(client)
        .where('id', r.id)
        .update({
          status: input.approve ? 'approved' : 'rejected',
          amount_cents: amount,
          decided_by: actor.id,
          decision_reason: input.reason,
          updated_at: new Date(),
        })
      if (input.approve)
        await this.repository.enqueue(p.id, 'refund', `refund:${r.id}`, client, r.id)
      else await this.repository.release(p.id, `refund:${r.id}`, client)
      await this.repository.audit(
        p,
        'refund_decided',
        { refund_id: r.id, approved: input.approve, amount_cents: amount, reason: input.reason },
        client,
        actor.id
      )
      return { id: r.id, purchase_id: p.id }
    })
  }
  async operations(tenantId: number, actor: User) {
    await this.policy.requirePlatformAdmin(actor)
    const rows = await this.repository
      .purchases()
      .where('tenant_id', tenantId)
      .orderBy('created_at', 'desc')
      .limit(100)
    return { purchases: await Promise.all(rows.map((p) => this.project(p))) }
  }
}
