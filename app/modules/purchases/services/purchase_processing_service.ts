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
import BenefitAccessRepository from '#modules/benefits/repositories/benefit_access_repository'
import BenefitEditionRepository from '#modules/benefits/repositories/benefit_edition_repository'
import BenefitOfferRepository from '#modules/benefits/repositories/benefit_offer_repository'
import TenantRepository from '#modules/tenants/repositories/tenant_repository'
import UsersRepository from '#modules/users/repositories/users_repository'
import type { PaymentInput, PaymentObservation } from '#modules/purchases/interfaces/payment_port'
import type { Purchase, PurchaseCommand } from '#modules/purchases/models/purchase'
import PurchaseRepository from '#modules/purchases/repositories/purchase_repository'
import PaymentProviderService from '#modules/purchases/services/payment_provider_service'
import { purchaseHash } from '#modules/purchases/services/purchase_service'

@inject()
export default class PurchaseProcessingService {
  constructor(
    private repository: PurchaseRepository,
    private providers: PaymentProviderService,
    private accessRepository: BenefitAccessRepository,
    private editionRepository: BenefitEditionRepository,
    private offerRepository: BenefitOfferRepository,
    private tenantRepository: TenantRepository,
    private usersRepository: UsersRepository
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
      await this.repository.recordWebhook(
        { id: randomUUID(), ...identity, resource_id: event.resourceId },
        client
      )
      const original = await this.repository.findWebhook(identity, client)
      if (original.resource_id !== event.resourceId)
        throw new PurchaseConflictException('Payment notification conflicts with original event')
      return { id: original.id }
    })
  }

  async reconcile() {
    const port = this.providers.get()
    const inbox = await this.repository.listUnprocessedWebhooks(port)
    for (const event of inbox) {
      await this.repository.updateWebhook(event.id, {
        checked_at: new Date(),
        attempts: event.attempts + 1,
        issue: 'unresolved_notification',
      })
      try {
        // Signed notifications only identify a resource. State is fetched from the authenticated PSP.
        const known = await this.repository.findByProviderId(port, event.resource_id)
        const observed = await port.get(event.resource_id, known?.paid_at?.toISOString())
        if (!/^[0-9a-f-]{36}$/i.test(observed.reference)) continue
        await db.transaction(async (client) => {
          const p = await this.repository.get(observed.reference, client, true)
          if (!p || !this.matches(p, observed)) return
          await this.repository.update(p.id, { provider_id: observed.id }, client)
          await this.repository.updateWebhook(event.id, { purchase_id: p.id, issue: null }, client)
          await this.repository.enqueue(p.id, 'reconcile', 'event:' + event.id, client)
        })
      } catch {
        /* Inbox remains durable for retry and operator inspection; never log raw PSP errors. */
      }
    }
    const rows = await this.repository.listToPoll(port)
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
        await this.repository.updateLeasedCommand(command, {
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
          await this.repository.updateRefund(r.id, { status: 'processing', updated_at: new Date() })
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
      await this.repository.markWebhooksProcessed(p.id, observed.id, client)
      await this.finish(command, client)
    })
  }

  private async owns(c: PurchaseCommand, client: TransactionClientContract) {
    return Boolean(await this.repository.lockLeasedCommand(c, client))
  }
  private async finish(c: PurchaseCommand, client: TransactionClientContract) {
    await this.repository.completeLeasedCommand(c, client)
  }
  private async quarantine(p: Purchase, c: PurchaseCommand, reason: string) {
    await db.transaction(async (client) => {
      const locked = (await this.repository.get(p.id, client, true))!
      if (!(await this.owns(c, client))) return
      if (locked.access_id) await this.accessRepository.lockOrFail(locked.access_id, client)
      await this.repository.update(p.id, { issue: reason }, client)
      await this.repository.hold(locked, 'reconciliation', client)
      await this.repository.updateCommand(
        c.id,
        { status: 'review', last_error: reason, lease_until: null },
        client
      )
      await this.repository.audit(locked, 'reconciliation_required', { reason }, client)
    })
  }

  private async applyObservation(
    p: Purchase,
    o: PaymentObservation,
    client: TransactionClientContract
  ) {
    const access = p.access_id
      ? await this.accessRepository.lockOrFail(p.access_id, client, p.tenant_id)
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
      const edition = await this.editionRepository.findLocked(p.tenant_id, p.edition_id, client)
      const holder = await this.usersRepository.findMemberOfTenant(p.user_id, p.tenant_id, client)
      const tenant = await this.tenantRepository.findActiveById(p.tenant_id, client)
      const prior = await this.accessRepository.findForHolderProduct(
        p.tenant_id,
        p.edition_id,
        p.user_id,
        p.offer_id,
        client
      )
      const selectedOffer =
        p.offer_id === null
          ? null
          : await this.offerRepository.findDeliverable(
              p.tenant_id,
              p.edition_id,
              p.offer_id,
              client
            )
      const scopeDeliverable =
        p.offer_id === null ||
        (selectedOffer && (!selectedOffer.ends_at || selectedOffer.ends_at > DateTime.utc()))
      const refund = await this.repository.findUnrejectedRefund(p.id, client)
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
        scopeDeliverable &&
        !refund &&
        p.issue !== 'cancel_requested' &&
        !refunded
      ) {
        const created = await this.accessRepository.create(
          {
            tenant_id: p.tenant_id,
            edition_id: p.edition_id,
            offer_id: p.offer_id,
            user_id: p.user_id,
            source: 'payment',
            status: 'active',
            external_reference:
              'payment:' +
              purchaseHash([p.provider, p.provider_account, p.provider_environment, o.id]),
            granted_by: null,
            granted_at: DateTime.utc(),
          },
          client
        )
        changes.access_id = created.id
        changes.status = 'paid'
        changes.issue = null
        await this.repository.linkHoldsToAccess(p.id, created.id, client)
        await this.repository.audit(
          p,
          'access_granted',
          { access_id: created.id, offer_id: p.offer_id, source: 'verified_payment' },
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
    for (const r of await this.repository.listRefundsAwaitingConfirmation(p.id, client)) {
      if (refunded >= r.baseline_refunded_cents + r.amount_cents) {
        await this.repository.updateRefund(
          r.id,
          { status: 'succeeded', updated_at: new Date() },
          client
        )
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
    await this.repository.insertRefund(
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
