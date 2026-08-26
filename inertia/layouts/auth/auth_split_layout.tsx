import { Link } from '@inertiajs/react'
import { CheckCircle2, Compass, ShieldCheck, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { AppBrand } from '~/components/app_brand'
import { MAIN_CONTENT_ID, SkipLink } from '~/components/skip_link'
import { ThemeToggle } from '~/components/theme/theme_toggle'
import { useApp } from '~/hooks/use_app'
import { cn } from '~/lib/utils'

interface Feature {
  title: string
  description: string
  icon?: LucideIcon
}

interface AuthSplitLayoutProps {
  title: string
  subtitle: string
  panelTitle: string
  panelDescription: string
  formEyebrow?: string
  features?: Feature[]
  children: ReactNode
  footer?: ReactNode
  contentWidth?: 'default' | 'wide'
}

export function AuthSplitLayout({
  title,
  subtitle,
  panelTitle,
  panelDescription,
  formEyebrow = 'Acesso seguro',
  features = [],
  children,
  footer,
  contentWidth = 'default',
}: AuthSplitLayoutProps) {
  const application = useApp()

  return (
    <>
      <SkipLink />
      <div className="flex min-h-screen overflow-x-clip bg-background">
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-3 border-b px-4 py-4 sm:px-6 lg:border-0 lg:px-8 lg:py-6">
            <AppBrand href="/" />
            <div className="flex items-center gap-1.5">
              <Link
                href="/cidades"
                className="hidden items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground sm:inline-flex"
              >
                <Compass className="size-4" /> Explorar catálogo
              </Link>
              <ThemeToggle />
            </div>
          </header>

          <main
            id={MAIN_CONTENT_ID}
            tabIndex={-1}
            className="flex flex-1 items-center justify-center px-4 py-9 sm:px-6 sm:py-12 lg:px-8"
          >
            <div
              className={cn('w-full', contentWidth === 'wide' ? 'max-w-[480px]' : 'max-w-[420px]')}
            >
              <div className="mb-7">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  <ShieldCheck className="size-3.5" /> {formEyebrow}
                </p>
                <h1 className="mt-3 text-3xl font-bold tracking-[-0.035em] sm:text-4xl">{title}</h1>
                <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
                  {subtitle}
                </p>
              </div>

              <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">{children}</div>

              {footer ? <div className="mt-6 text-center text-sm">{footer}</div> : null}

              <Link
                href="/cidades"
                className="mx-auto mt-5 flex w-fit items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground sm:hidden"
              >
                <Compass className="size-3.5" /> Explorar o catálogo sem entrar
              </Link>
            </div>
          </main>

          <footer className="px-6 py-5 text-center text-xs text-muted-foreground lg:px-8 lg:text-start">
            &copy; {new Date().getFullYear()} {application.name}. Todos os direitos reservados.
          </footer>
        </div>

        <aside
          aria-labelledby="auth-benefits-title"
          className="relative hidden overflow-hidden bg-primary lg:block lg:w-[44%] xl:w-[48%]"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-primary/75" />
          <div className="absolute -end-32 -top-24 size-96 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-28 -start-24 size-80 rounded-full bg-warning/20 blur-3xl" />
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.16]" />

          <div className="relative flex h-full flex-col justify-between p-10 text-primary-foreground xl:p-14">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold backdrop-blur">
              <ShieldCheck className="size-3.5" /> Portal do parceiro
            </div>

            <div className="my-auto py-12">
              <h2
                id="auth-benefits-title"
                className="max-w-lg text-4xl font-bold leading-[1.08] tracking-[-0.035em] xl:text-5xl"
              >
                {panelTitle}
              </h2>
              <p className="mt-5 max-w-lg text-base leading-7 text-primary-foreground/78 xl:text-lg">
                {panelDescription}
              </p>

              {features.length > 0 ? (
                <ul className="mt-10 grid max-w-lg gap-4">
                  {features.map((feature) => {
                    const Icon = feature.icon ?? CheckCircle2
                    return (
                      <li
                        key={feature.title}
                        className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur-sm"
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/12">
                          <Icon className="size-4.5" />
                        </span>
                        <div>
                          <p className="font-semibold">{feature.title}</p>
                          <p className="mt-1 text-sm leading-6 text-primary-foreground/72">
                            {feature.description}
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              ) : null}
            </div>

            <p className="text-xs leading-5 text-primary-foreground/65">
              A descoberta pública permanece disponível sem login. O acesso é necessário apenas para
              gerenciar organizações, unidades e operações.
            </p>
          </div>
        </aside>
      </div>
    </>
  )
}
