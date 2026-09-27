import { inject } from '@adonisjs/core'

import FileRepository from '#modules/files/repositories/file_repository'

export type ListFilesOptions = {
  tenantId: number
  page?: number
  perPage?: number
}

export type FileListItem = {
  id: number
  client_name: string
  file_name: string
  file_size: number
  file_type: string
  file_category: string
  url: string
  owner: {
    id: number
    full_name: string
  }
  created_at: string | null
}

export type FileListResult = {
  meta: {
    total: number
    perPage: number
    currentPage: number
    lastPage: number
    firstPage: number
    nextPageUrl: string | null
    previousPageUrl: string | null
  }
  data: FileListItem[]
}

@inject()
export default class ListFilesService {
  constructor(private fileRepository: FileRepository) {}

  async run({ tenantId, page = 1, perPage = 20 }: ListFilesOptions): Promise<FileListResult> {
    const paginator = await this.fileRepository.paginateForTenant(
      tenantId,
      Math.max(1, page),
      Math.min(100, Math.max(1, perPage))
    )

    // Read the paginator itself, not getMeta(): the meta object follows the naming
    // strategy (per_page, last_page…), so the camelCase reads were undefined and the
    // Arquivos page lost its pagination — 20 of 197 files, and no way to the rest.
    return {
      meta: {
        total: paginator.total,
        perPage: paginator.perPage,
        currentPage: paginator.currentPage,
        lastPage: paginator.lastPage,
        firstPage: paginator.firstPage,
        nextPageUrl: paginator.getNextPageUrl(),
        previousPageUrl: paginator.getPreviousPageUrl(),
      },
      data: paginator.all().map((file) => ({
        id: file.id,
        client_name: file.client_name,
        file_name: file.file_name,
        file_size: file.file_size,
        file_type: file.file_type,
        file_category: file.file_category,
        url: file.url,
        owner: {
          id: file.owner.id,
          full_name: file.owner.full_name,
        },
        created_at: file.created_at.toISO(),
      })),
    }
  }
}
