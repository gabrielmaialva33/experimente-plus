import { Head, Link } from '@inertiajs/react'
import { ArrowLeft, CalendarClock, CheckCircle2, ReceiptText } from 'lucide-react'

import { ConsumerShell } from '~/components/consumer/consumer_shell'
import { Button } from '~/components/ui/button'
import type { RedemptionHistory } from '~/types/benefit_redemption'

interface WalletRedemptionsPageProps {
  history: RedemptionHistory
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(value))
}

export default function WalletRedemptionsPage({ history }: WalletRedemptionsPageProps) {
  return (
    <ConsumerShell>
      <Head title="Utilizações" />

      <div className="mx-auto w-full max-w-6xl">
        <Button asChild variant="ghost" className="-ml-3 min-h-11">
          <Link href="/wallet">
            <ArrowLeft />
            Voltar à carteira
          </Link>
        </Button>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-primary">Minha atividade</p>
            <h1 className="mt-1 text-3xl font-black tracking-[-0.04em] sm:text-4xl">Utilizações</h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Cada utilização possui um comprovante permanente, mesmo depois do encerramento da
              edição.
            </p>
          </div>
          <span className="w-fit rounded-full border border-border bg-card px-3 py-1.5 text-sm font-semibold">
            {history.total} {history.total === 1 ? 'utilização' : 'utilizações'}
          </span>
        </div>

        {history.redemptions.length === 0 ? (
          <section className="mt-8 rounded-3xl border border-dashed border-border bg-card px-6 py-14 text-center">
            <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ReceiptText className="size-6" />
            </span>
            <h2 className="mt-5 text-lg font-bold">Nenhum benefício utilizado ainda</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Quando um parceiro confirmar sua primeira utilização, o comprovante aparecerá aqui.
            </p>
            <Button asChild className="mt-5 min-h-11">
              <Link href="/wallet">Ver minha carteira</Link>
            </Button>
          </section>
        ) : (
          <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {history.redemptions.map((redemption) => (
              <article
                key={redemption.id}
                className="flex min-h-full flex-col rounded-3xl border border-border/70 bg-card p-5 shadow-xs"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex size-10 items-center justify-center rounded-2xl bg-success/10 text-success">
                    <CheckCircle2 className="size-5" />
                  </span>
                  <span className="rounded-full bg-muted px-2.5 py-1 font-mono text-[0.7rem] font-semibold">
                    {redemption.receipt_code}
                  </span>
                </div>
                <p className="mt-5 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                  {redemption.establishment.name}
                </p>
                <h2 className="mt-1 text-lg font-bold">{redemption.offer.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{redemption.edition.name}</p>
                <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarClock className="size-4" />
                  {formatDate(redemption.redeemed_at)}
                </div>
                <Button asChild variant="outline" className="mt-auto min-h-11 pt-5">
                  <Link href={`/wallet/redemptions/${redemption.receipt_code}`}>
                    <ReceiptText />
                    Ver comprovante
                  </Link>
                </Button>
              </article>
            ))}
          </section>
        )}
      </div>
    </ConsumerShell>
  )
}
