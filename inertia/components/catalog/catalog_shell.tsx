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
  breadcrumbs = [],
  actions,
  children,
  contentClassName,
  image,
}: CatalogShellProps) {
  const contextualLinks = citySlug
    ? [
        { label: 'Lugares', href: `/cidades/${citySlug}` },
        { label: 'Categorias', href: `/cidades/${citySlug}/categorias` },
      ]
    : []

  return (
    <PublicShell title={title} description={description} image={image}>
      <section className="relative overflow-hidden border-b bg-gradient-to-br from-primary/10 via-background to-cta/10">
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.22] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <div className="relative mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          {breadcrumbs.length > 0 ? (
            <nav aria-label="Navegação estrutural" className="mb-6">
              <ol className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                {breadcrumbs.map((item, index) => (
                  <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
                    {index > 0 ? <ChevronRight className="size-3.5" aria-hidden="true" /> : null}
                    {item.href ? (
                      <Link href={item.href} className="hover:text-foreground hover:underline">
                        {item.label}
                      </Link>
                    ) : (
                      <span aria-current="page" className="text-foreground">
                        {item.label}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
          ) : null}

          <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                {citySlug ? <MapPin className="size-3.5" /> : <Compass className="size-3.5" />}
                {eyebrow}
              </p>
              <h1 className="mt-3 text-3xl font-bold tracking-[-0.035em] sm:text-4xl lg:text-5xl">
                {title}
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                {description}
              </p>
            </div>
            {actions ? <div className="shrink-0">{actions}</div> : null}
          </div>

          {contextualLinks.length > 0 ? (
            <nav aria-label="Navegação do catálogo da cidade" className="mt-8 flex flex-wrap gap-2">
              {contextualLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-full border bg-background/75 px-4 py-2 text-sm font-medium shadow-sm backdrop-blur transition-colors hover:border-primary/35 hover:text-primary"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>
      </section>

      <div
        className={cn(
          'mx-auto w-full max-w-7xl flex-1 px-4 py-9 sm:px-6 sm:py-12 lg:px-8',
          contentClassName
        )}
      >
        {children}
      </div>
    </PublicShell>
  )
}

export default CatalogShell
