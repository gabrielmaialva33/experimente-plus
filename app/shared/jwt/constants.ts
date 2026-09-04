import type { SignOptions } from 'jsonwebtoken'

import env from '#start/env'

const defaultIdentifier = env
  .get('APP_NAME', 'Experimente+')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')

export const JWT_ISSUER = env.get('JWT_ISSUER', defaultIdentifier)
export const JWT_AUDIENCE = env.get('JWT_AUDIENCE', defaultIdentifier)
export const JWT_COOKIE_NAME = env.get('JWT_COOKIE_NAME', 'experimente-plus-token')

export const API_ACCESS_TOKEN_TTL_SECONDS = 15 * 60
export const API_ACCESS_TOKEN_EXPIRES_IN: SignOptions['expiresIn'] = API_ACCESS_TOKEN_TTL_SECONDS
export const WEB_ACCESS_TOKEN_EXPIRES_IN: SignOptions['expiresIn'] = '1h'

export const REFRESH_TOKEN_TTL_DAYS = 3

/** Stable client-facing lifetimes for every API token pair. */
export const REFRESH_TOKEN_TTL_SECONDS = REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60
