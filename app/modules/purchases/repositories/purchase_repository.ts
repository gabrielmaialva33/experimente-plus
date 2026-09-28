import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { Purchase, PurchaseCommand, PurchaseRefund } from '#modules/purchases/models/purchase'

type Client = TransactionClientContract
type Row = Record<string, unknown>
/** The configured PSP account a purchase or notification belongs to. */
type ProviderIdentity = { name: string; account: string; environment: string }
export default class PurchaseRepository {
  insert(table: string, data: Record<string, unknown>, client?: Client) {
    return (client ?? db).table(table).insert(data)
  }
  purchases(client?: Client) {
    return (client ?? db).from('purchases')
  }
  refunds(client?: Client) {
    return (client ?? db).from('purchase_refunds')
  }
  commands(client?: Client) {
    return (client ?? db).from('purchase_commands')
  }
  holds(client?: Client) {
    return (client ?? db).from('purchase_financial_holds')
  }
  events(client?: Client) {
    return (client ?? db).from('purchase_events')
  }
  webhooks(client?: Client) {
    return (client ?? db).from('purchase_webhooks')
  }
  async get(id: string, client?: Client, lock = false): Promise<Purchase | null> {
    const q = this.purchases(client).where('id', id)
    if (lock) q.forUpdate()
    return q.first()
  }
  async refund(id: string, client?: Client): Promise<PurchaseRefund | null> {
    return this.refunds(client).where('id', id).first()
  }
  async update(id: string, data: Partial<Purchase>, client: Client) {
    const { snapshot, instructions, ...rest } = data
    await this.purchases(client)
      .where('id', id)
      .update({
        ...rest,
        updated_at: new Date(),
        ...(snapshot ? { snapshot: JSON.stringify(snapshot) } : {}),
        ...(instructions !== undefined
          ? { instructions: instructions ? JSON.stringify(instructions) : null }
          : {}),
      })
  }
  async audit(
    purchase: Purchase,
    action: string,
    data: Record<string, unknown>,
    client: Client,
    actorId?: number
  ) {
    await this.insert(
      'purchase_events',
      {
        purchase_id: purchase.id,
        tenant_id: purchase.tenant_id,
        actor_id: actorId ?? null,
        action,
        data: JSON.stringify(data),
      },
      client
    )
  }
  async enqueue(
    purchaseId: string,
    kind: PurchaseCommand['kind'],
    key: string,
    client: Client,
    refundId?: string
  ) {
    await this.insert(
      'purchase_commands',
      {
        id: randomUUID(),
        purchase_id: purchaseId,
        kind,
        dedupe_key: key,
        refund_id: refundId ?? null,
        // claim() compares against the application clock; the column default would use
        // PostgreSQL's, whose microseconds can land after a claim in the same millisecond.
        available_at: new Date(),
      },
      client
    )
      .onConflict('dedupe_key')
      .ignore()
  }
  async hold(purchase: Purchase, reason: string, client: Client) {
    await this.insert(
      'purchase_financial_holds',
      {
        id: randomUUID(),
        purchase_id: purchase.id,
        tenant_id: purchase.tenant_id,
        access_id: purchase.access_id,
        reason,
      },
      client
    )
      .onConflict(['purchase_id', 'reason'])
      .merge({ released_at: null })
  }
  async release(purchaseId: string, reason: string, client: Client) {
    await this.holds(client)
      .where('purchase_id', purchaseId)
      .where('reason', reason)
      .whereNull('released_at')
      .update({ released_at: new Date() })
  }
  async insertPurchase(data: Row, client: Client) {
    await this.insert('purchases', data, client)
  }
  async findByKey(
    tenantId: number,
    userId: number,
    keyHash: string,
    client: Client
  ): Promise<Purchase | undefined> {
    return this.purchases(client)
      .where({ tenant_id: tenantId, user_id: userId, key_hash: keyHash })
      .first()
  }
  /** The holder's purchase of the product (edition, or one offer of it) not yet settled. */
  async findOpenForHolderProduct(
    tenantId: number,
    editionId: number,
    userId: number,
    offerId: number | null,
    client: Client
  ): Promise<Purchase | undefined> {
    return this.purchases(client)
      .where({ tenant_id: tenantId, edition_id: editionId, user_id: userId })
      .whereRaw('COALESCE(offer_id, 0) = ?', [offerId ?? 0])
      .whereIn('status', ['pending', 'paid', 'review'])
      .first()
  }
  async findByProviderId(
    provider: ProviderIdentity,
    providerId: string,
    client?: Client,
    lock = false
  ): Promise<Purchase | undefined> {
    const q = this.purchases(client).where({
      provider: provider.name,
      provider_account: provider.account,
      provider_environment: provider.environment,
      provider_id: providerId,
    })
    if (lock) q.forUpdate()
    return q.first()
  }
  async listForHolder(tenantId: number, userId: number): Promise<Purchase[]> {
    return this.purchases()
      .where({ tenant_id: tenantId, user_id: userId })
      .orderBy('created_at', 'desc')
      .limit(100)
  }
  async listForTenant(tenantId: number): Promise<Purchase[]> {
    return this.purchases().where('tenant_id', tenantId).orderBy('created_at', 'desc').limit(100)
  }
  /** Purchases known to the provider and not refunded, least recently checked first. */
  async listToPoll(provider: ProviderIdentity): Promise<Purchase[]> {
    return this.purchases()
      .where({
        provider: provider.name,
        provider_account: provider.account,
        provider_environment: provider.environment,
      })
      .whereNotNull('provider_id')
      .whereNot('status', 'refunded')
      .orderByRaw('checked_at ASC NULLS FIRST')
      .limit(100)
  }
  async listPaidWithoutAccess(tenantId: number) {
    return this.purchases()
      .select('id', 'issue')
      .where('tenant_id', tenantId)
      .whereNotNull('paid_at')
      .whereNull('access_id')
      .whereNot('status', 'refunded')
  }
  /** Payment-sourced accesses of the operation that no purchase points at. */
  async listUnlinkedPaymentAccesses(tenantId: number) {
    return db
      .from('benefit_accesses as a')
      .leftJoin('purchases as p', 'p.access_id', 'a.id')
      .where('a.tenant_id', tenantId)
      .where('a.source', 'payment')
      .whereNull('p.id')
      .select('a.id')
  }
  /** The back-office orders list: newest first, with the buyer, optionally by status. */
  async paginateForOperations(
    tenantId: number,
    status: string | undefined,
    page: number,
    perPage: number
  ) {
    const query = db
      .from('purchases')
      .leftJoin('users', 'users.id', 'purchases.user_id')
      .where('purchases.tenant_id', tenantId)
      .orderBy('purchases.created_at', 'desc')
      .orderBy('purchases.id', 'desc')
      .select(
        'purchases.id',
        'purchases.created_at',
        'purchases.snapshot',
        'purchases.offer_id',
        'purchases.amount_cents',
        'purchases.currency',
        'purchases.method',
        'purchases.status',
        'purchases.provider',
        'purchases.paid_at',
        'purchases.expires_at',
        'purchases.access_id',
        'users.full_name as buyer_name',
        'users.email as buyer_email'
      )
    if (status) query.where('purchases.status', status)
    return query.paginate(page, perPage)
  }
  async countByStatus(tenantId: number) {
    return db
      .from('purchases')
      .where('tenant_id', tenantId)
      .groupBy('status')
      .select('status')
      .count('* as total')
  }
  async insertRefund(data: Row, client: Client) {
    await this.insert('purchase_refunds', data, client)
  }
  async updateRefund(id: string, data: Row, client?: Client) {
    await this.refunds(client).where('id', id).update(data)
  }
  async listRefunds(purchaseId: string): Promise<PurchaseRefund[]> {
    return this.refunds().where('purchase_id', purchaseId).orderBy('created_at')
  }
  async findRefundByKey(
    purchaseId: string,
    keyHash: string,
    client: Client
  ): Promise<PurchaseRefund | undefined> {
    return this.refunds(client).where({ purchase_id: purchaseId, key_hash: keyHash }).first()
  }
  async findRefundInProgress(
    purchaseId: string,
    client: Client
  ): Promise<PurchaseRefund | undefined> {
    return this.refunds(client)
      .where('purchase_id', purchaseId)
      .whereIn('status', ['review', 'approved', 'processing'])
      .first()
  }
  async findUnrejectedRefund(
    purchaseId: string,
    client: Client
  ): Promise<PurchaseRefund | undefined> {
    return this.refunds(client)
      .where('purchase_id', purchaseId)
      .whereNot('status', 'rejected')
      .first()
  }
  /** Refunds sent (or about to be sent) to the provider and not yet confirmed. */
  async listRefundsAwaitingConfirmation(
    purchaseId: string,
    client: Client
  ): Promise<PurchaseRefund[]> {
    return this.refunds(client)
      .where('purchase_id', purchaseId)
      .whereIn('status', ['approved', 'processing'])
  }
  async hasActiveHold(purchaseId: string): Promise<boolean> {
    return Boolean(
      await this.holds().where('purchase_id', purchaseId).whereNull('released_at').first()
    )
  }
  async linkHoldsToAccess(purchaseId: string, accessId: number, client: Client) {
    await this.holds(client).where('purchase_id', purchaseId).update({ access_id: accessId })
  }
  async listHoldsForOperations(purchaseId: string) {
    return this.holds()
      .select('reason', 'created_at', 'released_at')
      .where('purchase_id', purchaseId)
  }
  async listEventsForOperations(purchaseId: string) {
    return this.events()
      .select('id', 'action', 'actor_id', 'data', 'created_at')
      .where('purchase_id', purchaseId)
      .orderBy('id')
  }
  async findOperatorReconciliation(purchaseId: string, keyHash: string, client: Client) {
    return this.events(client)
      .where({ purchase_id: purchaseId, action: 'operator_reconciliation' })
      .whereRaw("data->>'key_hash' = ?", [keyHash])
      .first()
  }
  async listCommandsForOperations(purchaseId: string) {
    return this.commands()
      .select('id', 'kind', 'status', 'attempts', 'last_error', 'created_at')
      .where('purchase_id', purchaseId)
      .orderBy('created_at')
  }
  /** A command of the purchase whose lease is still live. */
  async findActiveCommand(purchaseId: string, client: Client) {
    return this.commands(client)
      .where('purchase_id', purchaseId)
      .where('status', 'processing')
      .where('lease_until', '>', new Date())
      .first()
  }
  /** Make the purchase's pending and review commands available again, now. */
  async rescheduleCommands(purchaseId: string, client: Client) {
    await this.commands(client)
      .where('purchase_id', purchaseId)
      .whereIn('status', ['review', 'pending'])
      .update({ status: 'pending', available_at: new Date() })
  }
  /** Lock the command while the caller's lease on it is current. */
  async lockLeasedCommand(command: PurchaseCommand, client: Client) {
    return this.commands(client)
      .where({ id: command.id, lease_token: command.lease_token, status: 'processing' })
      .where('lease_until', '>', new Date())
      .forUpdate()
      .first()
  }
  /** Update the command only while it is still processing under the caller's lease. */
  async updateLeasedCommand(command: PurchaseCommand, changes: Row) {
    await this.commands()
      .where({ id: command.id, lease_token: command.lease_token, status: 'processing' })
      .update(changes)
  }
  async completeLeasedCommand(command: PurchaseCommand, client: Client) {
    await this.commands(client)
      .where({ id: command.id, lease_token: command.lease_token })
      .update({ status: 'done', lease_until: null, last_error: null })
  }
  async updateCommand(id: string, changes: Row, client: Client) {
    await this.commands(client).where('id', id).update(changes)
  }
  /** Record a verified notification once per provider account, environment and event key. */
  async recordWebhook(data: Row, client: Client) {
    await this.insert('purchase_webhooks', data, client)
      .onConflict(['provider', 'account', 'environment', 'event_key'])
      .ignore()
  }
  async findWebhook(identity: Row, client: Client) {
    return this.webhooks(client).where(identity).first()
  }
  /** Unprocessed notifications of the provider account, least recently checked first. */
  async listUnprocessedWebhooks(provider: ProviderIdentity) {
    return this.webhooks()
      .where({
        provider: provider.name,
        account: provider.account,
        environment: provider.environment,
      })
      .whereNull('processed_at')
      .orderByRaw('checked_at ASC NULLS FIRST')
      .limit(100)
  }
  async updateWebhook(id: string, changes: Row, client?: Client) {
    await this.webhooks(client).where('id', id).update(changes)
  }
  async markWebhooksProcessed(purchaseId: string, resourceId: string, client: Client) {
    await this.webhooks(client)
      .where({ purchase_id: purchaseId, resource_id: resourceId })
      .whereNull('processed_at')
      .update({ processed_at: new Date() })
  }
  /** Serialize settlement evidence across requests for the rest of the transaction. */
  async lockSettlements(client: Client) {
    await client.rawQuery('SELECT pg_advisory_xact_lock(1788814801)')
  }
  async findSettlement(identity: Row, client: Client) {
    return client.from('purchase_settlements').where(identity).first()
  }
  async insertSettlement(data: Row, client: Client) {
    await client.table('purchase_settlements').insert(data)
  }
  /** Recent settlement lines of the operation beside the local purchase they match. */
  async listSettlementsForReconciliation(tenantId: number) {
    return db
      .from('purchase_settlements as s')
      .leftJoin('purchases as p', 'p.id', 's.purchase_id')
      .where('s.tenant_id', tenantId)
      .select(
        's.id',
        's.purchase_id',
        's.gross_cents',
        's.fee_cents',
        's.net_cents',
        's.refunded_cents',
        's.currency',
        'p.amount_cents',
        'p.refunded_cents as local_refunded_cents',
        'p.paid_at',
        'p.access_id'
      )
      .orderBy('s.created_at', 'desc')
      .limit(100)
  }
  async claim(): Promise<PurchaseCommand | null> {
    return db.transaction(async (client) => {
      // Serialize dispatch across workers; each purchase has at most one live command lease.
      await client.rawQuery('SELECT pg_advisory_xact_lock(1788814800)')
      const row = await this.commands(client)
        .where((q) =>
          q
            .where('status', 'pending')
            .orWhere((sub) =>
              sub.where('status', 'processing').where('lease_until', '<', new Date())
            )
        )
        .where('available_at', '<=', new Date())
        .whereNotIn(
          'purchase_id',
          this.commands(client)
            .select('purchase_id')
            .where('status', 'processing')
            .where('lease_until', '>', new Date())
        )
        .orderBy('created_at', 'asc')
        .forUpdate()
        .skipLocked()
        .first()
      if (!row) return null
      const token = randomUUID()
      await this.commands(client)
        .where('id', row.id)
        .update({
          status: 'processing',
          attempts: row.attempts + 1,
          lease_token: token,
          lease_until: new Date(Date.now() + 120000),
        })
      return { ...row, attempts: row.attempts + 1, lease_token: token }
    })
  }
}
