import { Link } from '@inertiajs/react'
import { Compass, House, MapPinOff } from 'lucide-react'

import { PublicErrorShell } from '~/components/public'
import { Button } from '~/components/ui/button'

const DESCRIPTION =
  'O endereço pode estar incorreto ou a página pode ter sido movida. Volte ao início ou continue explorando as cidades disponíveis.'

export default function NotFound() {
  return (
    <PublicErrorShell title="Página não encontrada" description={DESCRIPTION}>
      <div className="app-container flex min-h-[60vh] items-center py-12 sm:py-16">
        <section
          aria-labelledby="not-found-title"
          className="mx-auto w-full max-w-2xl rounded-card border border-border-subtle bg-card p-6 sm:p-10"
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary-accent">
            <MapPinOff className="size-5" aria-hidden="true" />
          </span>
          <p className="mt-6 text-xs font-extrabold uppercase tracking-[0.1em] text-primary-accent">
            Erro 404
          </p>
          <h1
            id="not-found-title"
            className="mt-2 text-balance font-display text-[1.875rem] font-extrabold leading-[1.1] tracking-[-0.02em] sm:text-[2.5rem]"
          >
            Página não encontrada
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">{DESCRIPTION}</p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button variant="primary" size="2xl" shape="pill" asChild>
              <Link href="/">
                <House aria-hidden="true" />
                Voltar ao início
              </Link>
            </Button>
            <Button variant="outline" size="2xl" shape="pill" asChild>
              <Link href="/cidades">
                <Compass aria-hidden="true" />
                Explorar cidades
              </Link>
            </Button>
          </div>
        </section>
      </div>
    </PublicErrorShell>
  )
}
