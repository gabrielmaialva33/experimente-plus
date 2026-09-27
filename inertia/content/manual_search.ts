import type { ManualBlock, ManualChapter, ManualSection } from '~/content/manual'

export interface ManualSearchResult {
  chapter: Pick<ManualChapter, 'id' | 'title'>
  section: Pick<ManualSection, 'id' | 'title'>
}

/** Lower case, no accents, marks removed: "Pronto" and "prónto" find each other. */
export function normalizeSearchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\*\*|\[|\]\([^)]*\)/g, ' ')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
    .trim()
}

function blockText(block: ManualBlock): string[] {
  switch (block.kind) {
    case 'paragraph':
      return [block.text]
    case 'steps':
    case 'list':
      return [...block.items]
    case 'note':
      return [block.title, block.text]
    case 'figures':
      return block.images.map((image) => image.caption ?? '')
    case 'table':
      return [...block.columns, ...block.rows.flat()]
  }
}

interface IndexedSection extends ManualSearchResult {
  /** The title weighs most, then the keywords, then the body text. */
  title: string
  keywords: string
  body: string
}

export function buildManualIndex(chapters: readonly ManualChapter[]): IndexedSection[] {
  return chapters.flatMap((chapter) =>
    chapter.sections.map((section) => ({
      chapter: { id: chapter.id, title: chapter.title },
      section: { id: section.id, title: section.title },
      title: normalizeSearchText(section.title),
      keywords: normalizeSearchText((section.keywords ?? []).join(' ')),
      body: normalizeSearchText(
        [
          chapter.title,
          section.intro,
          ...(section.needs ?? []),
          ...section.blocks.flatMap(blockText),
          section.result ?? '',
          ...(section.troubleshooting ?? []),
        ].join(' ')
      ),
    }))
  )
}

/**
 * Sections whose words contain every word of the query. Matches in the title or the
 * keywords come first; the order of the manual breaks ties.
 */
export function searchManual(
  index: readonly IndexedSection[],
  query: string,
  limit = 12
): ManualSearchResult[] {
  const words = normalizeSearchText(query)
    .split(' ')
    .filter((word) => word.length > 1)
  if (words.length === 0) return []

  return index
    .map((entry, position) => {
      const all = `${entry.title} ${entry.keywords} ${entry.body}`
      if (!words.every((word) => all.includes(word))) return null
      const score =
        words.filter((word) => entry.title.includes(word)).length * 2 +
        words.filter((word) => entry.keywords.includes(word)).length
      return { entry, position, score }
    })
    .filter((match): match is { entry: IndexedSection; position: number; score: number } =>
      Boolean(match)
    )
    .sort((left, right) => right.score - left.score || left.position - right.position)
    .slice(0, limit)
    .map(({ entry }) => ({ chapter: entry.chapter, section: entry.section }))
}
