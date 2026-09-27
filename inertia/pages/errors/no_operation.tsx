import { Link } from '@inertiajs/react'
import { Compass, House, UserRoundX } from 'lucide-react'

import { PublicErrorShell } from '~/components/public'
import { Button } from '~/components/ui/button'

const DESCRIPTION =
  'Esta área precisa de uma conta ligada a uma região do Experimente+, e a sua não está ligada a nenhuma no momento. Explorar os lugares continua livre; se isso parece um engano, fale com o suporte.'

/** A signed-in account with no active operation opened an area that needs one. */
export default function NoOperation() {
  return (
    <PublicErrorShell title="Área indisponível para sua conta" description={DESCRIPTION}>
      <div className="app-container flex min-h-[60vh] items-center py-12 sm:py-16">
        <section
          aria-labelledby="no-operation-title"
          className="mx-auto w-full max-w-2xl rounded-card border border-border-subtle bg-card p-6 sm:p-10"
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary-accent">
            <UserRoundX className="size-5" aria-hidden="true" />
          </span>
          <h1
            id="no-operation-title"
            className="mt-6 text-balance font-display text-[1.875rem] font-extrabold leading-[1.1] tracking-[-0.02em] sm:text-[2.5rem]"
          >
            Área indisponível para sua conta
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
