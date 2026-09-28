import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import DeleteFileService from '#modules/files/services/delete_file_service'
import ListFilesService from '#modules/files/services/list_files_service'

@inject()
export default class InertiaFilesController {
  constructor(
    private listFiles: ListFilesService,
    private deleteFile: DeleteFileService
  ) {}

  async index({ auth, inertia, request, tenant }: HttpContext) {
    const files = await this.listFiles.run({
      tenantId: tenant!.id,
      viewer: auth.use('jwt').getUserOrFail(),
      page: Number(request.input('page', 1)),
      perPage: Number(request.input('per_page', 20)),
    })

    return inertia.render('files/index', { files })
  }

  async destroy({ params, response, tenant, session }: HttpContext) {
    await this.deleteFile.run(Number(params.id), tenant!.id)
    session.flash('success', 'Arquivo excluído.')

    return response.redirect().back()
  }
}
