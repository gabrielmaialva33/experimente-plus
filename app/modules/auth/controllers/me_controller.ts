import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'
import GetUserService from '#modules/users/services/get_user_service'
import GetUserPermissionsService from '#modules/users/services/get_user_permissions_service'
import GetUserRolesService from '#modules/users/services/get_user_roles_service'
import DeleteOwnAccountService from '#modules/users/services/delete_own_account_service'
import CurrentUserContextService, {
  projectCurrentUser,
} from '#modules/users/services/current_user_context_service'
import UpdateProfileService from '#modules/users/services/update_profile_service'
import { deleteOwnAccountValidator } from '#modules/users/validators/account_validator'
import { updateProfileValidator } from '#modules/users/validators/profile_validator'
import { setPrivateResponseHeaders } from '#shared/utils/private_response_headers'

@inject()
export default class MeController {
  constructor(
    private deleteOwnAccountService: DeleteOwnAccountService,
    private currentUserContextService: CurrentUserContextService,
    private updateProfileService: UpdateProfileService
  ) {}
  /**
   * Get current user profile
   */
  async profile({ auth, response }: HttpContext) {
    setPrivateResponseHeaders(response)
    const user = auth.user!
    const service = await app.container.make(GetUserService)

    const userWithRoles = await service.run(user.id)
    return response.json(userWithRoles)
  }

  /**
   * Get current user permissions
   */
  async permissions({ auth, response }: HttpContext) {
    setPrivateResponseHeaders(response)
    const user = auth.user!
    const service = await app.container.make(GetUserPermissionsService)

    const permissions = await service.run(user.id)
    return response.json(permissions)
  }

  /**
   * Get current user roles
   */
  async roles({ auth, response }: HttpContext) {
    setPrivateResponseHeaders(response)
    const user = auth.user!
    const service = await app.container.make(GetUserRolesService)

    const roles = await service.run(user.id)
    return response.json(roles)
  }

  async context({ auth, tenant, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const context = await this.currentUserContextService.run(user, tenant!.id)

    return response.ok(context)
  }

  async update({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const payload = await request.validateUsing(updateProfileValidator, {
      meta: { userId: user.id },
    })
    const updatedUser = await this.updateProfileService.run(user.id, payload)

    return response.ok({ user: projectCurrentUser(updatedUser) })
  }

  async delete({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const { current_password: currentPassword, confirmation } =
      await request.validateUsing(deleteOwnAccountValidator)

    await this.deleteOwnAccountService.run(user.id, { currentPassword, confirmation })

    return response.noContent()
  }
}
