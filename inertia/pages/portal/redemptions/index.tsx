import { Head, Link } from '@inertiajs/react'
import { ArrowRight, CheckCircle2, ReceiptText, ScanLine } from 'lucide-react'

import { EmptyState } from '~/components/empty_state'
import { PageHeader } from '~/components/page_header'
import { Button } from '~/components/ui/button'
import { MainLayout } from '~/layouts/main_layout'
import type { OrganizationAllowedActions } from '~/types'
import type { RedemptionHistory } from '~/types/benefit_redemption'

interface PartnerRedemptionsPageProps {
  history: RedemptionHistory
  allowed_actions: OrganizationAllowedActions
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(value))
}

export default function PartnerRedemptionsPage({
  history,
  allowed_actions: allowedActions,
}: PartnerRedemptionsPageProps) {
  const canValidate = allowedActions.redemptions.validate

  return (
    <MainLayout>
      <Head title="Utilizações" />

      <div className="space-y-7">
        <PageHeader
          eyebrow="Portal do parceiro"
          icon={ReceiptText}
          title="Utilizações"
          description="Consulte os comprovantes emitidos pelas unidades que você administra."
          actions={
            canValidate ? (
              <Button asChild size="lg">
                <Link href="/portal/redemptions/validate">
                  <ScanLine />
                  Validar benefício
                </Link>
              </Button>
            ) : null
          }
          meta={
            <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold">
              {history.total} {history.total === 1 ? 'utilização' : 'utilizações'}
            </span>
          }
        />

        {history.redemptions.length === 0 ? (
          <EmptyState
            className="rounded-lg border border-dashed border-border bg-card"
            headingLevel={2}
            icon={ReceiptText}
            title="Nenhuma utilização registrada"
            description="Os comprovantes aparecerão aqui depois da primeira utilização confirmada."
          />
        ) : (
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {history.redemptions.map((redemption) => (
              <Link
                key={redemption.id}
                href={`/portal/redemptions/${redemption.receipt_code}`}
                className="rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/30 hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex size-10 items-center justify-center rounded-md border border-success/20 bg-success/10 text-success">
                    <CheckCircle2 className="size-5" />
                  </span>
                  <ArrowRight className="size-4 text-muted-foreground" />
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
