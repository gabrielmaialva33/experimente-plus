import { ArrowUp, ChevronDown, Download, ListTree, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { ManualSearch } from '~/components/manual/manual_search'
import { ManualSection } from '~/components/manual/manual_section'
import { ManualToc } from '~/components/manual/manual_toc'
import { PublicShell } from '~/components/public'
import { Button } from '~/components/ui/button'
import { MANUAL_PDF_PATH } from '~/config/help'
import {
  MANUAL_CHAPTERS,
  MANUAL_START_CARDS,
  MANUAL_UPDATED_AT,
  manualAnchors,
} from '~/content/manual'

/** The "Por onde começar" block, where each chapter's "Voltar ao índice" leads. */
export const MANUAL_INDEX_ID = 'indice'

/**
 * Printing (and the PDF built from it) keeps only the manual: the site's header,
 * footer and phone navigation belong to the shell, so they are hidden from here.
 */
const PRINT_CSS = `
@media print {
  :root { --background: oklch(1 0 0); }
  [data-public-shell] > :not(main) { display: none !important; }
  [data-public-shell] { padding-bottom: 0 !important; }
  html { scroll-behavior: auto; }
}
`

/** "2026-09-27" as "27 de setembro de 2026", the same day in any zone. */
function longDate(isoDate: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(`${isoDate}T12:00:00Z`)
  )
}

/**
 * The section being read: the first section crossing the upper part of the screen,
 * or its chapter while the reader is on the chapter's opening.
 */
function useReadingPosition(ids: readonly string[], chapterIds: ReadonlySet<string>) {
  const [active, setActive] = useState<string | null>(null)

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null)
    const visible = new Map<string, boolean>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) visible.set(entry.target.id, entry.isIntersecting)
        const inView = elements.filter((element) => visible.get(element.id))
        const current = inView.find((element) => !chapterIds.has(element.id)) ?? inView[0]
        if (current) setActive(current.id)
      },
      { rootMargin: '-96px 0px -60% 0px' }
    )
    for (const element of elements) observer.observe(element)
    return () => observer.disconnect()
  }, [ids, chapterIds])

  return active
}

const ANCHORS = manualAnchors()
const CHAPTER_IDS: ReadonlySet<string> = new Set(MANUAL_CHAPTERS.map((chapter) => chapter.id))

export default function ManualPage() {
  const active = useReadingPosition(ANCHORS, CHAPTER_IDS)
  const mobileToc = useRef<HTMLDetailsElement>(null)
  const closeMobileToc = () => {
    if (mobileToc.current) mobileToc.current.open = false
  }

  return (
    <PublicShell
      title="Manual de uso"
      description="Como usar o Experimente+: explorar lugares sem conta, usar benefícios pela carteira, cuidar do seu negócio no Portal e operar a plataforma."
    >
      <style>{PRINT_CSS}</style>

      <header className="border-b bg-background">
        <div className="app-container grid gap-8 py-10 sm:py-14 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)] lg:items-end">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-primary-accent sm:text-[0.8125rem]">
              Manual de uso
            </p>
            <h1 className="mt-3 max-w-3xl text-balance font-display text-[2.25rem] font-extrabold leading-[1.08] tracking-[-0.02em] sm:text-[3rem]">
              Como usar o Experimente+
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              Passo a passo para quem explora a região, para quem usa benefícios, para a equipe dos
              negócios parceiros e para a equipe do Experimente+. Escolha o seu perfil abaixo,
              busque uma tarefa ou leia do começo.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center print:hidden">
              <Button variant="outline" size="xl" shape="pill" asChild>
                <a href={MANUAL_PDF_PATH} download data-testid="manual-pdf">
                  <Download aria-hidden="true" /> Baixar manual em PDF
                </a>
              </Button>
              <p className="text-sm text-muted-foreground">
                Atualizado em {longDate(MANUAL_UPDATED_AT)}
              </p>
            </div>
            <p className="mt-4 hidden text-sm text-muted-foreground print:block">
              Atualizado em {longDate(MANUAL_UPDATED_AT)}
            </p>

            <div
              role="note"
              aria-labelledby="manual-beta-title"
              className="mt-8 flex max-w-3xl gap-3 rounded-card border border-warning/40 bg-warning-soft p-4 sm:p-5"
            >
              <TriangleAlert
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 text-warning-accent"
              />
              <div>
                <p
                  id="manual-beta-title"
                  className="font-display font-extrabold leading-tight text-foreground"
                >
                  Versão beta em homologação
                </p>
                <p className="mt-1.5 text-sm leading-6 sm:text-[0.9375rem]">
                  Os lugares, eventos, benefícios e pessoas que aparecem aqui são fictícios, de
                  demonstração. Os pagamentos são simulados: nada é cobrado. Telas e regras podem
                  mudar até a versão final.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-card border border-border-subtle bg-card p-5 sm:p-6 print:hidden">
            <ManualSearch chapters={MANUAL_CHAPTERS} />
          </div>
        </div>
      </header>

      <nav
        id={MANUAL_INDEX_ID}
        aria-labelledby="manual-start-title"
        className="app-container scroll-mt-24 pt-10 sm:pt-12"
      >
        <h2
          id="manual-start-title"
          className="font-display text-[1.3125rem] font-extrabold leading-tight tracking-[-0.01em]"
        >
          Por onde começar: qual é o seu perfil?
        </h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MANUAL_START_CARDS.map((card) => {
            const Icon = card.icon
            return (
              <li key={card.href} className="break-inside-avoid">
                <a
                  href={card.href}
                  className="flex h-full gap-4 rounded-card border border-border-subtle bg-card p-4 outline-none transition-colors hover:border-primary focus-visible:ring-2 focus-visible:ring-ring sm:p-5"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-accent">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-display text-base font-extrabold leading-tight">
                      {card.title}
                    </span>
                    <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                      {card.text}
                    </span>
                  </span>
                </a>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="app-container py-10 sm:py-14 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12 print:block print:py-6">
        <aside aria-label="Sumário" className="hidden lg:block print:hidden" data-manual-toc>
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pb-6 pr-1">
            <p className="mb-2 px-3 text-xs font-extrabold uppercase tracking-[0.1em] text-muted-foreground">
              Neste manual
            </p>
            <ManualToc chapters={MANUAL_CHAPTERS} activeId={active} />
          </div>
        </aside>

        <div className="min-w-0 max-w-3xl">
          <details
            ref={mobileToc}
            className="group mb-10 rounded-card border border-border-subtle bg-card lg:hidden print:hidden"
          >
            <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
              <ListTree aria-hidden="true" className="size-5 text-primary-accent" />
              Neste manual
              <ChevronDown
                aria-hidden="true"
                className="ms-auto size-4 transition-transform group-open:rotate-180"
              />
            </summary>
            <nav aria-label="Sumário" className="border-t border-border-subtle p-2">
              <ManualToc
                chapters={MANUAL_CHAPTERS}
                activeId={active}
                expanded
                onNavigate={closeMobileToc}
              />
            </nav>
          </details>

          {/* The PDF has no sidebar: a plain contents list opens it instead. */}
          <nav aria-label="Sumário para impressão" className="hidden print:block">
            <p className="font-display text-xl font-extrabold">Sumário</p>
            <ol className="mt-3 space-y-2 text-sm">
              {MANUAL_CHAPTERS.map((chapter, index) => (
                <li key={chapter.id}>
                  <span className="font-semibold">
                    {index + 1}. {chapter.title}
                  </span>
                  <span className="text-muted-foreground">
                    {' '}
                    — {chapter.sections.map((section) => section.title).join(' · ')}
                  </span>
                </li>
              ))}
            </ol>
          </nav>

          <div className="space-y-16">
            {MANUAL_CHAPTERS.map((chapter, chapterIndex) => {
              const Icon = chapter.icon
              return (
                <section
                  key={chapter.id}
                  id={chapter.id}
                  aria-labelledby={`${chapter.id}-titulo`}
                  className="scroll-mt-24 print:break-before-page"
                >
                  <div className="flex items-start gap-4 border-b border-border-subtle pb-5">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-accent">
                      <Icon aria-hidden="true" className="size-6" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-primary-accent">
                        Capítulo {chapterIndex + 1} · {chapter.audience}
                      </p>
                      <h2
                        id={`${chapter.id}-titulo`}
                        className="mt-1 text-balance font-display text-[1.75rem] font-extrabold leading-[1.15] tracking-[-0.02em] sm:text-[2rem]"
                      >
                        {chapter.title}
                      </h2>
                      <p className="mt-2 text-muted-foreground">{chapter.summary}</p>
                      <p className="mt-1 text-sm font-semibold">Para: {chapter.profiles}</p>
                    </div>
                  </div>

                  <div className="mt-8 space-y-14">
                    {chapter.sections.map((section) => (
                      <ManualSection key={section.id} section={section} />
                    ))}
                  </div>

                  <p className="mt-10 print:hidden">
                    <a
                      href={`#${MANUAL_INDEX_ID}`}
                      className="inline-flex min-h-11 items-center gap-2 rounded-sm text-sm font-semibold text-primary-accent outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <ArrowUp aria-hidden="true" className="size-4" /> Voltar ao índice
                    </a>
                  </p>
                </section>
              )
            })}
          </div>

          <footer className="mt-16 border-t border-border-subtle pt-6 text-sm leading-6 text-muted-foreground">
            <p>
              Este manual acompanha a versão beta do Experimente+ e foi feito a partir do próprio
              site e do app, com dados de demonstração. Encontrou algo diferente na tela? Conte à
              equipe do Experimente+ (no Portal, pelo quadro Feedback do piloto).
            </p>
          </footer>
        </div>
      </div>
    </PublicShell>
  )
}
