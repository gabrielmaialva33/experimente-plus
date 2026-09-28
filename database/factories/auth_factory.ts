import factory from '@adonisjs/lucid/factories'
import { DateTime } from 'luxon'

import { throwawayDigest } from '#database/factories/support/throwaway'
import PasswordResetToken from '#modules/auth/models/password_reset_token'
import RefreshToken from '#modules/auth/models/refresh_token'
import { REFRESH_TOKEN_TTL_SECONDS } from '#shared/jwt/constants'
import env from '#start/env'

/**
 * Stored credentials. The table keeps only a keyed digest of each token, and
 * these factories store the digest of a throwaway value: the rows exist,
 * expire and are revoked like real ones, but no token presents them. Tests
 * of the exchange itself go through `JwtAuthTokensService` and
 * `PasswordResetTokenService`, which hand back the token they issue.
 */
export const RefreshTokenFactory = factory
  .define(RefreshToken, () => ({
    user_id: 1,
    tenant_id: null,
    token_hash: throwawayDigest(),
    expires_at: DateTime.now().plus({ seconds: REFRESH_TOKEN_TTL_SECONDS }),
    revoked_at: null,
    rotated_from_id: null,
  }))
  .state('revoked', (token) => {
    token.revoked_at = DateTime.now()
  })
  .state('expired', (token) => {
    token.expires_at = DateTime.now().minus({ minutes: 5 })
  })
  .build()

/** A pending reset, valid for the configured window (60 minutes by default). */
export const PasswordResetTokenFactory = factory
  .define(PasswordResetToken, () => ({
    user_id: 1,
    token_hash: throwawayDigest(),
    expires_at: DateTime.now().plus({ minutes: env.get('PASSWORD_RESET_TTL_MINUTES', 60) }),
    consumed_at: null,
  }))
  .state('consumed', (token) => {
    token.consumed_at = DateTime.now()
  })
  .state('expired', (token) => {
    token.expires_at = DateTime.now().minus({ minutes: 5 })
  })
  .build()
