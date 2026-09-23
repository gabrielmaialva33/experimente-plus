import { createHmac } from 'node:crypto'

import env from '#start/env'

/**
 * The only form in which an anonymous reporter is ever recorded — ADR-0027
 * scenarios 13 and 14.
 *
 * Keyed, never a bare digest. A plain SHA-256 of an IPv4 address is reversible
 * by trying all four billion of them, which makes it a disguise, not a hash.
 * The key is `ANALYTICS_HASH_SECRET`, the secret this product already keeps for
 * pseudonymising visitors, under a namespace of its own so that no value here
 * ever equals a value in analytics. Reusing it rather than adding a secret is
 * deliberate: every environment already has it, so the route cannot fail to
 * boot on a server whose `.env` predates this code.
 *
 * The target is part of what is hashed. The same person reporting two
 * different things produces two unrelated values, so the table can recognise a
 * repeat on one target without being able to link a person's reports to each
 * other.
 */
export default class ReportOriginHasher {
  private readonly secret = env.get('ANALYTICS_HASH_SECRET')

  hash(
    kind: 'ip' | 'token',
    tenantId: number,
    targetType: string,
    targetId: number,
    value: string
  ): string {
    return createHmac('sha256', this.secret)
      .update(
        ['content-report-origin:v1', kind, tenantId, targetType, targetId, value].join('\u0000')
      )
      .digest('hex')
  }
}
