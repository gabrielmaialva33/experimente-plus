import { ChevronDown } from 'lucide-react'
import { useState, type MouseEvent } from 'react'

import type { ManualChapter } from '~/content/manual'
import { cn } from '~/lib/utils'

interface ManualTocProps {
  chapters: readonly ManualChapter[]
  /** The chapter or section being read; its link is marked as the current location. */
  activeId?: string | null
  /**
   * `reading` (the wide sidebar) opens the chapter being read; `accordion` (phones)
   * lets the reader open and close each chapter, starting with the one being read.
   */
  mode?: 'reading' | 'accordion'
  /** Tells apart the ids of two accordions on the same page. */
  idPrefix?: string
  /** Called with the click and the anchor; it may take over the scroll. */
  onNavigate?: (event: MouseEvent<HTMLAnchorElement>, id: string) => void
}

function chapterOf(chapters: readonly ManualChapter[], id: string | null | undefined) {
  return chapters.find(
    (chapter) => chapter.id === id || chapter.sections.some((section) => section.id === id)
  )?.id
}

export function ManualToc({
  chapters,
  activeId,
  mode = 'reading',
  idPrefix = 'toc',
  onNavigate,
}: ManualTocProps) {
  const activeChapter = chapterOf(chapters, activeId)
  // The accordion remembers what the reader opened; the chapter being read starts open.
  const [opened, setOpened] = useState<ReadonlySet<string>>(
    () => new Set(activeChapter ? [activeChapter] : [])
  )
  const toggle = (id: string) =>
    setOpened((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <ol className="space-y-1 text-sm">
      {chapters.map((chapter) => {
        const open = mode === 'accordion' ? opened.has(chapter.id) : chapter.id === activeChapter
        const listId = `${idPrefix}-${chapter.id}`
        return (
          <li key={chapter.id}>
            <div className="flex items-center gap-1">
              <a
                href={`#${chapter.id}`}
                onClick={(event) => onNavigate?.(event, chapter.id)}
                aria-current={chapter.id === activeId ? 'location' : undefined}
                className={cn(
                  'flex min-h-11 min-w-0 flex-1 items-center rounded-lg px-3 font-semibold outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring',
                  chapter.id === activeChapter ? 'text-primary-accent' : 'text-foreground'
                )}
              >
                {chapter.title}
              </a>
              {mode === 'accordion' ? (
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={listId}
                  onClick={() => toggle(chapter.id)}
                  className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ChevronDown
                    aria-hidden="true"
                    className={cn(
                      'size-4 transition-transform motion-reduce:transition-none',
                      open && 'rotate-180'
                    )}
                  />
                  <span className="sr-only">
                    {open ? 'Fechar' : 'Abrir'} as seções de {chapter.title}
                  </span>
                </button>
              ) : null}
            </div>
            {open ? (
              <ol id={listId} className="mb-2 ml-3 border-l border-border-subtle pl-2">
                {chapter.sections.map((section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      onClick={(event) => onNavigate?.(event, section.id)}
                      aria-current={section.id === activeId ? 'location' : undefined}
                      className={cn(
                        'flex min-h-10 items-center rounded-md px-2.5 py-1 leading-5 outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring',
                        section.id === activeId
                          ? 'bg-accent font-semibold text-accent-foreground'
                          : 'text-muted-foreground'
                      )}
                    >
                      {section.title}
                    </a>
                  </li>
                ))}
              </ol>
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
