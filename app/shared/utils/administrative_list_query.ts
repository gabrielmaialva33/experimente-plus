import vine from '@vinejs/vine'

export const ADMINISTRATIVE_LIST_MAX_PAGE_SIZE = 100

/** Query strings are textual, but pagination only accepts canonical decimal integers. */
export function strictPositiveQueryInteger(max: number) {
  return vine
    .number({ strict: true })
    .parse((value) => {
      if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value)) {
        return value
      }

      return Number(value)
    })
    .withoutDecimals()
    .min(1)
    .max(max)
}

/** Vine strips unknown keys by default; administrative APIs reject them explicitly. */
export const rejectUnknownQueryFields = vine.createRule<readonly string[]>(
  (value, allowedFields, field) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return
    }

    for (const key of Object.keys(value)) {
      if (!allowedFields.includes(key)) {
        field.report(
          'The {{ field }} query parameter is not supported',
          'unknownQueryParameter',
          field,
          { field: key }
        )
      }
    }
  },
  { name: 'knownQueryFields' }
)
