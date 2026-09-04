import type { HttpRequest } from '@adonisjs/core/http'

import { canonicalJsonField } from '#modules/auth/utils/canonical_json_body'

/**
 * Reads the refresh credential exactly as it appeared on the wire. AdonisJS
 * normalizes request input before Vine receives it, which is appropriate for
 * names but not for opaque credentials where whitespace changes the secret.
 */
export function refreshTokenFromRawBody(request: HttpRequest): unknown {
  return canonicalJsonField(request, 'refresh_token')
}
