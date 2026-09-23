import type IReview from '#modules/reviews/interfaces/review_interface'

/**
 * The detectors of ADR-0031, as pure functions.
 *
 * Deterministic on purpose. A model would catch more and could not say why, and
 * a moderation rule that cannot say why it fired cannot be contested, tuned or
 * trusted by the person whose text it held. Every detector here returns the
 * piece of text that made it fire, already masked, and nothing it does depends
 * on a service being up.
 *
 * Each detector is written against the false positive it is most likely to
 * produce in ordinary Portuguese reviews: prices, dates, times, postal codes,
 * opening hours, abbreviations and the establishment's own name.
 */

export interface DetectorHit {
  rule: IReview.AutomaticRule
  /** Masked. Safe to show a moderator and to store. */
  evidence: string
}

/** Lowercase, without accents, so "Idiôta" and "idiota" are the same word. */
export function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

const TOP_LEVEL = [
  'com',
  'net',
  'org',
  'br',
  'io',
  'me',
  'app',
  'site',
  'shop',
  'store',
  'online',
  'link',
  'ly',
  'gg',
  'tv',
  'co',
  'info',
  'biz',
  'xyz',
].join('|')

const EXPLICIT_URL = /\bhttps?:\/\/[^\s<>"']+/i
const WWW_URL = /\bwww\.[a-z0-9-]+(?:\.[a-z0-9-]+)+[^\s<>"']*/i
// A bare domain needs a letter before the dot and a known top-level domain
// after it, which is what keeps "R$ 10.50", "Sr.Silva" and "2.5km" out.
const BARE_DOMAIN = new RegExp(
  `(?:^|[^a-z0-9@.])((?:[a-z0-9-]*[a-z][a-z0-9-]*\\.)+(?:${TOP_LEVEL})(?:\\.[a-z]{2})?)(?=$|[^a-z0-9-])`,
  'i'
)
// A social handle points traffic elsewhere just as a link does. It has to
// start the text or follow a space, which keeps e-mail addresses out.
const HANDLE = /(?:^|\s)@([a-z0-9_][a-z0-9_.]{2,29})\b/i

export function detectLink(text: string): DetectorHit | null {
  const explicit = text.match(EXPLICIT_URL) ?? text.match(WWW_URL)
  if (explicit) {
    const host = explicit[0].replace(/^https?:\/\//i, '').split(/[/?#]/)[0]
    return { rule: 'link', evidence: `link: ${host.toLowerCase()}` }
  }

  const withoutEmails = text.replace(EMAIL_GLOBAL, ' ')
  const bare = withoutEmails.match(BARE_DOMAIN)
  if (bare) return { rule: 'link', evidence: `link: ${bare[1].toLowerCase()}` }

  const handle = withoutEmails.match(HANDLE)
  if (handle) return { rule: 'link', evidence: `perfil: @${handle[1].toLowerCase()}` }

  return null
}

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/i
const EMAIL_GLOBAL = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  return `${local.slice(0, 1)}***@${domain.toLowerCase()}`
}

// Candidates: optional country code, optional area code in parentheses or
// not, then the number with its usual separators. Validation happens on the
// digits afterwards, where the false positives are easier to reason about.
const PHONE_CANDIDATE =
  /(?:\+?\s?55[\s.-]?)?(?:\(\s?\d{2}\s?\)|\b\d{2})?[\s.-]?\d{4,5}[\s.-]?\d{4}\b/g
// A mobile number without area code only counts with a separator, "99999-1234":
// a bare run of nine digits is as likely to be anything else.
const LOCAL_MOBILE = /(?:^|[^\d])(9\d{4}[\s.-]\d{4})(?!\d)/

function maskPhone(digits: string): string {
  return `telefone terminado em ${digits.slice(-2)}`
}

function isBrazilianPhone(digits: string): boolean {
  let number = digits
  if (number.length >= 12 && number.startsWith('55')) number = number.slice(2)
  if (number.length !== 10 && number.length !== 11) return false

  const areaFirst = Number(number[0])
  const areaSecond = Number(number[1])
  // Area codes run from 11 to 99 and never end in zero.
  if (areaFirst === 0 || areaSecond === 0) return false

  const subscriberFirst = Number(number[2])
  // Eleven digits is a mobile, which starts with 9; ten is a landline, which
  // starts with 2 to 5. Anything else is a number that only looks like a phone.
  return number.length === 11 ? subscriberFirst === 9 : subscriberFirst >= 2 && subscriberFirst <= 5
}

export function detectContact(text: string): DetectorHit | null {
  const email = text.match(EMAIL)
  if (email) return { rule: 'contact', evidence: `e-mail ${maskEmail(email[0])}` }

  for (const candidate of text.matchAll(PHONE_CANDIDATE)) {
    const digits = candidate[0].replace(/\D/g, '')
    if (isBrazilianPhone(digits)) return { rule: 'contact', evidence: maskPhone(digits) }
  }

  const local = text.match(LOCAL_MOBILE)
  if (local) return { rule: 'contact', evidence: maskPhone(local[1].replace(/\D/g, '')) }

  return null
}

function passesLuhn(digits: string): boolean {
  let sum = 0
  let double = false
  for (let index = digits.length - 1; index >= 0; index--) {
    let value = Number(digits[index])
    if (double) {
      value *= 2
      if (value > 9) value -= 9
    }
    sum += value
    double = !double
  }
  return sum % 10 === 0
}

function isValidCpf(digits: string): boolean {
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false
  const check = (length: number) => {
    let sum = 0
    for (let index = 0; index < length; index++) sum += Number(digits[index]) * (length + 1 - index)
    const rest = (sum * 10) % 11
    return rest === 10 ? 0 : rest
  }
  return check(9) === Number(digits[9]) && check(10) === Number(digits[10])
}

const CARD_CANDIDATE = /(?:\d[ -]?){12,18}\d/g
const PIX_WORD = /\bpix\b/i
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i
const CPF_CANDIDATE = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g

export function detectPaymentData(text: string): DetectorHit | null {
  for (const candidate of text.matchAll(CARD_CANDIDATE)) {
    const digits = candidate[0].replace(/\D/g, '')
    // Card networks issue numbers starting 3 to 6, and the check digit has to
    // hold. Together they keep order numbers and barcodes out.
    if (
      digits.length >= 13 &&
      digits.length <= 19 &&
      '3456'.includes(digits[0]) &&
      passesLuhn(digits)
    ) {
      return { rule: 'payment_data', evidence: `cartão terminado em ${digits.slice(-4)}` }
    }
  }

  // A Pix key only matters as payment data when the text is asking for a Pix.
  // E-mail and phone keys are already caught as contacts.
  if (PIX_WORD.test(text)) {
    if (UUID.test(text)) return { rule: 'payment_data', evidence: 'chave Pix aleatória' }
    for (const candidate of text.matchAll(CPF_CANDIDATE)) {
      if (isValidCpf(candidate[0].replace(/\D/g, ''))) {
        return { rule: 'payment_data', evidence: 'chave Pix (CPF)' }
      }
    }
  }

  return null
}

/**
 * The same text with card numbers reduced to their last four digits.
 *
 * A moderator has to read what was written to decide, and does not need a card
 * number to decide it. The moderation queue shows target text through this,
 * so a rule firing on payment data does not turn the queue into the place that
 * republishes it to every moderator.
 */
export function maskPaymentData(text: string): string {
  return text.replace(CARD_CANDIDATE, (candidate) => {
    const digits = candidate.replace(/\D/g, '')
    const isCard =
      digits.length >= 13 && digits.length <= 19 && '3456'.includes(digits[0]) && passesLuhn(digits)
    return isCard ? `•••• ${digits.slice(-4)}` : candidate
  })
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * The operation's own vocabulary, matched as whole words.
 *
 * Whole words because substrings are where blocklists embarrass themselves:
 * a blocked "cu" must not fire on "cuscuz", and "bosta" must not fire on
 * "bostaninha" nor, worse, on a street name.
 */
export function detectBlockedTerm(text: string, terms: readonly string[]): DetectorHit | null {
  const normalized = normalizeText(text)
  for (const raw of terms) {
    const term = normalizeText(raw).trim().replace(/\s+/g, ' ')
    if (!term) continue
    const pattern = new RegExp(
      `(?:^|[^a-z0-9])${escapeRegExp(term).replace(/ /g, '\\s+')}(?=$|[^a-z0-9])`
    )
    if (pattern.test(normalized))
      return { rule: 'blocked_term', evidence: `termo bloqueado: "${raw.trim()}"` }
  }
  return null
}

export function runDetectors(
  texts: Array<string | null | undefined>,
  blockedTerms: readonly string[]
): DetectorHit[] {
  const joined = texts.filter((text): text is string => Boolean(text && text.trim())).join('\n')
  if (!joined) return []

  const hits: DetectorHit[] = []
  for (const hit of [
    detectPaymentData(joined),
    detectContact(joined),
    detectLink(joined),
    detectBlockedTerm(joined, blockedTerms),
  ]) {
    if (hit) hits.push(hit)
  }
  return hits
}
