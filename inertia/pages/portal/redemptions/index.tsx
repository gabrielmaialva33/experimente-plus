import { Head, Link } from '@inertiajs/react'
import { ArrowRight, CheckCircle2, ReceiptText, ScanLine } from 'lucide-react'

import { PageHeader } from '~/components/page_header'
import { Button } from '~/components/ui/button'
import { MainLayout } from '~/layouts/main_layout'
import type { RedemptionHistory } from '~/types/benefit_redemption'

interface PartnerRedemptionsPageProps {
  history: RedemptionHistory
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(value))
}

export default function PartnerRedemptionsPage({ history }: PartnerRedemptionsPageProps) {
  return (
    <MainLayout>
      <Head title="Utilizações validadas" />

      <div className="space-y-7">
        <PageHeader
          eyebrow="Portal do parceiro"
          icon={ReceiptText}
          title="Utilizações validadas"
          description="Consulte os comprovantes emitidos pelas unidades que você administra."
          actions={
            <Button asChild size="lg">
              <Link href="/portal/redemptions/validate">
                <ScanLine />
                Validar benefício
              </Link>
            </Button>
          }
          meta={
            <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold">
              {history.total} {history.total === 1 ? 'utilização' : 'utilizações'}
            </span>
          }
        />

        {history.redemptions.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-border bg-card px-6 py-14 text-center shadow-xs">
            <ReceiptText className="mx-auto size-8 text-muted-foreground" />
            <h2 className="mt-4 font-bold">Nenhum benefício validado ainda</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
              Os comprovantes aparecerão aqui depois da primeira utilização confirmada.
            </p>
          </section>
        ) : (
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {history.redemptions.map((redemption) => (
              <Link
                key={redemption.id}
                href={`/portal/redemptions/${redemption.receipt_code}`}
                className="group rounded-3xl border border-border/70 bg-card p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex size-10 items-center justify-center rounded-2xl bg-success/10 text-success">
                    <CheckCircle2 className="size-5" />
                  </span>
                  <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="mt-4 text-xs font-bold uppercase tracking-[0.12em] text-primary">
                  {redemption.establishment.name}
                </p>
                <h2 className="mt-1 font-bold">{redemption.offer.title}</h2>
                <p className="mt-3 text-sm text-muted-foreground">
                  {redemption.holder.full_name} · {formatDateTime(redemption.redeemed_at)}
                </p>
                <p className="mt-4 font-mono text-xs font-bold">{redemption.receipt_code}</p>
              </Link>
            ))}
          </section>
        )}
      </div>
    </MainLayout>
  )
}
