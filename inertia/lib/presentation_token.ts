/**
 * Extracts the presentation token from what the partner read or typed.
 *
 * The rules are the mobile app's (`experimente-plus-app/src/wallet/presentation-token.ts`),
 * so a code the app accepts is accepted here and nothing else: the QR carries
 * the validation URL with the token in its query string, and a partner may also
 * paste that link or the bare token. Scanned content is never opened, followed
 * or shown: only the token is taken, and only from a well-formed HTTP(S) URL.
 * The server still decides whether the token is authentic, current and usable.
 */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/

export function extractPresentationToken(scanned: string): string | null {
  const value = scanned.trim()

  if (TOKEN_SHAPE.test(value)) {
    return value
  }

  try {
    const url = new URL(value)

    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return null
    }

    const token = url.searchParams.get('token')
    return token && TOKEN_SHAPE.test(token) ? token : null
  } catch {
    return null
  }
}
