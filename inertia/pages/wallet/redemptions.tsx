import { Head, Link } from '@inertiajs/react'
import { ArrowLeft, CalendarClock, CheckCircle2, ReceiptText } from 'lucide-react'

import { ConsumerFlowShell } from '~/components/consumer/consumer_flow_shell'
import { EmptyState } from '~/components/empty_state'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
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
    <ConsumerFlowShell
      title="Utilizações"
      description="Histórico de benefícios utilizados e seus comprovantes permanentes."
      meta={
        <Badge variant="secondary" appearance="outline" shape="pill" size="lg">
          {history.total} {history.total === 1 ? 'utilização' : 'utilizações'}
        </Badge>
      }
      actions={
        <Button asChild variant="outline" size="xl" shape="pill">
          <Link href="/wallet">
            <ArrowLeft aria-hidden="true" />
            Voltar à carteira
          </Link>
        </Button>
      }
    >
      <Head title="Utilizações">
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      {history.redemptions.length === 0 ? (
        <Card className="border border-border-subtle bg-card">
          <EmptyState
            headingLevel={2}
            icon={ReceiptText}
            title="Nenhuma utilização ainda"
            description="Quando uma utilização for confirmada pelo estabelecimento, o comprovante aparecerá aqui."
          >
            <Button asChild variant="outline" size="xl" shape="pill">
              <Link href="/wallet">Ver minha carteira</Link>
            </Button>
          </EmptyState>
        </Card>
      ) : (
        <section aria-label="Comprovantes" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {history.redemptions.map((redemption) => (
            <Card key={redemption.id} className="h-full border border-border-subtle bg-card">
              <CardContent className="flex h-full flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex size-10 items-center justify-center rounded-full bg-success-soft text-success-accent">
                    <CheckCircle2 className="size-5" aria-hidden="true" />
                  </span>
                  <code className="rounded-full border border-border-subtle bg-background px-3 py-1 text-xs font-semibold">
                    {redemption.receipt_code}
                  </code>
                </div>
                <p className="mt-4 text-xs font-extrabold uppercase tracking-[0.1em] text-primary-accent">
                  {redemption.establishment.name}
                </p>
                <h2 className="mt-1 font-display text-lg font-extrabold leading-tight">
                  {redemption.offer.title}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{redemption.edition.name}</p>
                <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarClock className="size-4" aria-hidden="true" />
                  {formatDate(redemption.redeemed_at)}
                </p>
                {/* Pinned to the card floor with a constant gap, even under a two-line title. */}
                <div className="mt-auto pt-5">
                  <Button asChild variant="outline" size="xl" shape="pill" className="w-full">
                    <Link href={`/wallet/redemptions/${redemption.receipt_code}`}>
                      <ReceiptText aria-hidden="true" />
                      Ver comprovante
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </ConsumerFlowShell>
  )
}
