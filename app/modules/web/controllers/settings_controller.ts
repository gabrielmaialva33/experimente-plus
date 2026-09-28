import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import AuthEventService from '#modules/auth/services/auth_event_service'
import DeleteOwnAccountService from '#modules/users/services/delete_own_account_service'
import { deleteOwnAccountValidator } from '#modules/users/validators/account_validator'
import UpdateProfileService from '#modules/users/services/update_profile_service'
import { updateProfileValidator } from '#modules/users/validators/profile_validator'

@inject()
export default class InertiaSettingsController {
  constructor(
    private updateProfileService: UpdateProfileService,
    private deleteOwnAccountService: DeleteOwnAccountService
  ) {}

  async index({ inertia, auth }: HttpContext) {
    const user = auth.getUserOrFail()

    return inertia.render('settings/index', {
      profile: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        username: user.username,
      },
    })
  }

  async updateProfile({ request, response, session, auth }: HttpContext) {
    const user = auth.getUserOrFail()

    const payload = await request.validateUsing(updateProfileValidator, {
      data: request.body(),
      meta: { userId: user.id },
    })

    await this.updateProfileService.run(user.id, payload)

    session.flash('success', 'Dados pessoais atualizados.')

    return response.redirect().toPath('/settings')
  }

  async deleteAccount(ctx: HttpContext) {
    const { auth, request, response, session } = ctx
    const user = auth.getUserOrFail()

    try {
      const { current_password: currentPassword, confirmation } = await request.validateUsing(
        deleteOwnAccountValidator,
        {
          data: request.body(),
        }
      )
      await this.deleteOwnAccountService.run(user.id, { currentPassword, confirmation })
      auth.use('jwt').clearCookie()
      AuthEventService.emitLogout(user, ctx)

      return response.redirect().toPath('/')
    } catch (error) {
      if (error && typeof error === 'object' && 'messages' in error) {
        throw error
      }

      session.flash('errors', {
        general: error instanceof Error ? error.message : 'Não foi possível excluir a conta.',
      })
      return response.redirect().back()
    }
  }
}
