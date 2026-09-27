import type { ManualChapter } from '~/content/manual'
import { cn } from '~/lib/utils'

interface ManualTocProps {
  chapters: readonly ManualChapter[]
  /** The chapter or section being read; its link is marked as the current location. */
  activeId?: string | null
  /** Shows the sections of every chapter, not only of the one being read. */
  expanded?: boolean
  onNavigate?: () => void
}

export function ManualToc({ chapters, activeId, expanded = false, onNavigate }: ManualTocProps) {
  const activeChapter = chapters.find(
    (chapter) =>
      chapter.id === activeId || chapter.sections.some((section) => section.id === activeId)
  )?.id

  return (
    <ol className="space-y-1 text-sm">
      {chapters.map((chapter) => {
        const open = expanded || chapter.id === activeChapter
        return (
          <li key={chapter.id}>
            <a
              href={`#${chapter.id}`}
              onClick={onNavigate}
              aria-current={chapter.id === activeId ? 'location' : undefined}
              className={cn(
                'flex min-h-10 items-center rounded-lg px-3 font-semibold outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring',
                chapter.id === activeChapter ? 'text-primary-accent' : 'text-foreground'
              )}
            >
              {chapter.title}
            </a>
            {open ? (
              <ol className="mb-2 ml-3 border-l border-border-subtle pl-2">
                {chapter.sections.map((section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      onClick={onNavigate}
                      aria-current={section.id === activeId ? 'location' : undefined}
                      className={cn(
                        'flex min-h-9 items-center rounded-md px-2.5 py-1 leading-5 outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring',
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
