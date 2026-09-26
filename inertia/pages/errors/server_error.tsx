import { Link } from '@inertiajs/react'
import { CircleAlert, House, RefreshCw } from 'lucide-react'

import { PublicErrorShell } from '~/components/public'
import { Button } from '~/components/ui/button'

export interface PublicServerError {
  code: 'E_INTERNAL_SERVER_ERROR'
  message: 'Algo deu errado ao processar sua solicitação. Tente novamente em instantes.'
  status: number
}

interface ServerErrorProps {
  error: PublicServerError
}

const DESCRIPTION =
  'Não foi possível concluir esta solicitação agora. Você pode tentar novamente ou voltar ao início.'

export default function ServerError({ error }: ServerErrorProps) {
  return (
    <PublicErrorShell title="Algo deu errado" description={DESCRIPTION}>
      <div className="app-container flex min-h-[60vh] items-center py-12 sm:py-16">
        <section
          aria-labelledby="server-error-title"
          className="mx-auto w-full max-w-2xl rounded-card border border-border-subtle bg-card p-6 sm:p-10"
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-destructive-soft text-destructive-accent">
            <CircleAlert className="size-5" aria-hidden="true" />
          </span>
          <p className="mt-6 text-xs font-extrabold uppercase tracking-[0.1em] text-destructive-accent">
            Erro {error.status}
          </p>
          <h1
            id="server-error-title"
            className="mt-2 text-balance font-display text-[1.875rem] font-extrabold leading-[1.1] tracking-[-0.02em] sm:text-[2.5rem]"
          >
            Não foi possível concluir
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">{error.message}</p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              variant="primary"
              size="2xl"
              shape="pill"
              onClick={() => window.location.reload()}
            >
              <RefreshCw aria-hidden="true" />
              Tentar novamente
            </Button>
            <Button variant="outline" size="2xl" shape="pill" asChild>
              <Link href="/">
                <House aria-hidden="true" />
                Voltar ao início
              </Link>
            </Button>
          </div>
        </section>
      </div>
    </PublicErrorShell>
  )
}
