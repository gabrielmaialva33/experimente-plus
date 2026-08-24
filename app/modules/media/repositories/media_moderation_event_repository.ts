import MediaModerationEvent from '#modules/media/models/media_moderation_event'
import LucidRepository from '#shared/lucid/lucid_repository'

export default class MediaModerationEventRepository extends LucidRepository<
  typeof MediaModerationEvent
> {
  constructor() {
    super(MediaModerationEvent)
  }
}
