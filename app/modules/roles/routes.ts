import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import IPermission from '#modules/permissions/interfaces/permission_interface'
import IRole from '#modules/roles/interfaces/role_interface'
import { adminThrottle } from '#start/limiter'
import { privateResponseHeadersMiddleware } from '#shared/utils/private_response_headers'

const RolesController = () => import('#modules/roles/controllers/roles_controller')

router
  .group(() => {
    router
      .get('/', [RolesController, 'list'])
      .use(
        middleware.permission({
          permissions: `${IPermission.Resources.ROLES}.${IPermission.Actions.LIST}`,
        })
      )
      .as('role.list')
    router
      .put('/attach', [RolesController, 'attach'])
      .use(
        middleware.permission({
          permissions: `${IPermission.Resources.ROLES}.${IPermission.Actions.ASSIGN}`,
        })
      )
      .as('role.attach')
  })
  .use([
    middleware.auth(),
    privateResponseHeadersMiddleware,
    adminThrottle,
    middleware.acl({
      role_slugs: [IRole.Slugs.ROOT, IRole.Slugs.ADMIN],
    }),
  ])
  .prefix('/api/v1/admin/roles')
