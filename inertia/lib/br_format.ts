/**
 * Brazilian display formats for values the server keeps as digits (web audit W67).
 *
 * They only format for reading and typing: the server still normalizes what it
 * receives, so a value that does not match a known shape is returned as typed
 * rather than guessed into one.
 */

const onlyDigits = (value: string) => value.replace(/\D/g, '')

/** (43) 3542-1201 for landlines, (43) 99982-4100 for mobiles; a leading 55 is dropped. */
export function formatPhoneBR(value: string | null | undefined): string {
  if (!value) return ''
  let digits = onlyDigits(value)
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    digits = digits.slice(2)
  }
  if (digits.length === 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  if (digits.length === 11)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  return value
}

/** 86020-030. */
export function formatCep(value: string | null | undefined): string {
  if (!value) return ''
  const digits = onlyDigits(value)
  return digits.length === 8 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : value
}

/** 12.345.678/0001-95. */
export function formatCnpj(value: string | null | undefined): string {
  if (!value) return ''
  const digits = onlyDigits(value)
  return digits.length === 14
    ? `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`
    : value
}
