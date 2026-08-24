import { inject } from '@adonisjs/core'

import type IMedia from '#modules/media/interfaces/media_interface'
import type EstablishmentRevisionMedia from '#modules/media/models/establishment_revision_media'

@inject()
export default class MediaProjectionService {
  administrative(item: EstablishmentRevisionMedia): IMedia.AdministrativeProjection {
    return {
      id: item.id,
      establishment_id: item.establishment_id,
      revision_id: item.revision_id,
      purpose: item.purpose,
      is_cover: item.is_cover,
      sort_order: item.sort_order,
      alt_text: item.alt_text,
      caption: item.caption,
      moderation_status: item.moderation_status,
      review_notes: item.review_notes,
      reviewed_at: item.reviewed_at?.toISO() ?? null,
      created_at: item.created_at.toISO() ?? '',
      updated_at: item.updated_at.toISO() ?? '',
      asset: {
        id: item.asset.id,
        media_type: item.asset.media_type,
        file_extension: item.asset.file_extension,
        mime_type: item.asset.mime_type,
        width: item.asset.width,
        height: item.asset.height,
        checksum_sha256: item.asset.checksum_sha256,
        url: item.asset.file.url,
      },
    }
  }

  public(item: EstablishmentRevisionMedia): IMedia.PublicProjection {
    return {
      id: item.id,
      purpose: item.purpose,
      is_cover: item.is_cover,
      sort_order: item.sort_order,
      alt_text: item.alt_text!,
      caption: item.caption,
      asset: {
        id: item.asset.id,
        media_type: item.asset.media_type,
        file_extension: item.asset.file_extension,
        mime_type: item.asset.mime_type,
        width: item.asset.width,
        height: item.asset.height,
        url: item.asset.file.url,
      },
    }
  }
}
