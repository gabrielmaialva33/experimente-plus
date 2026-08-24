import { createHmac, randomBytes } from 'node:crypto'
import { DateTime } from 'luxon'

import env from '#start/env'

export default class OrganizationInvitationTokenService {
  generate(): { token: string; tokenHash: string; expiresAt: DateTime } {
    const token = randomBytes(32).toString('base64url')
    return {
      token,
      tokenHash: this.hash(token),
      expiresAt: DateTime.now().plus({
        hours: env.get('ORGANIZATION_INVITATION_TTL_HOURS', 72),
      }),
    }
  }

  hash(token: string): string {
    return createHmac('sha256', this.getSecret()).update(token).digest('hex')
  }

  private getSecret(): string {
    const configured = env.get('ORGANIZATION_INVITATION_SECRET')?.trim()
    if (configured) {
      return configured
    }

    if (env.get('NODE_ENV') === 'production') {
      throw new Error('ORGANIZATION_INVITATION_SECRET is required in production')
    }

    return env.get('APP_KEY')
  }
}
