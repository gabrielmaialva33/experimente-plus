import { Head, Link } from '@inertiajs/react'
import { ArrowLeft, CheckCircle2, ShieldCheck } from 'lucide-react'

import { ConsumerFlowShell } from '~/components/consumer/consumer_flow_shell'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader } from '~/components/ui/card'
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
    <ConsumerFlowShell
      title="Comprovante"
      description="Registro permanente de uma utilização confirmada."
      actions={
        <Button asChild variant="outline" size="xl" shape="pill">
          <Link href="/wallet/history">
            <ArrowLeft aria-hidden="true" />
            Voltar às utilizações
          </Link>
        </Button>
      }
    >
      <Head title={`Comprovante ${receipt.receipt_code}`}>
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <Card className="mx-auto max-w-3xl overflow-hidden border border-border-subtle bg-card">
        <CardHeader className="flex-col items-start bg-success-soft">
          <Badge variant="success" appearance="outline" shape="pill" size="lg">
            <CheckCircle2 aria-hidden="true" />
            Utilização confirmada
          </Badge>
          <div>
            <h2 className="font-display text-[1.625rem] font-extrabold leading-tight tracking-[-0.02em]">
              {receipt.offer.title}
            </h2>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              {receipt.establishment.name}
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="rounded-2xl border-2 border-dashed border-border-subtle bg-background p-4 text-center">
            <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-muted-foreground">
              Código do comprovante
            </p>
            <code className="mt-1 block break-all text-xl font-bold tracking-wide">
              {receipt.receipt_code}
            </code>
          </div>

          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border-subtle p-4">
              <dt className="text-xs font-extrabold uppercase tracking-[0.1em] text-muted-foreground">
                Edição
              </dt>
              <dd className="mt-1 font-semibold">{receipt.edition.name}</dd>
            </div>
            <div className="rounded-2xl border border-border-subtle p-4">
              <dt className="text-xs font-extrabold uppercase tracking-[0.1em] text-muted-foreground">
                Utilização
              </dt>
              <dd className="mt-1 font-semibold tabular-nums">#{receipt.redemption_number}</dd>
            </div>
            <div className="rounded-2xl border border-border-subtle p-4 sm:col-span-2">
              <dt className="text-xs font-extrabold uppercase tracking-[0.1em] text-muted-foreground">
                Confirmado em
              </dt>
              <dd className="mt-1 font-semibold">{formatDate(receipt.redeemed_at)}</dd>
            </div>
          </dl>

          {receipt.offer.terms ? (
            <section
              aria-labelledby="receipt-terms-title"
              className="rounded-2xl border border-border-subtle p-4"
            >
              <h3 id="receipt-terms-title" className="font-display text-[0.9375rem] font-extrabold">
                Regras vigentes no momento da utilização
              </h3>
              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted-foreground">
                {receipt.offer.terms}
              </p>
            </section>
          ) : null}

          <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary-soft p-4 text-sm leading-6 text-primary-accent">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Este comprovante foi criado pelo servidor no momento da confirmação do estabelecimento.
          </div>

          <Button asChild variant="outline" size="xl" shape="pill" className="w-full">
            <Link href="/wallet">Voltar à carteira</Link>
          </Button>
        </CardContent>
      </Card>
    </ConsumerFlowShell>
  )
}
