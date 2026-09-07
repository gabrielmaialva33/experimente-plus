import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { Purchase, PurchaseCommand, PurchaseRefund } from '#modules/purchases/models/purchase'

type Client = TransactionClientContract
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
