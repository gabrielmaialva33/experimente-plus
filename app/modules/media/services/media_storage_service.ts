import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import type { MultipartFile } from '@adonisjs/core/types/bodyparser'
import drive from '@adonisjs/drive/services/main'

import env from '#start/env'

@inject()
export default class MediaStorageService {
  async store(file: MultipartFile, key: string): Promise<{ key: string; url: string }> {
    const context = HttpContext.getOrFail()
    const disk = drive.use()

    await file.moveToDisk(key)

    const relativeUrl = await disk.getUrl(key)
    const url =
      env.get('DRIVE_DISK') === 'fs'
        ? `${context.request.protocol()}://${context.request.host()}${relativeUrl}`
        : relativeUrl

    return { key, url }
  }

  async delete(key: string): Promise<void> {
    await drive.use().delete(key)
  }
}
