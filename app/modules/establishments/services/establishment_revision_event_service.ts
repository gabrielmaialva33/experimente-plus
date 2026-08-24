import { inject } from '@adonisjs/core'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import type IEstablishmentReview from '#modules/establishments/interfaces/establishment_review_interface'
import type EstablishmentRevision from '#modules/establishments/models/establishment_revision'
import EstablishmentRevisionEventRepository from '#modules/establishments/repositories/establishment_revision_event_repository'

@inject()
export default class EstablishmentRevisionEventService {
  constructor(private eventRepository: EstablishmentRevisionEventRepository) {}

  async record(
    revision: EstablishmentRevision,
    eventType: IEstablishmentReview.EventType,
    actorId: number,
    fromStatus: EstablishmentRevision['status'] | null,
    toStatus: EstablishmentRevision['status'],
    reason: string | null,
    metadata: IEstablishmentReview.EventMetadata | null,
    client: TransactionClientContract
  ): Promise<void> {
    await this.eventRepository.create(
      {
        tenant_id: revision.tenant_id,
        establishment_id: revision.establishment_id,
        revision_id: revision.id,
        event_type: eventType,
        from_status: fromStatus,
        to_status: toStatus,
        actor_id: actorId,
        reason,
        metadata,
      },
      { client }
    )
  }
}
