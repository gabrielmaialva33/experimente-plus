import { Link } from '@inertiajs/react'
import { ChevronRight, Compass, MapPin } from 'lucide-react'
import type { ReactNode } from 'react'

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
            <nav aria-label="Caminho de navegação" className="mb-5">
              {/* W83: a trail is not a set of choices, so it carries no check marks. */}
              <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
                {breadcrumbs.map((item, index) => (
                  <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
                    {index > 0 ? (
                      <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
                    ) : null}
                    {item.href ? (
                      <Link
                        href={item.href}
                        className="inline-flex min-h-8 items-center rounded-sm font-medium pointer-coarse:min-h-11 outline-none underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {item.label}
                      </Link>
                    ) : (
                      <span aria-current="page" className="truncate font-semibold text-foreground">
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
              <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.1em] text-primary-accent">
                {citySlug ? (
                  <MapPin aria-hidden="true" className="size-3.5" />
                ) : (
                  <Compass aria-hidden="true" className="size-3.5" />
                )}
                {eyebrow}
              </p>
              <h1 className="mt-2 text-balance font-display text-[1.875rem] font-extrabold leading-[1.1] tracking-[-0.02em] sm:text-[2.5rem]">
                {title}
              </h1>
              <p className="mt-3 max-w-2xl text-[0.9375rem] leading-6 text-muted-foreground sm:text-base sm:leading-7">
                {description}
              </p>
            </div>
            {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
          </div>

          {contextualLinks.length > 0 ? (
            <nav aria-label="Navegação do catálogo da cidade" className="mt-6">
              <ul className="flex flex-wrap gap-2">
                {contextualLinks.map((item) => {
                  const selected = item.section === activeSection

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={selected ? 'location' : undefined}
                        className={cn(
                          'inline-flex min-h-11 items-center rounded-full border px-5 text-[0.9375rem] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none',
                          selected
                            ? 'border-primary bg-primary text-primary-foreground hover:bg-primary-hover'
                            : 'border-border bg-card text-foreground hover:border-primary hover:text-primary-accent'
                        )}
                      >
                        {item.label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </nav>
          ) : null}
        </div>
      </section>

      <div className={cn('app-container flex-1 py-7 sm:py-10', contentClassName)}>{children}</div>
    </PublicShell>
  )
}

export default CatalogShell
