import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import type IPartnerContent from '#modules/partner_content/interfaces/partner_content_interface'

export interface RecordedEvent {
  tenantId: number
  establishmentId: number
  kind: IPartnerContent.ContentKind
  contentId: number
  action: IPartnerContent.EventAction
  actorId: number
  fromStatus?: IPartnerContent.ContentStatus | null
  toStatus?: IPartnerContent.ContentStatus | null
  changes?: IPartnerContent.FieldChanges | null
  metadata?: Record<string, unknown> | null
}

/**
 * The append-only history of partner content — ADR-0028 §4.
 *
 * Writes always take the caller's transaction: an event recorded outside the
 * act it describes could survive an act that rolled back, or be lost from one
 * that committed. The table itself refuses updates and deletes.
 */
export default class PartnerContentEventRepository {
  async record(event: RecordedEvent, client: TransactionClientContract): Promise<void> {
    const changes = event.changes && Object.keys(event.changes).length > 0 ? event.changes : null

    await client.table('partner_content_events').insert({
      tenant_id: event.tenantId,
      establishment_id: event.establishmentId,
      content_kind: event.kind,
      content_id: event.contentId,
      action: event.action,
      from_status: event.fromStatus ?? null,
      to_status: event.toStatus ?? null,
      actor_id: event.actorId,
      changes: changes ? JSON.stringify(changes) : null,
      metadata: event.metadata ? JSON.stringify(event.metadata) : null,
      created_at: new Date(),
    })
  }

  /** Newest first, the way a moderator reads what happened last. */
  async history(
    tenantId: number,
    kind: IPartnerContent.ContentKind,
    contentId: number
  ): Promise<IPartnerContent.EventProjection[]> {
    const rows = await db
      .from('partner_content_events as event')
      .leftJoin('users as actor', 'actor.id', 'event.actor_id')
      .where('event.tenant_id', tenantId)
      .where('event.content_kind', kind)
      .where('event.content_id', contentId)
      .orderBy('event.created_at', 'desc')
      .orderBy('event.id', 'desc')
      .select(
        'event.id',
        'event.action',
        'event.from_status',
        'event.to_status',
        'event.changes',
        'event.metadata',
        'event.created_at',
        'actor.id as actor_id',
        'actor.full_name as actor_name'
      )

    return rows.map((row) => ({
      id: Number(row.id),
      action: row.action,
      from_status: row.from_status ?? null,
      to_status: row.to_status ?? null,
      actor: row.actor_id ? { id: Number(row.actor_id), full_name: row.actor_name } : null,
      changes: row.changes ?? null,
      metadata: row.metadata ?? null,
      created_at: new Date(row.created_at).toISOString(),
    }))
  }
}
