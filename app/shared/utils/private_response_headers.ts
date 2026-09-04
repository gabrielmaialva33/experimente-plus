import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export function setPrivateResponseHeaders(response: HttpContext['response']): void {
  response.header('Cache-Control', 'private, no-store')
  response.header('X-Robots-Tag', 'noindex, nofollow')
  response.header('Referrer-Policy', 'no-referrer')
}

export async function privateResponseHeadersMiddleware({ response }: HttpContext, next: NextFn) {
  setPrivateResponseHeaders(response)
  return next()
}
