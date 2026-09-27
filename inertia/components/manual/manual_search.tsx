import { Search, X } from 'lucide-react'
import { useId, useMemo, useState } from 'react'

import type { ManualChapter } from '~/content/manual'
import { buildManualIndex, searchManual } from '~/content/manual_search'

/**
 * Finds sections by their title, keywords and text, in the browser. Results are links
 * to the anchors, so the page itself never hides anything (and prints whole).
 */
export function ManualSearch({ chapters }: { chapters: readonly ManualChapter[] }) {
  const [query, setQuery] = useState('')
  const index = useMemo(() => buildManualIndex(chapters), [chapters])
  const results = useMemo(() => searchManual(index, query), [index, query])
  const inputId = useId()
  const resultsId = useId()
  const searching = query.trim().length > 1

  return (
    <div role="search" className="print:hidden">
      <label htmlFor={inputId} className="text-sm font-semibold">
        Buscar no manual
      </label>
      <div className="relative mt-2">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ex.: QR, senha, validar, avaliação"
          autoComplete="off"
          aria-controls={resultsId}
          className="h-12 w-full rounded-full border border-input bg-card pl-11 pr-12 text-base outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-search-cancel-button]:appearance-none"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Limpar a busca"
            className="absolute right-1.5 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        ) : null}
      </div>

      <div id={resultsId}>
        <p role="status" aria-live="polite" className="mt-2 text-sm text-muted-foreground">
          {searching
            ? results.length === 0
              ? 'Nenhuma parte do manual encontrada. Tente outra palavra.'
              : results.length === 1
                ? '1 parte do manual encontrada.'
                : `${results.length} partes do manual encontradas.`
            : ''}
        </p>
        {searching && results.length > 0 ? (
          <ul className="mt-2 divide-y divide-border-subtle overflow-hidden rounded-card border border-border-subtle bg-card">
            {results.map(({ chapter, section }) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="flex min-h-12 flex-col justify-center px-4 py-2 outline-none hover:bg-accent focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <span className="font-semibold leading-6">{section.title}</span>
                  <span className="text-xs text-muted-foreground">{chapter.title}</span>
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
