import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

import File from '#modules/files/models/file'
import FileRepository from '#modules/files/repositories/file_repository'
import ListFilesService from '#modules/files/services/list_files_service'
import Tenant from '#modules/tenants/models/tenant'
import User from '#modules/users/models/user'

test.group('List files service', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  // The Arquivos page reads these fields to draw its pagination; they came back
  // null, so a workspace with more files than one page showed only the first.
  test('reports the page it returned and how many there are', async ({ assert }) => {
    const owner = await User.create({
      full_name: 'Paged Owner',
      email: 'paged-owner@example.com',
      username: 'paged-owner',
      password: 'password123',
    })
    const workspace = await Tenant.create({
      name: 'Paged Workspace',
      slug: 'paged-workspace',
      is_active: true,
    })
    for (const index of [1, 2, 3, 4, 5]) {
      await File.create({
        owner_id: owner.id,
        tenant_id: workspace.id,
        client_name: `file-${index}`,
        file_name: `uploads/paged-${index}.txt`,
        file_size: 64,
        file_type: 'text/plain',
        file_category: 'file',
        url: `/uploads/paged-${index}.txt`,
      })
    }

    const service = new ListFilesService(new FileRepository())
    const result = await service.run({ tenantId: workspace.id, page: 2, perPage: 2 })

    assert.lengthOf(result.data, 2)
    assert.deepInclude(result.meta, {
      total: 5,
      perPage: 2,
      currentPage: 2,
      lastPage: 3,
      firstPage: 1,
    })
    assert.isString(result.meta.nextPageUrl)
    assert.isString(result.meta.previousPageUrl)
  })
})
