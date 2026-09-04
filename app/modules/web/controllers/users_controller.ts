import type { HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'

import CreateUserService from '#modules/users/services/create_user_service'
import EditUserService from '#modules/users/services/edit_user_service'
import DeleteUserService from '#modules/users/services/delete_user_service'
import GetUserService from '#modules/users/services/get_user_service'
import PaginateUserService from '#modules/users/services/paginate_user_service'

import {
  createUserValidator,
  editUserValidator,
  listUsersValidator,
  userIdParamValidator,
} from '#modules/users/validators/users_validator'

export default class InertiaUsersController {
  async index({ inertia, request }: HttpContext) {
    const {
      page = 1,
      per_page: perPage = 10,
      search,
      sort_by: sortBy = 'created_at',
      order: direction = 'desc',
    } = await request.validateUsing(listUsersValidator, { data: request.qs() })

    const paginateUserService = await app.container.make(PaginateUserService)
    const users = await paginateUserService.run({
      page,
      perPage,
      search,
      sortBy,
      direction,
    })

    return inertia.render('users/index', {
      users: users.toJSON(),
      search: search || '',
      sortBy,
      direction,
    })
  }

  async create({ inertia }: HttpContext) {
    return inertia.render('users/create', {})
  }

  async store({ request, response }: HttpContext) {
    const payload = await request.validateUsing(createUserValidator, {
      data: request.body(),
    })
    const createUserService = await app.container.make(CreateUserService)
    await createUserService.run(payload)

    return response.redirect().toPath('/users')
  }

  async edit({ inertia, params, request }: HttpContext) {
    const { id: userId } = await request.validateUsing(userIdParamValidator, { data: params })
    const getUserService = await app.container.make(GetUserService)
    const user = await getUserService.run(userId)

    return inertia.render('users/edit', { user })
  }

  async update({ auth, request, response, params }: HttpContext) {
    const actor = auth.getUserOrFail()
    const { id: userId } = await request.validateUsing(userIdParamValidator, { data: params })
    const payload = await request.validateUsing(editUserValidator, {
      data: request.body(),
      meta: {
        userId,
      },
    })
    const editUserService = await app.container.make(EditUserService)
    await editUserService.run(actor.id, userId, payload)

    return response.redirect().toPath('/users')
  }

  async destroy({ auth, request, response, params }: HttpContext) {
    const actor = auth.getUserOrFail()
    const { id: userId } = await request.validateUsing(userIdParamValidator, { data: params })
    const deleteUserService = await app.container.make(DeleteUserService)
    await deleteUserService.run(actor.id, userId)

    return response.redirect().toPath('/users')
  }
}
