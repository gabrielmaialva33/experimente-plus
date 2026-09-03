import { Link } from '@inertiajs/react'
import { Compass, ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'

import { AppBrand } from '~/components/app_brand'
import { MAIN_CONTENT_ID, SkipLink } from '~/components/skip_link'
import { ThemeToggle } from '~/components/theme/theme_toggle'
import { useApp } from '~/hooks/use_app'
import { cn } from '~/lib/utils'

interface AuthSplitLayoutProps {
  title: string
  subtitle: string
  contextTitle?: string
  contextDescription?: string
  children: ReactNode
  footer?: ReactNode
  contentWidth?: 'default' | 'wide'
}

/**
 * Focused authentication shell. Context stays secondary to the form, giving
 * every authentication page one clear task on every viewport.
 */
export function AuthSplitLayout({
  title,
  subtitle,
  contextTitle,
  contextDescription,
  children,
  footer,
  contentWidth = 'default',
}: AuthSplitLayoutProps) {
  const application = useApp()

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SkipLink />

      <header className="border-b bg-background">
        <div className="app-container flex min-h-16 items-center justify-between gap-3 py-2">
          <AppBrand href="/" />
          <div className="flex items-center gap-1.5">
            <Link
              href="/cidades"
              className="hidden min-h-10 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:inline-flex"
            >
              <Compass className="size-4" aria-hidden="true" />
              Explorar catálogo
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main
        id={MAIN_CONTENT_ID}
        tabIndex={-1}
        className="app-container flex flex-1 items-center justify-center py-8 outline-none sm:py-12"
      >
        <div className={cn('w-full', contentWidth === 'wide' ? 'max-w-[32rem]' : 'max-w-[28rem]')}>
          <header className="mb-6">
            <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">{subtitle}</p>
          </header>

          <section aria-label={title} className="rounded-lg border bg-card p-5 sm:p-6">
            {children}
          </section>

          {footer ? <div className="mt-5 text-center text-sm">{footer}</div> : null}

          {contextTitle || contextDescription ? (
            <aside
              className="mt-6 rounded-lg border bg-muted/40 p-4"
              aria-label="Sobre este acesso"
            >
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-background text-primary">
                  <ShieldCheck className="size-4" aria-hidden="true" />
                </span>
                <div>
                  {contextTitle ? <h2 className="text-sm font-semibold">{contextTitle}</h2> : null}
                  {contextDescription ? (
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {contextDescription}
                    </p>
                  ) : null}
                </div>
              </div>
            </aside>
          ) : null}

          <Link
            href="/cidades"
            className="mx-auto mt-5 flex min-h-10 w-fit items-center gap-2 rounded-md px-2 text-xs font-medium text-muted-foreground hover:text-foreground sm:hidden"
          >
            <Compass className="size-3.5" aria-hidden="true" />
            Explorar sem entrar
          </Link>
        </div>
      </main>

      <footer className="app-container py-5 text-center text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} {application.name}
      </footer>
    </div>
  )
}
