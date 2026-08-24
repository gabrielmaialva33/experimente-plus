import { inject } from '@adonisjs/core'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import type IMedia from '#modules/media/interfaces/media_interface'
import type EstablishmentRevisionMedia from '#modules/media/models/establishment_revision_media'
import MediaModerationEventRepository from '#modules/media/repositories/media_moderation_event_repository'

@inject()
export default class MediaEventService {
  constructor(private eventRepository: MediaModerationEventRepository) {}

  async record(
    media: EstablishmentRevisionMedia,
    actorId: number,
    fromStatus: IMedia.ModerationStatus | null,
    toStatus: IMedia.EventStatus,
    reason: string | null,
    metadata: Record<string, unknown> | null,
    client: TransactionClientContract
  ): Promise<void> {
    await this.eventRepository.create(
      {
        tenant_id: media.tenant_id,
        establishment_id: media.establishment_id,
        revision_id: media.revision_id,
        media_asset_id: media.media_asset_id,
        revision_media_id: media.id,
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
