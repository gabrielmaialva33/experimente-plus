/**
 * Pages a sign-in, sign-up or account switch may return to. The list is
 * closed on purpose: `next` comes from the visitor, so anything outside it is
 * ignored and the server-authorized landing applies, never an open redirect.
 */
export const ORGANIZATION_INVITATION_ACCEPT_PATH = '/organization-invitations/accept'

const RETURN_PATHS = [ORGANIZATION_INVITATION_ACCEPT_PATH] as const

export type ReturnPath = (typeof RETURN_PATHS)[number]

export function safeReturnPath(value: unknown): ReturnPath | null {
  return RETURN_PATHS.find((path) => path === value) ?? null
}
