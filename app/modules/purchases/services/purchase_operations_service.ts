import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import { randomUUID } from 'node:crypto'
import BadRequestException from '#exceptions/bad_request_exception'
import NotFoundException from '#exceptions/not_found_exception'
import BenefitRedemptionRepository from '#modules/benefits/repositories/benefit_redemption_repository'
import OrganizationPolicyService from '#modules/organizations/services/organization_policy_service'
import type User from '#modules/users/models/user'
import PurchaseRepository from '#modules/purchases/repositories/purchase_repository'
import PaymentProviderService from '#modules/purchases/services/payment_provider_service'
import { purchaseHash, purchaseKey } from '#modules/purchases/services/purchase_service'

export interface SettlementInput {
  provider_id: string
  statement_reference: string
  line_reference: string
  currency: string
  gross_cents: number
  fee_cents: number
  net_cents: number
  refunded_cents: number
  settled_at: string
}

@inject()
export default class PurchaseOperationsService {
  constructor(
    private repository: PurchaseRepository,
    private policy: OrganizationPolicyService,
    private providers: PaymentProviderService,
    private redemptionRepository: BenefitRedemptionRepository
  ) {}
  async detail(tenantId: number, actor: User, id: string) {
    await this.policy.requirePlatformAdmin(actor)
    const p = await this.repository.get(id)
    if (!p || p.tenant_id !== tenantId) throw new NotFoundException('Purchase not found')
    return {
      id: p.id,
      provider: p.provider,
      provider_id: p.provider_id,
      issue: p.issue,
      events: await this.repository.listEventsForOperations(id),
      commands: await this.repository.listCommandsForOperations(id),
      holds: await this.repository.listHoldsForOperations(id),
      redemptions: p.access_id
        ? await this.redemptionRepository.listReceiptsForAccess(tenantId, p.access_id)
        : [],
    }
  }
  async retry(
    tenantId: number,
    actor: User,
    id: string,
    key: string,
    input: { reason: string; provider_id?: string }
  ) {
    await this.policy.requirePlatformAdmin(actor)
    const hash = purchaseKey(key)
    return db.transaction(async (client) => {
      const p = await this.repository.get(id, client, true)
      if (!p || p.tenant_id !== tenantId) throw new NotFoundException('Purchase not found')
      const prior = await this.repository.findOperatorReconciliation(id, hash, client)
      if (prior) {
        if (prior.data.request_hash !== purchaseHash(input))
          throw new BadRequestException('Conflicting reconciliation request')
        return { id }
      }
      if (await this.repository.findActiveCommand(id, client))
        throw new BadRequestException('Wait for the active payment command')
      if (input.provider_id && p.provider_id && p.provider_id !== input.provider_id)
        throw new BadRequestException('Provider identity cannot change')
      // An operator can supply a missing correlation, never declare money paid or grant access.
      if (input.provider_id)
        await this.repository.update(id, { provider_id: input.provider_id }, client)
      await this.repository.rescheduleCommands(id, client)
      await this.repository.enqueue(id, 'reconcile', 'operator:' + id + ':' + hash, client)
      await this.repository.audit(
        p,
        'operator_reconciliation',
        { key_hash: hash, request_hash: purchaseHash(input), reason: input.reason },
        client,
        actor.id
      )
      return { id }
    })
  }
  async settlement(tenantId: number, actor: User, input: SettlementInput) {
    await this.policy.requirePlatformAdmin(actor)
    if (!Number.isFinite(Date.parse(input.settled_at)))
      throw new BadRequestException('Invalid settlement date')
    const provider = this.providers.get()
    return db.transaction(async (client) => {
      const identity = {
        provider: provider.name,
        provider_account: provider.account,
        provider_environment: provider.environment,
        statement_reference: input.statement_reference,
        line_reference: input.line_reference,
      }
      const hash = purchaseHash(input)
      await this.repository.lockSettlements(client)
      const existing = await this.repository.findSettlement(identity, client)
      if (existing) {
        if (existing.tenant_id !== tenantId || existing.request_hash !== hash)
          throw new BadRequestException('Statement line conflicts with original evidence')
        return { id: existing.id }
      }
      const p = await this.repository.findByProviderId(provider, input.provider_id, client, true)
      if (p && p.tenant_id !== tenantId)
        throw new NotFoundException('Payment not found in operation')
      const id = randomUUID()
      await this.repository.insertSettlement(
        {
          id,
          ...identity,
          ...input,
          settled_at: new Date(input.settled_at),
          purchase_id: p?.id ?? null,
          tenant_id: tenantId,
          request_hash: hash,
          recorded_by: actor.id,
        },
        client
      )
      if (p)
        await this.repository.audit(
          p,
          'settlement_recorded',
          { settlement_id: id },
          client,
          actor.id
        )
      return { id }
    })
  }
  async reconciliation(tenantId: number, actor: User) {
    await this.policy.requirePlatformAdmin(actor)
    const rows = await this.repository.listSettlementsForReconciliation(tenantId)
    const issues = rows.flatMap((r) => {
      const reasons = []
      if (!r.purchase_id) reasons.push('orphan_payment')
      if (r.purchase_id && r.gross_cents !== r.amount_cents) reasons.push('gross_mismatch')
      if (r.net_cents !== r.gross_cents - r.fee_cents - r.refunded_cents)
        reasons.push('net_mismatch')
      if (r.purchase_id && r.refunded_cents !== r.local_refunded_cents)
        reasons.push('refund_mismatch')
      if (r.purchase_id && !r.paid_at) reasons.push('payment_unconfirmed_locally')
      return reasons.length ? [{ settlement_id: r.id, purchase_id: r.purchase_id, reasons }] : []
    })
    const paidWithoutAccess = await this.repository.listPaidWithoutAccess(tenantId)
    const unlinkedAccesses = await this.repository.listUnlinkedPaymentAccesses(tenantId)
    return {
      settlements_checked: rows.length,
      issues,
      paid_without_access: paidWithoutAccess,
      unlinked_payment_accesses: unlinkedAccesses,
    }
  }
}
