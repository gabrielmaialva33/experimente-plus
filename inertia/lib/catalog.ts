export type JsonRecord = Record<string, unknown>

export function asRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : null
}

export function recordValue(record: JsonRecord | null, ...keys: string[]): JsonRecord | null {
  if (!record) return null

  for (const key of keys) {
    const candidate = asRecord(record[key])
    if (candidate) return candidate
  }

  return null
}

export function collection(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) {
    return value.map(asRecord).filter((item): item is JsonRecord => item !== null)
  }

  const record = asRecord(value)
  if (!record) return []

  for (const key of ['data', 'items', 'results', 'cities', 'categories', 'establishments']) {
    const candidate = record[key]
    if (Array.isArray(candidate)) {
      return candidate.map(asRecord).filter((item): item is JsonRecord => item !== null)
    }
  }

  return []
}

export function firstRecord(value: unknown): JsonRecord | null {
  const record = asRecord(value)
  if (!record) return null

  for (const key of ['data', 'item', 'result', 'establishment']) {
    const candidate = asRecord(record[key])
    if (candidate) return candidate
  }

  return record
}

export function stringValue(record: JsonRecord | null, ...keys: string[]): string | null {
  if (!record) return null

  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }

  return null
}

export function numberValue(record: JsonRecord | null, ...keys: string[]): number | null {
  if (!record) return null

  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
      return Number(value)
    }
  }

  return null
}

export function booleanValue(record: JsonRecord | null, ...keys: string[]): boolean | null {
  if (!record) return null

  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'boolean') return value
  }

  return null
}

export function slugLabel(slug: string | null | undefined): string {
  if (!slug) return ''

  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toLocaleUpperCase('pt-BR') + part.slice(1))
    .join(' ')
}

export function coverUrl(record: JsonRecord | null): string | null {
  if (!record) return null

  const direct = stringValue(record, 'cover_url', 'image_url', 'url')
  if (direct) return direct

  const cover = recordValue(record, 'cover', 'cover_image', 'media')
  const asset = recordValue(cover, 'asset')

  return stringValue(asset, 'url') ?? stringValue(cover, 'url')
}

export function metadata(value: unknown): JsonRecord | null {
  const record = asRecord(value)
  return recordValue(record, 'meta', 'pagination')
}
