export function normalizeSlug(value: string): string {
  return value
    .replace(/&/g, ' e ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function resolveUniqueSlug(
  source: string,
  isTaken: (slug: string) => Promise<boolean>
): Promise<string> {
  const baseSlug = normalizeSlug(source)

  if (!baseSlug) {
    throw new Error('A slug cannot be generated from an empty value')
  }

  if (!(await isTaken(baseSlug))) {
    return baseSlug
  }

  let suffix = 2
  while (await isTaken(`${baseSlug}-${suffix}`)) {
    suffix += 1
  }

  return `${baseSlug}-${suffix}`
}
