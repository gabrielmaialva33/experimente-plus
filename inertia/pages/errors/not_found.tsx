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
          className="mx-auto w-full max-w-2xl rounded-xl border bg-card p-6 sm:p-10"
        >
          <span className="flex size-11 items-center justify-center rounded-md bg-primary-soft text-primary-accent">
            <MapPinOff className="size-5" aria-hidden="true" />
          </span>
          <p className="mt-6 text-sm font-semibold text-primary-accent">Erro 404</p>
          <h1
            id="not-found-title"
            className="mt-2 text-3xl font-bold tracking-tight text-balance sm:text-4xl"
          >
            Página não encontrada
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">{DESCRIPTION}</p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button variant="cta" size="lg" asChild>
              <Link href="/">
                <House aria-hidden="true" />
                Voltar ao início
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
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
