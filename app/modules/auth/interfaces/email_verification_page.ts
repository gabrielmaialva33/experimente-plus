/**
 * Inertia contract of the e-mail confirmation page (`/verificar-email`).
 * Type aliases, not interfaces, so Inertia accepts them as JSON props. The
 * token never travels in these props.
 */
export type EmailVerificationPageOutcome = 'confirmed' | 'already_confirmed' | 'expired' | 'invalid'

export type EmailVerificationPageProps = {
  /** What the link just did; null when the page is opened without a link. */
  outcome: EmailVerificationPageOutcome | null
  viewer: { signed_in: boolean; email: string | null; email_verified: boolean | null }
}
