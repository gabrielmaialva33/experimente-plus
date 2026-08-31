import { Head, Link } from '@inertiajs/react'
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  History,
  MapPin,
  PauseCircle,
  Store,
  TicketCheck,
} from 'lucide-react'

import { ConsumerFlowShell } from '~/components/consumer/consumer_flow_shell'
import { Button } from '~/components/ui/button'
import { cn } from '~/lib/utils'
import type { BenefitWallet, WalletBenefit } from '~/types/benefit'

interface WalletPageProps {
  wallet: BenefitWallet
}

const stateMeta: Record<string, { label: string; className: string; icon: typeof Clock3 }> = {
  available: {
    label: 'Disponível agora',
    className: 'border-success/25 bg-success/10 text-success',
    icon: CheckCircle2,
  },
  upcoming: {
    label: 'Em breve',
    className: 'border-primary/20 bg-primary/10 text-primary',
    icon: CalendarClock,
  },
  outside_schedule: {
    label: 'Fora do horário',
    className: 'border-warning/25 bg-warning/10 text-warning-foreground',
    icon: Clock3,
  },
  paused: {
    label: 'Temporariamente pausado',
    className: 'border-warning/25 bg-warning/10 text-warning-foreground',
    icon: PauseCircle,
  },
  expired: {
    label: 'Encerrado',
    className: 'border-border bg-muted text-muted-foreground',
    icon: Clock3,
  },
  revoked: {
    label: 'Acesso revogado',
    className: 'border-destructive/20 bg-destructive/10 text-destructive',
    icon: PauseCircle,
  },
  redeemed: {
    label: 'Utilizado',
    className: 'border-border bg-muted text-muted-foreground',
    icon: TicketCheck,
  },
  unavailable: {
    label: 'Indisponível',
    className: 'border-border bg-muted text-muted-foreground',
    icon: PauseCircle,
  },
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Data não informada'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(value))
}

function benefitLabel(benefit: WalletBenefit): string {
  if (benefit.benefit_type === 'percentage' && benefit.discount_percentage) {
    return `${benefit.discount_percentage}% de desconto`
  }
  if (benefit.benefit_type === 'fixed_amount' && benefit.discount_amount_cents) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(benefit.discount_amount_cents / 100)
  }
  const labels: Record<string, string> = {
    buy_one_get_one: 'Compre um e ganhe outro',
    complimentary_item: 'Item cortesia',
    custom: 'Benefício especial',
  }
  return labels[benefit.benefit_type] ?? 'Benefício exclusivo'
}

export default function WalletPage({ wallet }: WalletPageProps) {
  const { passes, summary } = wallet

  return (
    <ConsumerFlowShell
      title="Minha carteira"
      description="Seus acessos e benefícios são calculados em tempo real. Apresente um benefício somente quando estiver no estabelecimento."
      actions={
        <Button asChild variant="outline">
          <Link href="/wallet/history">
            <History />
            Benefícios utilizados
          </Link>
        </Button>
      }
    >
      <Head title="Minha carteira" />

      <section className="mb-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-xs">
          <p className="text-xs text-muted-foreground">Edições</p>
          <p className="mt-1 text-2xl font-black">{summary.passes}</p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-xs">
          <p className="text-xs text-muted-foreground">Benefícios</p>
          <p className="mt-1 text-2xl font-black">{summary.benefits}</p>
        </div>
        <div className="rounded-2xl border border-success/20 bg-success/10 p-4 shadow-xs">
          <p className="text-xs text-muted-foreground">Disponíveis</p>
          <p className="mt-1 text-2xl font-black text-success">{summary.available}</p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-xs">
          <p className="text-xs text-muted-foreground">Utilizados</p>
          <p className="mt-1 text-2xl font-black">{summary.redeemed}</p>
        </div>
      </section>

      {passes.length === 0 ? (
        <section className="rounded-3xl border border-dashed border-border bg-card px-6 py-16 text-center shadow-xs">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <TicketCheck className="size-6" />
          </span>
          <h2 className="mt-5 text-lg font-bold">Sua carteira ainda está vazia</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Assim que uma edição for comprada ou liberada para sua conta, os benefícios aparecerão
            aqui automaticamente.
          </p>
        </section>
      ) : (
        <div className="space-y-7">
          {passes.map((pass) => {
            const { edition, access, benefits } = pass
            const { city } = edition
            const passKey = access.id

            return (
              <section
                key={passKey}
                className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm"
              >
                <div className="border-b border-border/70 bg-primary/[0.055] p-5 sm:p-7">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                        <MapPin className="size-3.5" />
                        {city.name} · {city.state_code}
                      </p>
                      <h2 className="mt-2 text-2xl font-black tracking-[-0.035em]">
                        {edition.name}
                      </h2>
                      {edition.description ? (
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                          {edition.description}
                        </p>
                      ) : null}
                    </div>
                    <div className="shrink-0 rounded-2xl border border-border/70 bg-background/75 px-4 py-3 text-sm">
                      <p className="text-xs text-muted-foreground">Utilização</p>
                      <p className="mt-1 font-semibold">
                        {formatDate(edition.usage_starts_at)} — {formatDate(edition.usage_ends_at)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-5 sm:p-7">
                  {benefits.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
                      Esta edição ainda não possui benefícios disponíveis para sua carteira.
                    </p>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {benefits.map((benefit) => {
                        const state = benefit.availability
                        const meta = stateMeta[state] ?? stateMeta.unavailable
                        const Icon = meta.icon
                        const establishment = benefit.establishment
                        const offerId = benefit.offer_id
                        const accessId = benefit.access_id
                        const remaining = Number(
                          benefit.remaining_redemptions ?? benefit.max_redemptions_per_access
                        )

                        return (
                          <article
                            key={benefit.key}
                            className="flex min-h-full flex-col rounded-3xl border border-border/70 bg-background p-5 shadow-xs"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                <Store className="size-5" />
                              </span>
                              <span
                                className={cn(
                                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold',
                                  meta.className
                                )}
                              >
                                <Icon className="size-3.5" />
                                {meta.label}
                              </span>
                            </div>

                            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                              {benefitLabel(benefit)}
                            </p>
                            <h3 className="mt-1 text-lg font-bold tracking-[-0.025em]">
                              {benefit.title}
                            </h3>
                            <p className="mt-2 text-sm font-semibold text-muted-foreground">
                              {establishment.public_name ?? 'Estabelecimento participante'}
                            </p>
                            {benefit.description ? (
                              <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">
                                {benefit.description}
                              </p>
                            ) : null}

                            <div className="mt-auto pt-5">
                              {state === 'available' && offerId > 0 && accessId > 0 ? (
                                <Button asChild size="lg" className="min-h-11 w-full">
                                  <Link href={`/wallet/accesses/${accessId}/offers/${offerId}/use`}>
                                    <TicketCheck />
                                    Usar benefício
                                  </Link>
                                </Button>
                              ) : (
                                <div className="rounded-xl bg-muted/55 px-3 py-2 text-center text-xs leading-5 text-muted-foreground">
                                  {state === 'redeemed'
                                    ? 'Todos os usos foram concluídos.'
                                    : 'Este benefício não pode ser apresentado agora.'}
                                </div>
                              )}
                              <p className="mt-2 text-center text-[0.68rem] text-muted-foreground">
                                {remaining} {remaining === 1 ? 'uso restante' : 'usos restantes'}
                              </p>
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </ConsumerFlowShell>
  )
}
