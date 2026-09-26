import { Link } from '@inertiajs/react'
import type { ReactNode } from 'react'

import { PublicShell } from '~/components/public/public_shell'

interface LegalSection {
  title: string
  content: ReactNode
}

interface LegalPageProps {
  title: string
  description: string
  sections: readonly LegalSection[]
  relatedHref: string
  relatedLabel: string
}

export function LegalPage({
  title,
  description,
  sections,
  relatedHref,
  relatedLabel,
}: LegalPageProps) {
  return (
    <PublicShell title={title} description={description}>
      <article className="app-container max-w-4xl py-10 sm:py-14">
        <header className="border-b border-border-subtle pb-7">
          <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-primary-accent">
            Versão do piloto · 3 de setembro de 2026
          </p>
          <h1 className="mt-2 text-balance font-display text-[1.875rem] font-extrabold leading-[1.1] tracking-[-0.02em] sm:text-[2.5rem]">
            {title}
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">{description}</p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Este texto descreve o funcionamento atual do produto e deve ser revisto antes de uma
            operação pública em escala.
          </p>
        </header>

        <div className="divide-y divide-border-subtle">
          {sections.map((section, index) => (
            <section
              key={section.title}
              aria-labelledby={`legal-section-${index}`}
              className="py-7"
            >
              <h2
                id={`legal-section-${index}`}
                className="font-display text-[1.3125rem] font-extrabold leading-tight tracking-[-0.01em]"
              >
                {section.title}
              </h2>
              <div className="mt-3 space-y-3 text-sm leading-7 text-muted-foreground sm:text-base">
                {section.content}
              </div>
            </section>
          ))}
        </div>

        <nav
          aria-label="Documentos relacionados"
          className="flex flex-wrap gap-3 border-t border-border-subtle pt-7"
        >
          <Link
            href={relatedHref}
            className="inline-flex min-h-11 items-center rounded-full border border-border bg-card px-5 text-sm font-semibold text-foreground outline-none transition-colors hover:border-primary hover:text-primary-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
          >
            {relatedLabel}
          </Link>
          <Link
            href="/register"
            className="inline-flex min-h-11 items-center rounded-full border border-border bg-card px-5 text-sm font-semibold text-foreground outline-none transition-colors hover:border-primary hover:text-primary-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
          >
            Voltar ao cadastro
          </Link>
        </nav>
      </article>
    </PublicShell>
  )
}
