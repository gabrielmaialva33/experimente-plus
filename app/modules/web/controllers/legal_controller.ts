import type { HttpContext } from '@adonisjs/core/http'

export default class InertiaLegalController {
  async terms({ inertia }: HttpContext) {
    return inertia.render('legal/terms', {})
  }

  async privacy({ inertia }: HttpContext) {
    return inertia.render('legal/privacy', {})
  }
}
