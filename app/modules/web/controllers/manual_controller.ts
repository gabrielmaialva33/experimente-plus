import type { HttpContext } from '@adonisjs/core/http'

export default class InertiaManualController {
  /**
   * The user manual. Its content lives with the page (`inertia/content/manual.ts`),
   * so it is public, the same for everyone and needs no props.
   */
  async show({ inertia }: HttpContext) {
    return inertia.render('manual/index', {})
  }
}
