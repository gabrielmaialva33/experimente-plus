import { Head, Link } from '@inertiajs/react'
import { ArrowLeft, CheckCircle2, ReceiptText, ShieldCheck } from 'lucide-react'

import { ConsumerShell } from '~/components/consumer/consumer_shell'
import { Button } from '~/components/ui/button'
import type { RedemptionReceipt } from '~/types/benefit_redemption'

interface WalletReceiptPageProps {
  receipt: RedemptionReceipt
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(value))
}

export default function WalletReceiptPage({ receipt }: WalletReceiptPageProps) {
  return (
    <ConsumerShell active="wallet">
      <Head title={`Comprovante ${receipt.receipt_code}`} />

      <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12">
        <Button asChild variant="ghost" className="-ml-3 min-h-11">
          <Link href="/wallet/history">
            <ArrowLeft />
            Voltar ao histórico
          </Link>
        </Button>

        <section className="mt-5 overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm">
          <div className="bg-success/10 px-6 py-8 text-center sm:px-10">
            <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-background text-success shadow-sm">
              <CheckCircle2 className="size-8" />
            </span>
            <p className="mt-4 text-sm font-semibold text-success">Benefício confirmado</p>
            <h1 className="mt-1 text-2xl font-black tracking-[-0.03em] sm:text-3xl">
              {receipt.offer.title}
            </h1>
            <p className="mt-2 text-muted-foreground">{receipt.establishment.name}</p>
          </div>

          <div className="p-6 sm:p-10">
            <div className="flex flex-col gap-2 rounded-2xl border border-border bg-muted/35 p-5 text-center">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Código do comprovante
              </span>
              <strong className="font-mono text-xl tracking-wide">{receipt.receipt_code}</strong>
            </div>

            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-border/70 p-4">
                <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Edição
                </dt>
                <dd className="mt-1 font-semibold">{receipt.edition.name}</dd>
              </div>
              <div className="rounded-2xl border border-border/70 p-4">
                <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Utilização
                </dt>
                <dd className="mt-1 font-semibold">#{receipt.redemption_number}</dd>
              </div>
              <div className="rounded-2xl border border-border/70 p-4 sm:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Confirmado em
                </dt>
                <dd className="mt-1 font-semibold">{formatDate(receipt.redeemed_at)}</dd>
              </div>
            </dl>

            {receipt.offer.terms ? (
              <div className="mt-6 rounded-2xl border border-border/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Regras vigentes no momento da utilização
                </p>
                <p className="mt-2 whitespace-pre-line text-sm leading-6">{receipt.offer.terms}</p>
              </div>
            ) : null}

            <div className="mt-6 flex items-start gap-3 rounded-2xl bg-muted/35 p-4 text-sm leading-6 text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
              Este comprovante é permanente e foi criado pelo servidor no momento da confirmação do
              parceiro.
            </div>

            <Button asChild className="mt-6 min-h-12 w-full">
              <Link href="/wallet">
                <ReceiptText />
                Voltar à carteira
              </Link>
            </Button>
          </div>
        </section>
      </main>
    </ConsumerShell>
  )
}
