import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { apiThrottle } from '#start/limiter'
import IPermission from '#modules/permissions/interfaces/permission_interface'
import { privateResponseHeadersMiddleware } from '#shared/utils/private_response_headers'

const UsersController = () => import('#modules/users/controllers/users_controller')

router
  .group(() => {
    router
      .get('/', [UsersController, 'paginate'])
      .use(
        middleware.permission({
          permissions: `${IPermission.Resources.USERS}.${IPermission.Actions.LIST}`,
        })
      )
      .as('user.paginate')

    router
      .get('/:id', [UsersController, 'get'])
      .where('id', /^[0-9]+$/)
      .use(
        middleware.permission({
          permissions: `${IPermission.Resources.USERS}.${IPermission.Actions.READ}`,
          resourceIdParam: 'id',
        })
      )
      .as('user.get')

    router
      .post('/', [UsersController, 'create'])
      .use(
        middleware.permission({
          permissions: `${IPermission.Resources.USERS}.${IPermission.Actions.CREATE}`,
        })
      )
      .as('user.create')

    router
      .put('/:id', [UsersController, 'update'])
      .where('id', /^[0-9]+$/)
      .use(
        middleware.permission({
          permissions: `${IPermission.Resources.USERS}.${IPermission.Actions.UPDATE}`,
          resourceIdParam: 'id',
        })
      )
      .as('user.update')

    router
      .delete('/:id', [UsersController, 'delete'])
      .where('id', /^[0-9]+$/)
      .use(
        middleware.permission({
          permissions: `${IPermission.Resources.USERS}.${IPermission.Actions.DELETE}`,
          resourceIdParam: 'id',
        })
      )
      .as('user.delete')
  })
  .use([middleware.auth(), privateResponseHeadersMiddleware, apiThrottle])
  .prefix('/api/v1/users')
