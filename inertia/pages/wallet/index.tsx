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
import { EmptyState } from '~/components/empty_state'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader } from '~/components/ui/card'
import type { BenefitWallet, WalletBenefit } from '~/types/benefit'

interface WalletPageProps {
  wallet: BenefitWallet
}

type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'destructive'

const stateMeta: Record<string, { label: string; variant: BadgeVariant; icon: typeof Clock3 }> = {
  available: { label: 'Disponível agora', variant: 'success', icon: CheckCircle2 },
  upcoming: { label: 'Em breve', variant: 'primary', icon: CalendarClock },
  outside_schedule: { label: 'Fora do horário', variant: 'warning', icon: Clock3 },
  paused: { label: 'Temporariamente pausado', variant: 'warning', icon: PauseCircle },
  expired: { label: 'Encerrado', variant: 'secondary', icon: Clock3 },
  revoked: { label: 'Acesso revogado', variant: 'destructive', icon: PauseCircle },
  redeemed: { label: 'Utilizado', variant: 'secondary', icon: TicketCheck },
  unavailable: { label: 'Indisponível', variant: 'secondary', icon: PauseCircle },
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
    custom: 'Benefício',
  }
  return labels[benefit.benefit_type] ?? 'Benefício'
}

function SummaryItem({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  )
}

export default function WalletPage({ wallet }: WalletPageProps) {
  const { passes, summary } = wallet

  return (
    <ConsumerFlowShell
      title="Minha carteira"
      description="Acessos e benefícios disponíveis para sua conta. A disponibilidade é confirmada novamente no momento da utilização."
      actions={
        <Button asChild variant="outline">
          <Link href="/wallet/history">
            <History aria-hidden="true" />
            Utilizações
          </Link>
        </Button>
      }
    >
      <Head title="Minha carteira">
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <section
        aria-label="Resumo da carteira"
        className="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <SummaryItem label="Edições" value={summary.passes} />
        <SummaryItem label="Benefícios" value={summary.benefits} />
        <SummaryItem label="Disponíveis" value={summary.available} />
        <SummaryItem label="Utilizações concluídas" value={summary.redeemed} />
      </section>

      {passes.length === 0 ? (
        <Card>
          <EmptyState
            headingLevel={2}
            icon={TicketCheck}
            title="Sua carteira ainda está vazia"
            description="Quando a operação conceder acesso a uma edição para sua conta, os benefícios aparecerão aqui."
          >
            <Button asChild variant="outline">
              <Link href="/cidades">Explorar estabelecimentos</Link>
            </Button>
          </EmptyState>
        </Card>
      ) : (
        <div className="space-y-6">
          {passes.map(({ edition, access, benefits }) => (
            <Card key={access.id}>
              <CardHeader className="flex-col sm:flex-row sm:items-start">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                    <MapPin className="size-3.5" aria-hidden="true" />
                    {edition.city.name} · {edition.city.state_code}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold tracking-tight">{edition.name}</h2>
                  {edition.description ? (
                    <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
                      {edition.description}
                    </p>
                  ) : null}
                </div>
                <dl className="shrink-0 text-sm sm:text-end">
                  <dt className="text-xs text-muted-foreground">Período de utilização</dt>
                  <dd className="mt-1 font-medium">
                    {formatDate(edition.usage_starts_at)} — {formatDate(edition.usage_ends_at)}
                  </dd>
                </dl>
              </CardHeader>

              <CardContent>
                {benefits.length === 0 ? (
                  <EmptyState
                    icon={null}
                    title="Nenhum benefício disponível nesta edição"
                    description="A carteira será atualizada quando houver uma oferta válida para este acesso."
                    className="py-7"
                  />
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {benefits.map((benefit) => {
                      const state = benefit.availability
                      const meta = stateMeta[state] ?? stateMeta.unavailable
                      const Icon = meta.icon
                      const remaining = Number(
                        benefit.remaining_redemptions ?? benefit.max_redemptions_per_access
                      )
                      const canUse =
                        state === 'available' && benefit.offer_id > 0 && benefit.access_id > 0

                      return (
                        <Card key={benefit.key} className="h-full bg-background">
                          <CardContent className="flex h-full flex-col p-5">
                            <div className="flex items-start justify-between gap-3">
                              <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground">
                                <Store className="size-4" aria-hidden="true" />
                              </span>
                              <Badge variant={meta.variant} appearance="light">
                                <Icon aria-hidden="true" />
                                {meta.label}
                              </Badge>
                            </div>

                            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.1em] text-primary">
                              {benefitLabel(benefit)}
                            </p>
                            <h3 className="mt-1 text-lg font-semibold">{benefit.title}</h3>
                            <p className="mt-1 text-sm font-medium text-muted-foreground">
                              {benefit.establishment.public_name || 'Estabelecimento participante'}
                            </p>
                            {benefit.description ? (
                              <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">
                                {benefit.description}
                              </p>
                            ) : null}

                            <div className="mt-auto pt-5">
                              {canUse ? (
                                <Button asChild variant="cta" size="lg" className="w-full">
                                  <Link
                                    href={`/wallet/accesses/${benefit.access_id}/offers/${benefit.offer_id}/use`}
                                  >
                                    <TicketCheck aria-hidden="true" />
                                    Usar benefício
                                  </Link>
                                </Button>
                              ) : (
                                <p className="rounded-md border bg-muted/40 px-3 py-2 text-center text-xs leading-5 text-muted-foreground">
                                  {state === 'redeemed'
                                    ? 'Todas as utilizações foram concluídas.'
                                    : 'Este benefício não pode ser apresentado agora.'}
                                </p>
                              )}
                              <p className="mt-2 text-center text-xs text-muted-foreground">
                                {remaining}{' '}
                                {remaining === 1 ? 'utilização restante' : 'utilizações restantes'}
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </ConsumerFlowShell>
  )
}
