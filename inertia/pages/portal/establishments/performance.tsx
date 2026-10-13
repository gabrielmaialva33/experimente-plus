import { Head, Link } from '@inertiajs/react'
import {
  ArrowLeft,
  BarChart3,
  Building2,
  CircleAlert,
  Eye,
  Globe,
  Heart,
  MessageCircle,
  Phone,
  Receipt,
  Route,
  Search,
  Star,
  TicketPercent,
  UserPlus,
  type LucideIcon,
} from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { PageHeader } from '~/components/page_header'
import { PerformanceChange, PerformanceStat } from '~/components/portal/performance_stat'
import { Button } from '~/components/ui/button'
import { MainLayout } from '~/layouts/main_layout'
import {
  CLICK_CHANNEL_LABELS,
  PERFORMANCE_PERIOD_LABELS,
  describeChange,
  describeRatingChange,
  formatCount,
  formatDay,
  formatDayRange,
  formatEstimate,
  formatRating,
  formatTicket,
  hasActivity,
  performancePath,
  type EstablishmentPerformance,
  type PerformanceClickChannel,
} from '~/lib/performance'
import { cn } from '~/lib/utils'

const CLICK_ICONS: Record<PerformanceClickChannel, LucideIcon> = {
  route: Route,
  whatsapp: MessageCircle,
  phone: Phone,
  website: Globe,
}

function SectionTitle({
  id,
  title,
  description,
}: {
  id: string
  title: string
  description?: string
}) {
  return (
    <div>
      <h2 id={id} className="font-display text-lg font-bold tracking-[-0.01em]">
        {title}
      </h2>
      {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
    </div>
  )
}

function EstimateStat({ performance }: { performance: EstablishmentPerformance }) {
  const { estimate, establishment } = performance
  const placeData = `/portal/establishments/${establishment.id}`

  if (estimate.status === 'available') {
    return (
      <PerformanceStat
        label="Venda estimada"
        value={formatEstimate(estimate.current_cents)}
        icon={Receipt}
        change={describeChange(estimate.current_cents, estimate.previous_cents, formatEstimate)}
        hint={`Estimativa: benefícios utilizados × ticket médio de ${formatTicket(estimate.average_ticket_cents)} informado pelo lugar. Não é o faturamento real.`}
      />
    )
  }

  const message =
    estimate.status === 'pending_review'
      ? 'O ticket médio informado entra na conta quando a nova versão dos dados do lugar for aprovada.'
      : estimate.field_available
        ? 'Preencha o ticket médio nos dados do lugar para ver quanto os benefícios utilizados representam em vendas.'
        : 'A categoria deste lugar ainda não tem o campo Ticket médio. Fale com a equipe do Experimente+ para incluir.'

  return (
    <PerformanceStat label="Venda estimada" icon={Receipt}>
      <p className="mt-2 text-sm leading-6 text-foreground">{message}</p>
      {estimate.status === 'missing' && estimate.field_available ? (
        <Button asChild variant="outline" size="md" shape="pill" className="mt-3 self-start">
          <Link href={`${placeData}#attributes`}>Preencher o ticket médio</Link>
        </Button>
      ) : null}
      {estimate.status === 'pending_review' ? (
        <Button asChild variant="ghost" size="md" shape="pill" className="mt-3 self-start">
          <Link href={placeData}>Ver dados do lugar</Link>
        </Button>
      ) : null}
    </PerformanceStat>
  )
}

function DailyViews({ performance }: { performance: EstablishmentPerformance }) {
  const total = performance.trend.reduce((sum, day) => sum + day.views, 0)
  if (total === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
        Nenhuma visita à página do lugar neste período.
      </p>
    )
  }

  const peak = performance.trend.reduce((best, day) => (day.views > best.views ? day : best))
  const data = performance.trend.map((day) => ({ ...day, label: formatDay(day.date) }))

  return (
    <div
      className="h-44 w-full"
      role="img"
      aria-label={`Visitas à página por dia: ${formatCount(total)} no período, com o maior número em ${formatDay(peak.date)} (${formatCount(peak.views)}).`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 0, right: 8, top: 4 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            minTickGap={16}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            width={32}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
          />
          <Tooltip cursor={{ fill: 'var(--color-muted)' }} />
          <Bar
            dataKey="views"
            name="Visitas à página"
            fill="var(--color-primary)"
            radius={3}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** "Desempenho" of one place: what the partner shows when deciding to renew. */
export default function EstablishmentPerformancePage(performance: EstablishmentPerformance) {
  const { establishment, period, periods, edition, metrics } = performance
  const active = hasActivity(performance)
  const reviewAverage = metrics.reviews.average

  return (
    <MainLayout>
      <Head title={`Desempenho · ${establishment.name}`} />

      <div className="space-y-7">
        <PageHeader
          eyebrow="Desempenho"
          icon={BarChart3}
          title={establishment.name}
          description="Como o lugar foi encontrado e usado no app e no site. Números somados por dia, sem identificar ninguém."
          actions={
            <>
              <Button asChild variant="ghost" size="lg" shape="pill">
                <Link href={`/portal/establishments/${establishment.id}`}>
                  <ArrowLeft aria-hidden="true" className="size-4" />
                  Dados do lugar
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" shape="pill">
                <Link href={`/organizations/${establishment.organization_id}/analytics`}>
                  <Building2 aria-hidden="true" className="size-4" />
                  Desempenho da organização
                </Link>
              </Button>
            </>
          }
        />

        <section aria-labelledby="performance-period" className="space-y-3">
          <h2 id="performance-period" className="sr-only">
            Período
          </h2>
          <nav
            aria-label="Período"
            className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1 sm:inline-flex sm:rounded-full"
          >
            {periods.map((key) => (
              <Link
                key={key}
                href={performancePath(establishment.id, key)}
                preserveScroll
                aria-current={period.key === key ? 'page' : undefined}
                className={cn(
                  'inline-flex h-10 items-center justify-center whitespace-nowrap rounded-full px-3 text-[0.8125rem] transition-colors pointer-coarse:h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-muted motion-reduce:transition-none sm:px-4.5 sm:text-[0.9375rem]',
                  period.key === key
                    ? 'bg-primary font-bold text-primary-foreground'
                    : 'font-semibold text-foreground hover:bg-background'
                )}
              >
                {PERFORMANCE_PERIOD_LABELS[key]}
              </Link>
            ))}
          </nav>
          <p className="text-sm text-muted-foreground">
            <strong className="font-semibold text-foreground">
              {formatDayRange(period.from, period.to)}
            </strong>
            {period.key === 'current_edition' && edition ? ` · ${edition.name}` : null}
            <br />
            Comparado com {formatDayRange(period.previous_from, period.previous_to)}
            {period.key === 'current_month' ? ', os mesmos dias do mês anterior.' : '.'}
          </p>
        </section>

        {!establishment.published ? (
          <p
            role="note"
            className="flex items-start gap-2 rounded-2xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning-accent"
          >
            <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            Este lugar ainda não está publicado. Aparições, visitas e contatos começam a contar
            quando ele aparecer no app e no site.
          </p>
        ) : !active ? (
          <p
            role="status"
            className="rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground"
          >
            Ainda não há movimento neste período. Os números aparecem conforme as pessoas encontram
            o lugar no app e no site.
          </p>
        ) : null}

        <section aria-labelledby="performance-benefits" className="space-y-3">
          <SectionTitle
            id="performance-benefits"
            title="Benefícios e avaliações"
            description="O que as pessoas fizeram no lugar."
          />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <PerformanceStat
              label="Benefícios utilizados"
              value={formatCount(metrics.redemptions.current)}
              icon={TicketPercent}
              change={describeChange(metrics.redemptions.current, metrics.redemptions.previous)}
              hint="Utilizações confirmadas no balcão."
            />
            <EstimateStat performance={performance} />
            <PerformanceStat
              label="Avaliações recebidas"
              value={formatCount(metrics.reviews.count.current)}
              icon={Star}
              change={describeChange(metrics.reviews.count.current, metrics.reviews.count.previous)}
            >
              <div className="mt-2 border-t border-border-subtle pt-2">
                <p className="text-sm font-semibold">
                  {reviewAverage.current === null
                    ? 'Sem nota média no período'
                    : `Nota média ${formatRating(reviewAverage.current)} de 5`}
                </p>
                {reviewAverage.current !== null || reviewAverage.previous !== null ? (
                  <PerformanceChange
                    change={describeRatingChange(reviewAverage.current, reviewAverage.previous)}
                  />
                ) : null}
              </div>
            </PerformanceStat>
          </div>
        </section>

        <section aria-labelledby="performance-discovery" className="space-y-3">
          <SectionTitle
            id="performance-discovery"
            title="Descoberta"
            description="Quantas vezes o lugar foi visto e lembrado."
          />
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <PerformanceStat
              label="Aparições na busca"
              value={formatCount(metrics.impressions.current)}
              icon={Search}
              change={describeChange(metrics.impressions.current, metrics.impressions.previous)}
            />
            <PerformanceStat
              label="Visitas à página do lugar"
              value={formatCount(metrics.views.current)}
              icon={Eye}
              change={describeChange(metrics.views.current, metrics.views.previous)}
            />
            <PerformanceStat
              label="Novos seguidores"
              value={formatCount(metrics.new_followers.current)}
              icon={UserPlus}
              change={describeChange(metrics.new_followers.current, metrics.new_followers.previous)}
            />
            <PerformanceStat
              label="Novos favoritos"
              value={formatCount(metrics.new_favorites.current)}
              icon={Heart}
              change={describeChange(metrics.new_favorites.current, metrics.new_favorites.previous)}
            />
          </div>
        </section>

        <section aria-labelledby="performance-contacts" className="space-y-3">
          <SectionTitle
            id="performance-contacts"
            title="Contatos"
            description="Toques nos botões da página do lugar. Toques repetidos em pouco tempo contam uma vez só."
          />
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {metrics.clicks.map((click) =>
              !click.published && click.current === 0 && click.previous === 0 ? (
                <PerformanceStat
                  key={click.channel}
                  label={CLICK_CHANNEL_LABELS[click.channel]}
                  value="—"
                  icon={CLICK_ICONS[click.channel]}
                  hint="Este contato não aparece na página do lugar."
                />
              ) : (
                <PerformanceStat
                  key={click.channel}
                  label={CLICK_CHANNEL_LABELS[click.channel]}
                  value={formatCount(click.current)}
                  icon={CLICK_ICONS[click.channel]}
                  change={describeChange(click.current, click.previous)}
                />
              )
            )}
          </div>
        </section>

        <section
          aria-labelledby="performance-daily"
          className="space-y-3 rounded-card border border-border-subtle bg-card p-4 sm:p-5"
        >
          <SectionTitle id="performance-daily" title="Visitas por dia" />
          <DailyViews performance={performance} />
        </section>
      </div>
    </MainLayout>
  )
}
