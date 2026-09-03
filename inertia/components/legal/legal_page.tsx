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
        <header className="border-b pb-7">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
            Versão do piloto · 3 de setembro de 2026
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">{description}</p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Este texto descreve o funcionamento atual do produto e deve ser revisto antes de uma
            operação pública em escala.
          </p>
        </header>

        <div className="divide-y">
          {sections.map((section, index) => (
            <section
              key={section.title}
              aria-labelledby={`legal-section-${index}`}
              className="py-7"
            >
              <h2 id={`legal-section-${index}`} className="text-xl font-semibold tracking-tight">
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
          className="flex flex-wrap gap-4 border-t pt-7 text-sm"
        >
          <Link href={relatedHref} className="font-medium text-primary hover:underline">
            {relatedLabel}
          </Link>
          <Link href="/register" className="font-medium text-primary hover:underline">
            Voltar ao cadastro
          </Link>
        </nav>
      </article>
    </PublicShell>
  )
}
