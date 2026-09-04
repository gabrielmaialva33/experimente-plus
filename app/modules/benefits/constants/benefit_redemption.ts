export const BENEFIT_PRESENTATION_TOKEN_MIN_LENGTH = 46
export const BENEFIT_PRESENTATION_TOKEN_MAX_LENGTH = 512
// Unpadded base64url tails constrain their unused bits; a SHA-256 signature is
// always 43 characters and therefore uses the canonical three-character tail.
export const BENEFIT_PRESENTATION_TOKEN_PATTERN =
  /^(?:(?:[A-Za-z0-9_-]{4})+|(?:[A-Za-z0-9_-]{4})*[A-Za-z0-9_-][AQgw]|(?:[A-Za-z0-9_-]{4})*[A-Za-z0-9_-]{2}[AEIMQUYcgkosw048])\.[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/

export const BENEFIT_RECEIPT_CODE_PATTERN = /^EXP-[0-9A-F]{16}$/
