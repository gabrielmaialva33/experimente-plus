export function firstError(value: unknown): string | null {
  if (typeof value === 'string') return value

  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = firstError(item)
      if (nested) return nested
    }
  }

  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) {
      const nested = firstError(item)
      if (nested) return nested
    }
  }

  return null
}
