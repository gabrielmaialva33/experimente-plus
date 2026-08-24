import { Head, Link } from '@inertiajs/react'
import type { PropsWithChildren } from 'react'

interface CatalogShellProps extends PropsWithChildren {
  title: string
  description: string
  eyebrow?: string
}

export default function CatalogShell({
  title,
  description,
  eyebrow = 'Descoberta regional',
  children,
}: CatalogShellProps) {
  return (
    <>
      <Head title={title}>
        <meta name="description" content={description} />
      </Head>

      <div className="min-h-screen bg-background text-foreground">
        <header className="border-b border-border bg-card/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-6">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              Experimente+
            </Link>
            <nav aria-label="Navegação pública" className="flex items-center gap-4 text-sm">
              <Link
                href="/cidades"
                className="text-muted-foreground transition hover:text-foreground"
              >
                Cidades
              </Link>
              <Link href="/login" className="font-medium text-primary transition hover:opacity-80">
                Área do parceiro
              </Link>
            </nav>
          </div>
        </header>

        <main>
          <section className="border-b border-border bg-muted/30">
            <div className="mx-auto max-w-6xl px-5 py-12 sm:px-6 sm:py-16">
              <p className="text-sm font-medium text-primary">{eyebrow}</p>
              <h1 className="mt-3 max-w-4xl text-3xl font-semibold tracking-tight sm:text-5xl">
                {title}
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
                {description}
              </p>
            </div>
          </section>

          <div className="mx-auto max-w-6xl px-5 py-10 sm:px-6 sm:py-14">{children}</div>
        </main>

        <footer className="border-t border-border py-8">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 text-sm text-muted-foreground sm:px-6">
            <p>Informações publicadas e moderadas pelo Experimente+.</p>
            <p>
              Horários e disponibilidade podem mudar; confirme diretamente com o estabelecimento.
            </p>
          </div>
        </footer>
      </div>
    </>
  )
}
