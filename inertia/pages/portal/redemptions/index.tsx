import { Head, Link } from '@inertiajs/react'
import { ArrowRight, ReceiptText, ScanLine } from 'lucide-react'

import { EmptyState } from '~/components/empty_state'
import { PageHeader } from '~/components/page_header'
import { Badge } from '~/components/ui/badge'
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

      <div className="space-y-6">
        <PageHeader
          title="Utilizações"
          description="Comprovantes dos benefícios usados nos lugares que você acompanha."
          actions={
            canValidate ? (
              <Button asChild variant="cta" size="xl" shape="pill">
                <Link href="/portal/redemptions/validate">
                  <ScanLine />
                  Validar benefício
                </Link>
              </Button>
            ) : null
          }
          meta={
            <Badge variant="neutral" appearance="light" shape="pill" size="lg">
              {history.total === 0
                ? 'Nenhuma utilização'
                : `${history.total.toLocaleString('pt-BR')} ${history.total === 1 ? 'utilização' : 'utilizações'}`}
            </Badge>
          }
        />

        {history.redemptions.length === 0 ? (
          <EmptyState
            className="rounded-card border border-dashed border-border bg-card"
            headingLevel={2}
            icon={ReceiptText}
            title="Nenhuma utilização ainda"
            description="Os comprovantes aparecem aqui depois do primeiro benefício confirmado."
          />
        ) : (
          <section
            aria-label="Utilizações confirmadas"
            className="overflow-hidden rounded-card border border-border-subtle bg-card"
          >
            <div
              aria-hidden="true"
              className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1.3fr)_11rem] gap-4 border-b border-border-subtle px-5 py-3 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground md:grid"
            >
              <span>Benefício</span>
              <span>Titular</span>
              <span>Quando</span>
              <span>Comprovante</span>
            </div>
            <ul className="divide-y divide-border-subtle">
              {history.redemptions.map((redemption) => (
                <li key={redemption.id}>
                  <Link
                    href={`/portal/redemptions/${redemption.receipt_code}`}
                    className="group grid gap-1 px-5 py-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:transition-none md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1.3fr)_11rem] md:items-center md:gap-4"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-display font-bold">
                        {redemption.offer.title}
                      </span>
                      <span className="block truncate text-sm text-muted-foreground">
                        {redemption.establishment.name}
                      </span>
                    </span>
                    <span className="truncate text-sm">{redemption.holder.full_name}</span>
                    <span className="text-sm text-muted-foreground">
                      {formatDateTime(redemption.redeemed_at)}
                    </span>
                    <span className="flex items-center justify-between gap-2 font-mono text-xs font-bold">
                      {redemption.receipt_code}
                      <ArrowRight
                        aria-hidden="true"
                        className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                      />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </MainLayout>
  )
}
