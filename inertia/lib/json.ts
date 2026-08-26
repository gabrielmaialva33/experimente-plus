/**
 * Permissive JSON prop helpers shared by the backoffice pages.
 *
 * These preserve the forgiving semantics the pages rely on: unknown shapes
 * degrade to `null`/`[]`/fallback strings instead of throwing, and `numeric`
 * keeps the loose `Number(value ?? 0)` coercion for non-number inputs.
 * `~/lib/establishment_editor` keeps its own stricter variants for the editor.
 */
export type JsonRecord = Record<string, unknown>

export function record(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : null
}

/**
 * Accepts either a plain array or a Lucid paginator payload (`{ data: [...] }`)
 * and returns only the object entries.
 */
export function collection(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is JsonRecord => record(item) !== null)
  }

  const data = record(value)?.data
  return Array.isArray(data) ? data.filter((item): item is JsonRecord => record(item) !== null) : []
}

export function text(source: JsonRecord | null, key: string, fallback = ''): string {
  const value = source?.[key]
  return typeof value === 'string' ? value : fallback
}

export function numeric(source: JsonRecord | null, key: string): number {
  const value = source?.[key]
  return typeof value === 'number' ? value : Number(value ?? 0)
}
