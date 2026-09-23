import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import type IReview from '#modules/reviews/interfaces/review_interface'

/**
 * Bans on a membership — ADR-0027 §6.
 *
 * `user_tenants` is a pivot with no model of its own, so it is read and written
 * here directly. The averages the ban affects are not touched from this file:
 * a trigger on `banned_at` recomputes them, so no write path can change a ban
 * and leave the catalogue counting reviews nobody can see.
 */
export default class UserBanRepository {
  async membership(
    tenantId: number,
    userId: number,
    client?: TransactionClientContract,
    lock = false
  ) {
    const query = (client ?? db)
      .from('user_tenants')
      .where('tenant_id', tenantId)
      .where('user_id', userId)
    if (lock) query.forUpdate()
    return query.first()
  }

  async isBanned(tenantId: number, userId: number): Promise<boolean> {
    const row = await db
      .from('user_tenants')
      .where('tenant_id', tenantId)
      .where('user_id', userId)
      .whereNotNull('banned_at')
      .first()

    return Boolean(row)
  }

  /** The banned subset of the given users, for projecting many at once. */
  async bannedAmong(tenantId: number, userIds: number[]): Promise<Set<number>> {
    if (userIds.length === 0) return new Set()
    const rows = await db
      .from('user_tenants')
      .where('tenant_id', tenantId)
      .whereIn('user_id', userIds)
      .whereNotNull('banned_at')
      .select('user_id')

    return new Set(rows.map((row) => Number(row.user_id)))
  }

  async setBan(
    tenantId: number,
    userId: number,
    actorId: number,
    reason: string,
    client: TransactionClientContract
  ): Promise<void> {
    await client.from('user_tenants').where('tenant_id', tenantId).where('user_id', userId).update({
      banned_at: new Date(),
      banned_by: actorId,
      ban_reason: reason,
      updated_at: new Date(),
    })
  }

  async clearBan(
    tenantId: number,
    userId: number,
    client: TransactionClientContract
  ): Promise<void> {
    await client
      .from('user_tenants')
      .where('tenant_id', tenantId)
      .where('user_id', userId)
      .update({ banned_at: null, banned_by: null, ban_reason: null, updated_at: new Date() })
  }

  async recordEvent(
    event: {
      tenantId: number
      userId: number
      actorId: number
      action: 'banned' | 'unbanned'
      reason: string | null
    },
    client: TransactionClientContract
  ): Promise<void> {
    await client.table('user_ban_events').insert({
      tenant_id: event.tenantId,
      user_id: event.userId,
      actor_id: event.actorId,
      action: event.action,
      reason: event.reason,
      created_at: new Date(),
    })
  }

  async history(tenantId: number, userId: number): Promise<IReview.BanEvent[]> {
    const rows = await db
      .from('user_ban_events as event')
      .leftJoin('users as actor', 'actor.id', 'event.actor_id')
      .where('event.tenant_id', tenantId)
      .where('event.user_id', userId)
      .orderBy('event.created_at', 'desc')
      .orderBy('event.id', 'desc')
      .select(
        'event.id',
        'event.action',
        'event.reason',
        'event.created_at',
        'actor.id as actor_id',
        'actor.full_name as actor_name'
      )

    return rows.map((row) => ({
      id: Number(row.id),
      action: row.action,
      reason: row.reason ?? null,
      actor: row.actor_id ? { id: Number(row.actor_id), full_name: row.actor_name } : null,
      created_at: new Date(row.created_at).toISOString(),
    }))
  }
}
