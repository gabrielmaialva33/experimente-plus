import type { HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'

import NotFoundException from '#exceptions/not_found_exception'

import AttachUserToOperationService from '#modules/users/services/attach_user_to_operation_service'
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

  async create({ inertia, tenant }: HttpContext) {
    const operations = await app.container.make(AttachUserToOperationService)

    return inertia.render('users/create', {
      operation: tenant ? await operations.operation(tenant.id) : null,
    })
  }

  /**
   * An account created here joins the operation in use as `member`, as
   * sign-up and invitation acceptance do: without that link it had no wallet
   * and could not be invited by an organization of the operation.
   */
  async store({ request, response, session, tenant }: HttpContext) {
    const payload = await request.validateUsing(createUserValidator, {
      data: request.body(),
    })
    const createUserService = await app.container.make(CreateUserService)
    const user = await createUserService.run(payload, { attachTenantId: tenant?.id })

    const operations = await app.container.make(AttachUserToOperationService)
    const operation = tenant ? await operations.operation(tenant.id) : null
    if (operation) {
      session.flash(
        'success',
        `Conta de ${user.full_name} criada e vinculada à operação ${operation.name} como membro.`
      )
    } else {
      session.flash(
        'warning',
        `Conta de ${user.full_name} criada sem operação: escolha uma operação ativa e vincule a conta na edição.`
      )
    }

    return response.redirect().toPath('/users')
  }

  async edit({ inertia, params, request, tenant }: HttpContext) {
    const { id: userId } = await request.validateUsing(userIdParamValidator, { data: params })
    const getUserService = await app.container.make(GetUserService)
    const user = await getUserService.run(userId)
    // A stale link gets the not-found page, not an edit screen over null —
    // web audit W28.
    if (!user) throw new NotFoundException('User not found')

    const operations = await app.container.make(AttachUserToOperationService)
    const operation = tenant ? await operations.status(user.id, tenant.id) : null

    // A Lucid model reaches the page as its internals ($attributes…), leaving the
    // form and the title empty ("Editar usuário: undefined"); send its JSON shape.
    return inertia.render('users/edit', { user: user.serialize(), operation })
  }

  /**
   * Links an existing account to the operation in use, for accounts created
   * here before new ones were linked automatically. Repeating it is harmless.
   */
  async attachOperation({ params, request, response, session, tenant }: HttpContext) {
    const { id: userId } = await request.validateUsing(userIdParamValidator, { data: params })
    if (!tenant) {
      session.flash('error', 'Escolha uma operação ativa antes de vincular a conta.')
      return response.redirect().toPath(`/users/${userId}/edit`)
    }

    const service = await app.container.make(AttachUserToOperationService)
    const result = await service.run(userId, tenant.id)
    session.flash(
      'success',
      result.created
        ? `Conta vinculada à operação ${result.operation} como membro.`
        : `A conta já estava vinculada à operação ${result.operation}.`
    )

    return response.redirect().toPath(`/users/${userId}/edit`)
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
