import type { HttpContext } from '@adonisjs/core/http'

import { robotsTxt, searchIndexingAllowed } from '#shared/utils/search_indexing'
import env from '#start/env'

export default class RobotsController {
  /**
   * Production opens public discovery and keeps crawlers out of the tracked
   * redirects, the API and the signed-in areas; every other deployment closes
   * the whole site. Public caching also drops the anonymous session cookies.
   */
  async show({ response }: HttpContext) {
    response.header('Content-Type', 'text/plain; charset=utf-8')
    response.header('Cache-Control', 'public, max-age=3600')

    return response.send(robotsTxt(searchIndexingAllowed(env.get('DEPLOYMENT_ENV'))))
  }
}
