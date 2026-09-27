import { Head, Link } from '@inertiajs/react'
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  History,
  MapPin,
  PauseCircle,
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
    <Card className="h-full border border-border-subtle bg-card">
      {/* The number sits on the tile's floor, so a label that wraps on a phone
          ("Utilizações concluídas") does not lift its neighbour's number. */}
      <CardContent className="flex h-full flex-col justify-between p-4 sm:p-5">
        <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-muted-foreground">
          {label}
        </p>
        <p className="mt-2 font-display text-[2.5rem] font-extrabold leading-none tabular-nums">
          {value}
        </p>
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
        <Button asChild variant="outline" size="xl" shape="pill">
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
        <SummaryItem label="Acessos" value={summary.passes} />
        <SummaryItem label="Benefícios" value={summary.benefits} />
        <SummaryItem label="Disponíveis" value={summary.available} />
        <SummaryItem label="Utilizações concluídas" value={summary.redeemed} />
      </section>

      {passes.length === 0 ? (
        <Card className="border border-border-subtle bg-card">
          <EmptyState
            headingLevel={2}
            icon={TicketCheck}
            title="Sua carteira ainda está vazia"
            description="Após receber acesso a um pacote ou voucher avulso, os benefícios aparecerão aqui."
          >
            <Button asChild variant="outline" size="xl" shape="pill">
              <Link href="/cidades">Explorar lugares</Link>
            </Button>
          </EmptyState>
        </Card>
      ) : (
        <div className="space-y-6">
          {passes.map(({ edition, access, benefits }) => (
            <Card key={access.id} className="border border-border-subtle bg-card">
              <CardHeader className="gap-x-6">
                {/* The period sits beside the title while both fit and drops below it
                    otherwise; it stays start-aligned so the label and the dates line up
                    in either place. */}
                <div className="min-w-0 flex-[1_1_20rem]">
                  <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.1em] text-primary-accent">
                    <MapPin className="size-3.5" aria-hidden="true" />
                    {edition.city.name} · {edition.city.state_code}
                  </p>
                  <h2 className="mt-1.5 font-display text-[1.3125rem] font-extrabold leading-tight tracking-[-0.01em]">
                    {access.offer_id
                      ? 'Voucher avulso · ' + (benefits[0]?.title ?? edition.name)
                      : edition.name}
                  </h2>
                  {edition.description ? (
                    <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
                      {edition.description}
                    </p>
                  ) : null}
                </div>
                <dl className="shrink-0 text-sm">
                  <dt className="text-xs font-extrabold uppercase tracking-[0.1em] text-muted-foreground">
                    Período de utilização
                  </dt>
                  <dd className="mt-1 font-semibold">
                    {formatDate(access.usage_starts_at ?? edition.usage_starts_at)} —{' '}
                    {formatDate(access.usage_ends_at ?? edition.usage_ends_at)}
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
                        <Card
                          key={benefit.key}
                          className="relative h-full overflow-hidden border border-border-subtle bg-card"
                        >
                          {/* Direction A's ticket: a navy stub carries the benefit itself. */}
                          <div className="bg-primary px-5 pb-5 pt-4 text-primary-foreground">
                            <p className="text-xs font-extrabold uppercase tracking-[0.1em] opacity-85">
                              Benefício
                            </p>
                            <p className="mt-1 font-display text-[1.375rem] font-extrabold leading-tight">
                              {benefitLabel(benefit)}
                            </p>
                          </div>
                          <div
                            aria-hidden="true"
                            className="relative h-0 border-t-2 border-dashed border-border-subtle"
                          >
                            <span className="absolute -left-3 -top-3 size-6 rounded-full border border-border-subtle bg-card" />
                            <span className="absolute -right-3 -top-3 size-6 rounded-full border border-border-subtle bg-card" />
                          </div>
                          <CardContent className="flex flex-1 flex-col p-5">
                            <Badge
                              variant={meta.variant}
                              appearance="light"
                              shape="pill"
                              className="self-start"
                            >
                              <Icon aria-hidden="true" />
                              {meta.label}
                            </Badge>

                            <h3 className="mt-3 font-display text-lg font-extrabold leading-tight">
                              {benefit.title}
                            </h3>
                            <p className="mt-1 text-sm font-semibold text-muted-foreground">
                              {benefit.establishment.public_name || 'Lugar participante'}
                            </p>
                            {benefit.description ? (
                              <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">
                                {benefit.description}
                              </p>
                            ) : null}

                            <div className="mt-auto pt-5">
                              {canUse ? (
                                <Button
                                  asChild
                                  variant="cta"
                                  size="xl"
                                  shape="pill"
                                  className="w-full"
                                >
                                  <Link
                                    href={`/wallet/accesses/${benefit.access_id}/offers/${benefit.offer_id}/use`}
                                  >
                                    <TicketCheck aria-hidden="true" />
                                    Usar benefício
                                  </Link>
                                </Button>
                              ) : (
                                <p className="rounded-2xl border border-border-subtle bg-status-neutral px-4 py-3 text-center text-xs leading-5 text-status-neutral-foreground">
                                  {state === 'redeemed'
                                    ? 'Todas as utilizações foram concluídas.'
                                    : 'Este benefício não pode ser apresentado agora.'}
                                </p>
                              )}
                              <p className="mt-2 text-center text-xs font-semibold text-muted-foreground">
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
