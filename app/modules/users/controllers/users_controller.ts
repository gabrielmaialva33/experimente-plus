import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'

import PaginateUserService from '#modules/users/services/paginate_user_service'
import GetUserService from '#modules/users/services/get_user_service'
import CreateUserService from '#modules/users/services/create_user_service'
import EditUserService from '#modules/users/services/edit_user_service'
import DeleteUserService from '#modules/users/services/delete_user_service'

import {
  createUserValidator,
  editUserValidator,
  listUsersValidator,
  userIdParamValidator,
} from '#modules/users/validators/users_validator'

@inject()
export default class UsersController {
  async paginate({ request, response }: HttpContext) {
    const {
      page = 1,
      per_page: perPage = 10,
      sort_by: sortBy = 'id',
      order: direction = 'asc',
      search,
    } = await request.validateUsing(listUsersValidator, { data: request.qs() })

    const service = await app.container.make(PaginateUserService)
    const users = await service.run({
      page,
      perPage,
      sortBy,
      direction,
      search,
    })

    return response.json(users)
  }

  async get({ params, request, response }: HttpContext) {
    const { id: userId } = await request.validateUsing(userIdParamValidator, { data: params })

    const service = await app.container.make(GetUserService)

    const user = await service.run(userId)
    if (!user) {
      return response.status(404).json({
        message: 'User not found',
      })
    }
    return response.json(user)
  }

  async create({ request, response }: HttpContext) {
    const payload = await request.validateUsing(createUserValidator, {
      data: request.body(),
    })

    const service = await app.container.make(CreateUserService)

    const user = await service.run(payload)
    return response.created(user)
  }

  async update({ auth, params, request, response }: HttpContext) {
    const actor = auth.getUserOrFail()
    const { id: userId } = await request.validateUsing(userIdParamValidator, { data: params })
    const payload = await request.validateUsing(editUserValidator, {
      data: request.body(),
      meta: { userId },
    })

    const service = await app.container.make(EditUserService)

    const user = await service.run(actor.id, userId, payload)
    return response.json(user)
  }

  async delete({ auth, params, request, response }: HttpContext) {
    const actor = auth.getUserOrFail()
    const { id: userId } = await request.validateUsing(userIdParamValidator, { data: params })

    const service = await app.container.make(DeleteUserService)
    await service.run(actor.id, userId)

    return response.noContent()
  }
}
