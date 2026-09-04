import type { HttpContext } from '@adonisjs/core/http'

import { resolveBenefitPresentationOrigin } from '#shared/utils/benefit_presentation_origin'
import env from '#start/env'

export default class BenefitPresentationOriginService {
  resolve(request: HttpContext['request']): string {
    return resolveBenefitPresentationOrigin({
      environment: env.get('NODE_ENV'),
      configuredBaseUrl: env.get('BENEFIT_PRESENTATION_BASE_URL'),
      appUrl: env.get('APP_URL'),
      requestOrigin: `${request.protocol()}://${request.host()}`,
    })
  }
}
