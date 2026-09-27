import type { HttpContext } from '@adonisjs/core/http'

/**
 * The invitation link lives in the visitor's encrypted session, never in a
 * later URL: the acceptance page strips it from the address bar on arrival,
 * so it does not stay in history, in the Referer of the next request or in the
 * access logs of the requests that follow.
 */
const ORGANIZATION_INVITATION_SESSION_KEY = 'organization_invitation_token'

const MAX_TOKEN_LENGTH = 256

/** Keeps a well-formed token from the e-mailed link; anything else clears it. */
export function rememberInvitationToken(session: HttpContext['session'], value: unknown): void {
  const token = typeof value === 'string' ? value.trim() : ''
  if (token && token.length <= MAX_TOKEN_LENGTH) {
    session.put(ORGANIZATION_INVITATION_SESSION_KEY, token)
  } else {
    session.forget(ORGANIZATION_INVITATION_SESSION_KEY)
  }
}

export function pendingInvitationToken(session: HttpContext['session']): string | null {
  const token: unknown = session.get(ORGANIZATION_INVITATION_SESSION_KEY)
  return typeof token === 'string' && token.length > 0 ? token : null
}

export function forgetInvitationToken(session: HttpContext['session']): void {
  session.forget(ORGANIZATION_INVITATION_SESSION_KEY)
}
