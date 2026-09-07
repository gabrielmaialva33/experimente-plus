import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { canonicalJsonBody } from '#modules/auth/utils/canonical_json_body'

/** Reject ambiguous/form transport before accepting tokenized payment input. */
export default async function purchaseTransport({ request, response }: HttpContext, next: NextFn) {
  if (request.method() === 'POST' && !canonicalJsonBody(request))
    return response.unprocessableEntity({
      status: 422,
      message: 'A canonical JSON object is required',
    })
  return next()
}
