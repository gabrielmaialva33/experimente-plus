import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import type { MultipartFile } from '@adonisjs/core/types/bodyparser'
import drive from '@adonisjs/drive/services/main'
import { storedFileDisk } from '#shared/utils/storage_disk'
import env from '#start/env'

@inject()
export default class MediaStorageService {
  async store(file: MultipartFile, key: string): Promise<{ key: string; url: string }> {
    try {
      const disk = drive.use()
      const relativeUrl = await disk.getUrl(key)
      let url = relativeUrl
      if (env.get('DRIVE_DISK') === 'fs') {
        const { request } = HttpContext.getOrFail()
        url = `${request.protocol()}://${request.host()}${relativeUrl}`
      }
      await file.moveToDisk(key)
      return { key, url }
    } catch {
      // SDK errors can contain signed URLs and request headers; do not propagate them to logging.
      throw new Error('Media storage upload failed')
    }
  }

  async delete(key: string, storedUrl?: string): Promise<void> {
    try {
      const disk = storedUrl
        ? drive.use(storedFileDisk(key, storedUrl, env.get('R2_PUBLIC_BASE_URL')))
        : drive.use()
      await disk.delete(key)
    } catch {
      throw new Error('Media storage deletion failed')
    }
  }
}
