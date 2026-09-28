import { inject } from '@adonisjs/core'

import NotFoundException from '#exceptions/not_found_exception'
import EstablishmentRepository from '#modules/establishments/repositories/establishment_repository'
import type IMedia from '#modules/media/interfaces/media_interface'
import EstablishmentRevisionMediaRepository from '#modules/media/repositories/establishment_revision_media_repository'
import MediaProjectionService from '#modules/media/services/media_projection_service'

@inject()
export default class PublicMediaProjectionService {
  constructor(
    private mediaRepository: EstablishmentRevisionMediaRepository,
    private projectionService: MediaProjectionService,
    private establishmentRepository: EstablishmentRepository
  ) {}

  async forEstablishment(establishmentId: number): Promise<{
    establishment_id: number
    revision_id: number
    media: IMedia.PublicProjection[]
  }> {
    const establishment = await this.establishmentRepository.findPublishedById(establishmentId)

    if (!establishment?.published_revision_id) {
      throw new NotFoundException('Published establishment not found')
    }

    const media = await this.mediaRepository.listApprovedForRevision(
      establishment.tenant_id,
      establishment.id,
      establishment.published_revision_id
    )

    return {
      establishment_id: establishment.id,
      revision_id: establishment.published_revision_id,
      media: media.map((item) => this.projectionService.public(item)),
    }
  }
}
