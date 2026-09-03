import type { HttpContext } from '@adonisjs/core/http'

/** Keeps pages and redirects that handle account credentials out of caches. */
export function preventCredentialResponseCaching({ response }: HttpContext): void {
  response.header('Cache-Control', 'private, no-store')
}
