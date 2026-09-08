import { Link } from '@inertiajs/react'
import { ChevronRight, Compass, MapPin } from 'lucide-react'
import type { ReactNode } from 'react'

import { ChoiceIndicator } from '~/components/ui/choice'

import { PublicShell } from '~/components/public'
import { cn } from '~/lib/utils'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface CatalogShellProps {
  title: string
  description: string
  eyebrow?: string
  citySlug?: string | null
  activeSection?: 'places' | 'categories'
  breadcrumbs?: BreadcrumbItem[]
  actions?: ReactNode
  children: ReactNode
  contentClassName?: string
  image?: string | null
}

export function CatalogShell({
  title,
  description,
  eyebrow = 'Descoberta regional',
  citySlug,
  activeSection,
  breadcrumbs = [],
  actions,
  children,
  contentClassName,
  image,
}: CatalogShellProps) {
  const encodedCitySlug = citySlug ? encodeURIComponent(citySlug) : ''
  const contextualLinks = citySlug
    ? [
        { label: 'Lugares', href: `/cidades/${encodedCitySlug}`, section: 'places' as const },
        {
          label: 'Categorias',
          href: `/cidades/${encodedCitySlug}/categorias`,
          section: 'categories' as const,
        },
      ]
    : []

  return (
    <PublicShell title={title} description={description} image={image}>
      <section className="border-b bg-background">
        <div className="app-container py-8 sm:py-10">
          {breadcrumbs.length > 0 ? (
            <nav aria-label="Caminho de navegação" className="mb-6">
              <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                {breadcrumbs.map((item, index) => (
                  <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
                    {index > 0 ? <ChevronRight className="size-3.5" aria-hidden="true" /> : null}
                    {item.href ? (
                      <Link
                        href={item.href}
                        className="rounded-sm outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <ChoiceIndicator />
                        {item.label}
                      </Link>
                    ) : (
                      <span aria-current="page" className="text-foreground">
                        <ChoiceIndicator />
                        {item.label}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
          ) : null}

          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-3xl">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                {citySlug ? (
                  <MapPin aria-hidden="true" className="size-3.5" />
                ) : (
                  <Compass aria-hidden="true" className="size-3.5" />
                )}
                {eyebrow}
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                {description}
              </p>
            </div>
            {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
          </div>

          {contextualLinks.length > 0 ? (
            <nav aria-label="Navegação do catálogo da cidade" className="mt-7">
              <div className="inline-flex gap-1 rounded-md border border-choice-border bg-choice-background p-1">
                {contextualLinks.map((item) => {
                  const selected = item.section === activeSection

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={selected ? 'location' : undefined}
                      data-selected={selected}
                      className="choice-control min-h-11 rounded-sm px-3 py-2 text-sm"
                    >
                      <ChoiceIndicator />
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </nav>
          ) : null}
        </div>
      </section>

      <div className={cn('app-container flex-1 py-7 sm:py-10', contentClassName)}>{children}</div>
    </PublicShell>
  )
}

export default CatalogShell
