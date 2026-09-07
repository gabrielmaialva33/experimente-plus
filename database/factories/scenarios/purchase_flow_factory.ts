import { randomUUID } from 'node:crypto'
import app from '@adonisjs/core/services/app'
import { DateTime } from 'luxon'
import env from '#start/env'
import {
  createBenefitFlowScenario,
  type BenefitFlowScenarioOptions,
} from '#database/factories/scenarios/benefit_flow_factory'
import PurchaseService from '#modules/purchases/services/purchase_service'
import PurchaseProcessingService from '#modules/purchases/services/purchase_processing_service'
import PurchaseRepository from '#modules/purchases/repositories/purchase_repository'
import FakePaymentAdapter from '#modules/purchases/adapters/fake_payment_adapter'
import BenefitAccess from '#modules/benefits/models/benefit_access'
import BenefitRedemptionService from '#modules/benefits/services/benefit_redemption_service'
import type { Purchase } from '#modules/purchases/models/purchase'

export type PurchaseFixtureOptions = Omit<BenefitFlowScenarioOptions, 'withRedemption'>

/** Aggregate factory: preserves the real command, webhook, audit and grant paths. */
export async function createPurchaseFixture(options: PurchaseFixtureOptions = {}) {
  if (env.get('NODE_ENV') === 'production' || env.get('PAYMENT_PROVIDER', 'disabled') !== 'fake') {
    throw new Error('Purchase factories require development/test with PAYMENT_PROVIDER=fake')
  }
  const { access: courtesy, ...s } = await createBenefitFlowScenario({
    ...options,
    suffix: options.suffix ?? randomUUID().slice(0, 8),
    maxRedemptionsPerAccess: options.maxRedemptionsPerAccess ?? 2,
    withRedemption: false,
  })
  await courtesy.delete()
  s.edition.merge({
    sales_starts_at: DateTime.utc().minus({ hours: 1 }),
    sales_ends_at: DateTime.utc().plus({ hours: 1 }),
  })
  await s.edition.save()
  const service = await app.container.make(PurchaseService)
  const processor = await app.container.make(PurchaseProcessingService)
  const repo = new PurchaseRepository()
  const fake = new FakePaymentAdapter()
  const catalog = await service.catalog(s.tenant.slug + '.experimente.test')
  const quote = catalog.editions.find((e) => e.id === s.edition.id)
  if (!quote?.payment_methods.includes('pix'))
    throw new Error('Purchase factories require Pix enabled in the local storefront')
  const input = {
    edition_id: s.edition.id,
    amount_cents: quote.amount_cents,
    terms_version: quote.snapshot.terms_version,
    method: 'pix' as const,
    email: s.users.holder.email,
  }
  const create = () => service.create(s.tenant.id, s.users.holder, randomUUID(), input)
  async function notify(id: string, limit = 100) {
    const resource = 'fake_' + id
    const event = randomUUID()
    await processor.webhook(
      'fake',
      { 'x-fake-signature': fake.sign(resource, event) },
      { resource_id: resource, event_id: event },
      {}
    )
    await processor.reconcile()
    return processor.drain(limit)
  }
  async function paid() {
    const p = await create()
    await processor.drain()
    await fake.simulate('fake_' + p.id, { state: 'paid', paidAt: new Date().toISOString() })
    await notify(p.id)
    return (await repo.get(p.id))!
  }
  return { s, service, processor, repo, fake, quote, input, create, notify, paid }
}

export interface PurchaseFlowOptions extends PurchaseFixtureOptions {
  state?: Purchase['status']
}

/** Every persisted purchase status, including review awaiting durable compensation. */
export async function createPurchaseFlowScenario(options: PurchaseFlowOptions = {}) {
  const f = await createPurchaseFixture(options)
  const state = options.state ?? 'pending'
  const initial = state === 'paid' || state === 'refunded' ? await f.paid() : await f.create()
  if (state === 'failed' || state === 'cancelled') {
    await f.processor.drain()
    await f.fake.simulate('fake_' + initial.id, { state })
    await f.notify(initial.id)
  } else if (state === 'review') {
    await f.processor.drain()
    const pending = (await f.repo.get(initial.id))!
    await f.fake.simulate('fake_' + initial.id, {
      state: 'paid',
      paidAt: new Date(pending.created_at.getTime() - 60_000).toISOString(),
    })
    // Stop before compensation dispatch: a confirmed but undeliverable payment is in review.
    await f.notify(initial.id, 1)
    for (let i = 0; i < 100; i++) {
      const current = (await f.repo.get(initial.id))!
      if (current.status === 'review') break
      await f.processor.drain(1)
    }
  } else if (state === 'refunded') {
    await f.fake.simulate('fake_' + initial.id, {
      state: 'refunded',
      refundedCents: f.input.amount_cents,
    })
    await f.notify(initial.id)
  }
  const purchase = (await f.repo.get(initial.id))!
  if (purchase.status !== state) throw new Error('Purchase factory did not reach requested state')
  const access = purchase.access_id ? await BenefitAccess.findOrFail(purchase.access_id) : null
  return { ...f, purchase, access }
}

/** Reversible dispute hold linked to the confirmed purchase and its original access. */
export async function createFinancialHoldScenario(
  options: PurchaseFixtureOptions & { released?: boolean } = {}
) {
  const f = await createPurchaseFlowScenario({ ...options, state: 'paid' })
  await f.fake.simulate('fake_' + f.purchase.id, { state: 'disputed' })
  await f.notify(f.purchase.id)
  if (options.released) {
    await f.fake.simulate('fake_' + f.purchase.id, { state: 'paid' })
    await f.notify(f.purchase.id)
  }
  const hold = await f.repo
    .holds()
    .where({ purchase_id: f.purchase.id, reason: 'dispute' })
    .firstOrFail()
  return { ...f, hold }
}

export interface PurchaseRefundOptions extends PurchaseFixtureOptions {
  kind?: 'total' | 'partial'
  refundState?: 'review' | 'approved' | 'succeeded' | 'rejected'
}

/** Used benefit forces human review under either automatic-refund configuration. */
export async function createPurchaseRefundScenario(options: PurchaseRefundOptions = {}) {
  const f = await createPurchaseFlowScenario({ ...options, state: 'paid' })
  const redemptionService = await app.container.make(BenefitRedemptionService)
  const presentation = await redemptionService.present(
    f.s.tenant.id,
    f.access!.id,
    f.s.offer.id,
    f.s.users.holder,
    'http://localhost'
  )
  const receipt = await redemptionService.redeem(
    f.s.tenant.id,
    presentation.token,
    f.s.users.partner
  )
  const requested = await f.service.refund(
    f.s.tenant.id,
    f.s.users.holder,
    f.purchase.id,
    randomUUID(),
    'Restituição gerada pela factory de cenário'
  )
  const state = options.refundState ?? 'succeeded'
  if (state !== 'review') {
    await f.service.decideRefund(f.s.tenant.id, f.s.users.admin, f.purchase.id, requested.id, {
      approve: state !== 'rejected',
      amount_cents:
        options.kind === 'partial'
          ? Math.floor(f.purchase.amount_cents / 2)
          : f.purchase.amount_cents,
      reason: 'Decisão comercial da factory de cenário',
    })
  }
  if (state === 'succeeded') await f.processor.drain()
  const purchase = (await f.repo.get(f.purchase.id))!
  const refund = (await f.repo.refund(requested.id))!
  if (refund.status !== state) throw new Error('Refund factory did not reach requested state')
  const access = await BenefitAccess.findOrFail(purchase.access_id!)
  const hold = await f.repo
    .holds()
    .where({ purchase_id: purchase.id, reason: 'refund:' + refund.id })
    .firstOrFail()
  return { ...f, purchase, access, refund, hold, receipt }
}
