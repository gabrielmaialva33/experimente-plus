/**
 * Turning what a form holds into what an admin validator accepts.
 *
 * Inputs hold strings and checkboxes hold booleans. The validators behind the
 * backoffice screens want numbers, `null` for a cleared optional field, and the
 * absence of a key when the server should decide (a slug left blank is derived
 * from the name). Doing that conversion in one place is what keeps four
 * resources from each growing their own idea of what an empty field means.
 */
export type FieldType = 'text' | 'textarea' | 'number' | 'checkbox' | 'select'

export interface FieldSpec {
  name: string
  label: string
  type: FieldType
  /** Blank becomes `null` instead of being omitted. */
  nullable?: boolean
  /** Blank is omitted so the server derives it (slugs). */
  omitWhenBlank?: boolean
  /** The select's values are numeric identifiers. */
  numeric?: boolean
  options?: Array<{ value: string; label: string }>
  hint?: string
  required?: boolean
  step?: string
  /** Starting value for a new record. Checkboxes start unchecked unless said. */
  defaultValue?: string | boolean
}

export type FormValues = Record<string, string | boolean>

/** Starting values from a stored record, or blanks for a new one. */
export function initialValues(fields: FieldSpec[], record?: Record<string, unknown> | null) {
  const values: FormValues = {}
  for (const field of fields) {
    const stored = record ? record[field.name] : field.defaultValue
    if (field.type === 'checkbox') {
      values[field.name] = stored === true
    } else {
      values[field.name] = stored === null || stored === undefined ? '' : String(stored)
    }
  }
  return values
}

export function toPayload(fields: FieldSpec[], values: FormValues): Record<string, unknown> {
  const payload: Record<string, unknown> = {}

  for (const field of fields) {
    const value = values[field.name]

    if (field.type === 'checkbox') {
      payload[field.name] = value === true
      continue
    }

    const text = String(value ?? '').trim()
    if (text === '') {
      if (field.omitWhenBlank) continue
      if (field.nullable) payload[field.name] = null
      continue
    }

    if (field.type === 'number' || field.numeric) {
      const number = Number(text.replace(',', '.'))
      payload[field.name] = Number.isFinite(number) ? number : text
      continue
    }

    payload[field.name] = text
  }

  return payload
}
