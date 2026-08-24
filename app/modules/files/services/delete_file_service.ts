import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import drive from '@adonisjs/drive/services/main'
import db from '@adonisjs/lucid/services/db'

import BadRequestException from '#exceptions/bad_request_exception'
import NotFoundException from '#exceptions/not_found_exception'
import FileRepository from '#modules/files/repositories/file_repository'

@inject()
export default class DeleteFileService {
  constructor(private fileRepository: FileRepository) {}

  async run(fileId: number, tenantId: number): Promise<void> {
    const file = await this.fileRepository.findByIdForTenant(fileId, tenantId)
    if (!file) {
      throw new NotFoundException('File not found in the active workspace')
    }

    try {
      await db.transaction(async (client) => {
        file.useTransaction(client)
        await file.delete()
      })
    } catch (error) {
      const databaseError = error as { code?: string; cause?: { code?: string } }
      const code = databaseError.code ?? databaseError.cause?.code

      if (code === '23503') {
        throw new BadRequestException(
          'File cannot be deleted while it is referenced by another resource'
        )
      }

      throw error
    }

    try {
      await drive.use().delete(file.file_name)
    } catch (error) {
      logger.error(
        { err: error, file_id: file.id, storage_key: file.file_name },
        'Failed to remove an unreferenced file object from storage'
      )
    }
  }
}
