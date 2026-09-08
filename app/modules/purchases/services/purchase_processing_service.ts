import {
  InvalidPaymentWebhookException,
  PurchaseConflictException,
} from '#modules/purchases/exceptions'
import NotFoundException from '#exceptions/not_found_exception'
import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import encryption from '@adonisjs/core/services/encryption'
import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import BenefitAccess from '#modules/benefits/models/benefit_access'
import BenefitEdition from '#modules/benefits/models/benefit_edition'
import Tenant from '#modules/tenants/models/tenant'
import User from '#modules/users/models/user'
import type { PaymentInput, PaymentObservation } from '#modules/purchases/interfaces/payment_port'
import type { Purchase, PurchaseCommand } from '#modules/purchases/models/purchase'
import PurchaseRepository from '#modules/purchases/repositories/purchase_repository'
import PaymentProviderService from '#modules/purchases/services/payment_provider_service'
import { purchaseHash } from '#modules/purchases/services/purchase_service'

@inject()
export default class PurchaseProcessingService {
  constructor(
    private repository: PurchaseRepository,
    private providers: PaymentProviderService
  ) {}

  async webhook(
    provider: string,
    headers: Record<string, string | undefined>,
    body: unknown,
    query: Record<string, unknown>
  ) {
    if (provider === 'stripe' && !headers['stripe-signature'])
      throw new InvalidPaymentWebhookException('Stripe webhook signature is required')
    const port = this.providers.get()
    if (provider !== port.name) throw new NotFoundException('Payment provider is not enabled')
    const event = port.verifyWebhook(headers, body, query)
    return db.transaction(async (client) => {
      const identity = {
        provider: port.name,
        account: port.account,
        environment: port.environment,
        event_key: event.key,
      }
      await this.repository
        .insert(
          'purchase_webhooks',
          { id: randomUUID(), ...identity, resource_id: event.resourceId },
          client
        )
        .onConflict(['provider', 'account', 'environment', 'event_key'])
        .ignore()
      const original = await this.repository.webhooks(client).where(identity).first()
      if (original.resource_id !== event.resourceId)
        throw new PurchaseConflictException('Payment notification conflicts with original event')
      return { id: original.id }
    })
  }

  async reconcile() {
    const port = this.providers.get()
    const inbox = await this.repository
      .webhooks()
      .where({ provider: port.name, account: port.account, environment: port.environment })
      .whereNull('processed_at')
      .orderByRaw('checked_at ASC NULLS FIRST')
      .limit(100)
    for (const event of inbox) {
      await this.repository
        .webhooks()
        .where('id', event.id)
        .update({
          checked_at: new Date(),
          attempts: event.attempts + 1,
          issue: 'unresolved_notification',
        })
      try {
        // Signed notifications only identify a resource. State is fetched from the authenticated PSP.
        const known = (await this.repository
          .purchases()
          .where({
            provider: port.name,
            provider_account: port.account,
            provider_environment: port.environment,
            provider_id: event.resource_id,
          })
          .first()) as Purchase | undefined
        const observed = await port.get(event.resource_id, known?.paid_at?.toISOString())
        if (!/^[0-9a-f-]{36}$/i.test(observed.reference)) continue
        await db.transaction(async (client) => {
          const p = await this.repository.get(observed.reference, client, true)
          if (!p || !this.matches(p, observed)) return
          await this.repository.update(p.id, { provider_id: observed.id }, client)
          await this.repository
            .webhooks(client)
            .where('id', event.id)
            .update({ purchase_id: p.id, issue: null })
          await this.repository.enqueue(p.id, 'reconcile', 'event:' + event.id, client)
        })
      } catch {
        /* Inbox remains durable for retry and operator inspection; never log raw PSP errors. */
      }
    }
    const rows = (await this.repository
      .purchases()
      .where({
        provider: port.name,
        provider_account: port.account,
        provider_environment: port.environment,
      })
      .whereNotNull('provider_id')
      .whereNot('status', 'refunded')
      .orderByRaw('checked_at ASC NULLS FIRST')
      .limit(100)) as Purchase[]
    await db.transaction(async (client) => {
      for (const p of rows)
        await this.repository.enqueue(
          p.id,
          'reconcile',
          'poll:' + p.id + ':' + Math.floor(Date.now() / 60000),
          client
        )
    })
    return { notifications: inbox.length, purchases: rows.length }
  }

  async drain(limit = 100) {
    let processed = 0
    let deferred = 0
    for (let index = 0; index < limit; index++) {
      const command = await this.repository.claim()
      if (!command) break
      try {
        await this.execute(command)
        processed++
      } catch {
        // An unknown outcome is never a failed payment or permission to release a hold.
        await this.repository
          .commands()
          .where({ id: command.id, lease_token: command.lease_token, status: 'processing' })
          .update({
            status: command.attempts >= 10 ? 'review' : 'pending',
            last_error: 'provider_or_processing_unavailable',
            lease_until: null,
            available_at: new Date(Date.now() + Math.min(3600, 2 ** command.attempts) * 1000),
          })
        deferred++
      }
    }
    return { processed, deferred }
  }

  private matches(p: Purchase, o: PaymentObservation) {
    return (
      o.reference === p.id &&
      o.account === p.provider_account &&
      o.environment === p.provider_environment &&
      o.amountCents === p.amount_cents &&
      o.currency === p.currency &&
      Number.isSafeInteger(o.refundedCents) &&
      o.refundedCents >= 0 &&
      o.refundedCents <= p.amount_cents &&
      (!p.provider_id || p.provider_id === o.id)
    )
  }

  private async execute(command: PurchaseCommand) {
    const p = await this.repository.get(command.purchase_id)
    if (!p) throw new Error('Missing purchase')
    if (command.kind === 'cancel' && p.status === 'cancelled' && !p.provider_id) {
      return db.transaction(async (client) => {
        if (await this.owns(command, client)) await this.finish(command, client)
      })
    }
    const port = this.providers.get()
    if (
      port.name !== p.provider ||
      port.account !== p.provider_account ||
      port.environment !== p.provider_environment
    )
      throw new Error('Provider configuration changed')
    let observed: PaymentObservation
    if (!p.provider_id) {
      if (command.kind !== 'create') throw new Error('Creation has not reconciled')
      const recovered = command.attempts > 1 ? await port.find(p.id) : null
      if (recovered) {
        if (!this.matches(p, recovered))
          return this.quarantine(p, command, 'provider_identity_or_amount_mismatch')
        await db.transaction(async (client) => {
          const locked = (await this.repository.get(p.id, client, true))!
          if (!(await this.owns(command, client))) return
          await this.applyObservation(locked, recovered, client)
          await this.finish(command, client)
        })
        return
      }
      // Beyond the safe external replay horizon, manual reconciliation must locate the original.
      if (command.attempts > 1 && Date.now() - p.created_at.getTime() > 23 * 3600000)
        return this.quarantine(p, command, 'creation_outcome_unknown')
      if (
        command.attempts === 1 &&
        (p.expires_at <= new Date() || p.issue === 'cancel_requested')
      ) {
        return db.transaction(async (client) => {
          const locked = (await this.repository.get(p.id, client, true))!
          if (!(await this.owns(command, client))) return
          await this.repository.update(p.id, { status: 'cancelled', payment_input: null }, client)
          await this.repository.audit(locked, 'expired_before_dispatch', {}, client)
          await this.finish(command, client)
        })
      }
      const input = encryption.decrypt<PaymentInput>(p.payment_input ?? '')
      if (!input) throw new Error('Payment input unavailable')
      observed = await port.create({
        id: p.id,
        amountCents: p.amount_cents,
        currency: p.currency,
        method: p.method,
        createdAt: p.created_at.toISOString(),
        expiresAt: p.expires_at.toISOString(),
        input,
      })
    } else {
      observed = await port.get(p.provider_id, p.paid_at?.toISOString())
      if (!this.matches(p, observed))
        return this.quarantine(p, command, 'provider_identity_or_amount_mismatch')
      if (command.kind === 'refund') {
        const r = await this.repository.refund(command.refund_id!)
        if (!r) throw new Error('Refund missing')
        if (
          ['approved', 'processing'].includes(r.status) &&
          observed.refundedCents < r.baseline_refunded_cents + r.amount_cents
        ) {
          if (observed.refundedCents !== r.baseline_refunded_cents || observed.state !== 'paid')
            return this.quarantine(p, command, 'refund_requires_reconciliation')
          if (command.attempts > 1 && Date.now() - command.created_at.getTime() > 23 * 3600000)
            return this.quarantine(p, command, 'refund_outcome_unknown')
          await this.repository
            .refunds()
            .where('id', r.id)
            .update({ status: 'processing', updated_at: new Date() })
          await port.refund(p.provider_id, r.amount_cents, r.id)
          observed = await port.get(p.provider_id, p.paid_at?.toISOString())
          // Accepted asynchronously is not refunded. Retain command/hold until a later observation.
          if (observed.refundedCents < r.baseline_refunded_cents + r.amount_cents)
            throw new Error('Refund is pending')
        }
      } else if (command.kind === 'cancel' && observed.state === 'pending') {
        await port.cancel(p.provider_id, 'cancel:' + p.id)
        observed = await port.get(p.provider_id, p.paid_at?.toISOString())
        if (observed.state === 'pending') throw new Error('Cancellation is pending')
      }
    }
    if (!this.matches(p, observed))
      return this.quarantine(p, command, 'provider_identity_or_amount_mismatch')
    await db.transaction(async (client) => {
      const locked = (await this.repository.get(p.id, client, true))!
      if (!(await this.owns(command, client))) return
      if (!this.matches(locked, observed))
        throw new Error('Payment identity changed while querying')
      await this.applyObservation(locked, observed, client)
      if (
        command.dedupe_key.startsWith('operator:') &&
        ['paid', 'refunded', 'cancelled', 'failed'].includes(observed.state)
      )
        await this.repository.release(p.id, 'reconciliation', client)
      await this.repository
        .webhooks(client)
        .where({ purchase_id: p.id, resource_id: observed.id })
        .whereNull('processed_at')
        .update({ processed_at: new Date() })
      await this.finish(command, client)
    })
  }

  private async owns(c: PurchaseCommand, client: TransactionClientContract) {
    return Boolean(
      await this.repository
        .commands(client)
        .where({ id: c.id, lease_token: c.lease_token, status: 'processing' })
        .where('lease_until', '>', new Date())
        .forUpdate()
        .first()
    )
  }
  private async finish(c: PurchaseCommand, client: TransactionClientContract) {
    await this.repository
      .commands(client)
      .where({ id: c.id, lease_token: c.lease_token })
      .update({ status: 'done', lease_until: null, last_error: null })
  }
  private async quarantine(p: Purchase, c: PurchaseCommand, reason: string) {
    await db.transaction(async (client) => {
      const locked = (await this.repository.get(p.id, client, true))!
      if (!(await this.owns(c, client))) return
      if (locked.access_id)
        await BenefitAccess.query({ client })
          .where('id', locked.access_id)
          .forUpdate()
          .firstOrFail()
      await this.repository.update(p.id, { issue: reason }, client)
      await this.repository.hold(locked, 'reconciliation', client)
      await this.repository
        .commands(client)
        .where('id', c.id)
        .update({ status: 'review', last_error: reason, lease_until: null })
      await this.repository.audit(locked, 'reconciliation_required', { reason }, client)
    })
  }

  private async applyObservation(
    p: Purchase,
    o: PaymentObservation,
    client: TransactionClientContract
  ) {
    const access = p.access_id
      ? await BenefitAccess.query({ client })
          .where({ id: p.access_id, tenant_id: p.tenant_id })
          .forUpdate()
          .firstOrFail()
      : null
    const refunded = Math.max(p.refunded_cents, o.refundedCents)
    const changes: Partial<Purchase> = {
      provider_id: o.id,
      checked_at: new Date(),
      instructions: o.instructions,
      payment_input: null,
      refunded_cents: refunded,
    }
    await this.repository.audit(
      p,
      'payment_observed',
      {
        command_source: 'provider_query',
        provider_id: o.id,
        state: o.state,
        provider_status: o.providerStatus ?? o.state,
        provider_detail: o.providerDetail ?? null,
        refund_references: o.refundReferences ?? [],
        refunded_cents: refunded,
      },
      client
    )
    if (o.state === 'disputed') await this.repository.hold(p, 'dispute', client)
    if (o.state === 'paid') await this.repository.release(p.id, 'dispute', client)
    if (refunded === p.amount_cents) {
      changes.status = 'refunded'
      changes.instructions = null
      if (access && access.status === 'active') {
        access.merge({
          status: 'revoked',
          revoked_at: DateTime.utc(),
          revocation_reason: 'Confirmed full payment refund',
        })
        await access.save()
        await this.repository.audit(p, 'access_revoked', { access_id: access.id }, client)
      }
    } else if (o.state === 'paid' && !access) {
      const edition = await BenefitEdition.query({ client })
        .where({ id: p.edition_id, tenant_id: p.tenant_id })
        .forUpdate()
        .first()
      const holder = await User.query({ client })
        .where('id', p.user_id)
        .whereHas('tenants', (q) => q.where('tenants.id', p.tenant_id))
        .first()
      const tenant = await Tenant.query({ client })
        .where({ id: p.tenant_id, is_active: true })
        .first()
      const prior = await BenefitAccess.query({ client })
        .where({ tenant_id: p.tenant_id, user_id: p.user_id, edition_id: p.edition_id })
        .first()
      const refund = await this.repository
        .refunds(client)
        .where('purchase_id', p.id)
        .whereNot('status', 'rejected')
        .first()
      const paidAt = o.paidAt ? new Date(o.paidAt) : null
      const inTime =
        paidAt &&
        Number.isFinite(paidAt.getTime()) &&
        paidAt >= new Date(p.created_at.getTime() - 1000) &&
        paidAt <= p.expires_at &&
        paidAt <= new Date(Date.now() + 1000)
      changes.paid_at =
        p.paid_at ?? (paidAt && Number.isFinite(paidAt.getTime()) ? paidAt : new Date())
      if (
        inTime &&
        tenant &&
        holder &&
        edition &&
        ['published', 'paused'].includes(edition.status) &&
        edition.usage_ends_at > DateTime.utc() &&
        !prior &&
        !refund &&
        p.issue !== 'cancel_requested' &&
        !refunded
      ) {
        const created = await BenefitAccess.create(
          {
            tenant_id: p.tenant_id,
            edition_id: p.edition_id,
            user_id: p.user_id,
            source: 'payment',
            status: 'active',
            external_reference:
              'payment:' +
              purchaseHash([p.provider, p.provider_account, p.provider_environment, o.id]),
            granted_by: null,
            granted_at: DateTime.utc(),
          },
          { client }
        )
        changes.access_id = created.id
        changes.status = 'paid'
        changes.issue = null
        await this.repository
          .holds(client)
          .where('purchase_id', p.id)
          .update({ access_id: created.id })
        await this.repository.audit(
          p,
          'access_granted',
          { access_id: created.id, source: 'verified_payment' },
          client
        )
      } else {
        // No impossible entitlement and no second holder access. Money remains accounted for.
        if (['pending', 'paid', 'review'].includes(p.status)) changes.status = 'review'
        changes.issue = 'paid_without_deliverable_access'
        if (!refund && !refunded) await this.compensate(p, client)
      }
    } else if (o.state === 'paid' && access && p.status !== 'refunded') {
      changes.status = 'paid'
    } else if (['cancelled', 'failed'].includes(o.state) && !p.paid_at && !access) {
      changes.status = o.state === 'cancelled' ? 'cancelled' : 'failed'
    }
    for (const r of await this.repository
      .refunds(client)
      .where('purchase_id', p.id)
      .whereIn('status', ['approved', 'processing'])) {
      if (refunded >= r.baseline_refunded_cents + r.amount_cents) {
        await this.repository
          .refunds(client)
          .where('id', r.id)
          .update({ status: 'succeeded', updated_at: new Date() })
        await this.repository.release(p.id, 'refund:' + r.id, client)
        await this.repository.audit(
          p,
          'refund_confirmed',
          { refund_id: r.id, amount_cents: r.amount_cents },
          client
        )
      }
    }
    await this.repository.update(p.id, changes, client)
  }

  private async compensate(p: Purchase, client: TransactionClientContract) {
    const id = randomUUID()
    await this.repository.insert(
      'purchase_refunds',
      {
        id,
        purchase_id: p.id,
        tenant_id: p.tenant_id,
        key_hash: purchaseHash('compensation'),
        request_hash: purchaseHash('compensation'),
        amount_cents: p.amount_cents,
        baseline_refunded_cents: 0,
        status: 'approved',
        reason: 'Confirmed payment cannot deliver the purchased access',
      },
      client
    )
    await this.repository.hold(p, 'refund:' + id, client)
    await this.repository.enqueue(p.id, 'refund', 'refund:' + id, client, id)
    await this.repository.audit(p, 'compensation_scheduled', { refund_id: id }, client)
  }
}
