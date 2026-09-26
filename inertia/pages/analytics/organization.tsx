import { Head, Link } from '@inertiajs/react'
import {
  ArrowLeft,
  Building2,
  ChartNoAxesColumn,
  Eye,
  Globe,
  MessageCircle,
  MousePointerClick,
  Phone,
  Route,
  UsersRound,
} from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { MainLayout } from '~/layouts/main_layout'
import { EmptyState } from '~/components/empty_state'
import { PageHeader } from '~/components/page_header'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'

interface MetricTotal {
  event_type: string
  event_count: number
  unique_sessions: number
}

interface MetricDay {
  date: string
  impressions: number
  views: number
  conversions: number
  unique_sessions: number
}

interface EstablishmentSummary {
  establishment_id: number
  public_name: string
  slug: string
  impressions: number
  views: number
  conversions: number
  unique_sessions: number
}

interface OrganizationDashboard {
  organization_id: number
  from: string
  to: string
  totals: MetricTotal[]
  timeseries: MetricDay[]
  establishments: EstablishmentSummary[]
}

interface OrganizationAnalyticsProps {
  dashboard: OrganizationDashboard
}

function compactNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    notation: value >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value)
}

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}

/** The chart's series, shared by the bars and the legend so they cannot drift (W24). */
const CHART_SERIES = [
  { key: 'impressions', label: 'Vezes que apareceu', color: 'var(--color-primary)' },
  { key: 'views', label: 'Visitas à página', color: 'var(--chart-2)' },
  { key: 'conversions', label: 'Contatos', color: 'var(--chart-4)' },
] as const

function metricCount(dashboard: OrganizationDashboard, eventType: string): number {
  return dashboard.totals.find((metric) => metric.event_type === eventType)?.event_count ?? 0
}

export default function OrganizationAnalytics({ dashboard }: OrganizationAnalyticsProps) {
  const impressions = metricCount(dashboard, 'catalog_impression')
  const views = metricCount(dashboard, 'establishment_view')
  const routeClicks = metricCount(dashboard, 'route_click')
  const whatsappClicks = metricCount(dashboard, 'whatsapp_click')
  const phoneClicks = metricCount(dashboard, 'phone_click')
  const websiteClicks = metricCount(dashboard, 'website_click')
  const conversions = routeClicks + whatsappClicks + phoneClicks + websiteClicks
  const uniqueSessions = Math.max(0, ...dashboard.timeseries.map((day) => day.unique_sessions))
  const conversionRate = views > 0 ? (conversions / views) * 100 : 0
  const chartData = dashboard.timeseries.map((day) => ({
    ...day,
    label: dateLabel(day.date),
  }))

  const cards = [
    {
      label: 'Vezes que apareceu',
      value: impressions,
      hint: 'Seus lugares na busca e nas listas',
      icon: Building2,
    },
    {
      label: 'Visitas à página',
      value: views,
      hint: 'Páginas dos lugares abertas',
      icon: Eye,
    },
    {
      label: 'Contatos',
      value: conversions,
      hint: `${conversionRate.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% das visitas`,
      icon: MousePointerClick,
    },
    {
      label: 'Pico de visitantes',
      value: uniqueSessions,
      hint: 'Sessões no dia de maior alcance',
      icon: UsersRound,
    },
  ]

  return (
    <MainLayout>
      <Head title="Desempenho da descoberta" />

      <div className="space-y-6">
        <PageHeader
          title="Desempenho da descoberta"
          description="Quantas vezes seus lugares apareceram no app e no site e o que as pessoas fizeram em seguida. Ninguém é identificado."
          actions={
            <Button variant="ghost" size="lg" shape="pill" asChild>
              <Link href={`/portal/organizations/${dashboard.organization_id}`}>
                <ArrowLeft aria-hidden="true" className="size-4" />
                Voltar à organização
              </Link>
            </Button>
          }
        />

        <form
          className="flex flex-wrap items-end gap-3 rounded-card border border-border-subtle bg-card p-4 sm:p-5"
          method="get"
          aria-label="Período"
        >
          <label className="grid gap-1.5 text-sm font-bold">
            De
            <input
              type="date"
              name="from"
              defaultValue={dashboard.from}
              max={dashboard.to}
              className="h-11 rounded-full border border-input bg-background px-4 text-sm font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-bold">
            Até
            <input
              type="date"
              name="to"
              defaultValue={dashboard.to}
              min={dashboard.from}
              className="h-11 rounded-full border border-input bg-background px-4 text-sm font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <Button type="submit" variant="outline" size="lg" shape="pill">
            Atualizar período
          </Button>
          <p className="basis-full text-xs text-muted-foreground sm:basis-auto">
            Números somados por dia.
          </p>
        </form>

        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Resumo do período">
          {cards.map(({ label, value, hint, icon: Icon }) => (
            <article
              key={label}
              className="min-w-0 rounded-card border border-border-subtle bg-card p-4 sm:p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-muted-foreground">{label}</p>
                <span className="hidden rounded-xl bg-primary/10 p-2.5 text-primary sm:block">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
              </div>
              <p className="mt-1 font-display text-3xl font-extrabold tabular-nums tracking-[-0.02em] sm:text-4xl">
                {compactNumber(value)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.8fr)]">
          <Card className="rounded-card border-border-subtle">
            <CardHeader>
              <CardTitle className="font-display text-lg font-bold">Dia a dia</CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <>
                  <ul
                    aria-label="Legenda do gráfico"
                    className="mb-4 flex flex-wrap gap-x-5 gap-y-2"
                  >
                    {CHART_SERIES.map((series) => (
                      <li
                        key={series.key}
                        className="flex items-center gap-2 text-sm font-semibold"
                      >
                        <span
                          aria-hidden="true"
                          className="size-3 rounded-full"
                          style={{ background: series.color }}
                        />
                        {series.label}
                      </li>
                    ))}
                  </ul>
                  <div
                    className="h-[300px] w-full"
                    role="img"
                    aria-label={`Barras por dia com ${CHART_SERIES.map((series) => series.label.toLowerCase()).join(', ')}`}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ left: 0, right: 12 }}>
                        <CartesianGrid
                          vertical={false}
                          strokeDasharray="3 3"
                          stroke="var(--border)"
                        />
                        <XAxis
                          dataKey="label"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                        />
                        <YAxis
                          allowDecimals={false}
                          tickLine={false}
                          axisLine={false}
                          width={36}
                          tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                        />
                        <Tooltip cursor={{ fill: 'var(--color-muted)' }} />
                        {CHART_SERIES.map((series) => (
                          <Bar
                            key={series.key}
                            dataKey={series.key}
                            name={series.label}
                            fill={series.color}
                            radius={4}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <div className="min-h-64 rounded-2xl border border-dashed border-border">
                  <EmptyState
                    icon={ChartNoAxesColumn}
                    title="Nenhum movimento no período"
                    description="Escolha outro período ou volte depois que seus lugares aparecerem mais no app e no site."
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-card border-border-subtle">
            <CardHeader>
              <CardTitle className="font-display text-lg font-bold">Contatos por canal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {(
                [
                  ['Como chegar', routeClicks, Route],
                  ['WhatsApp', whatsappClicks, MessageCircle],
                  ['Telefone', phoneClicks, Phone],
                  ['Site', websiteClicks, Globe],
                ] as const
              ).map(([label, value, Icon]) => (
                <div
                  key={label}
                  className="flex items-center justify-between rounded-2xl bg-background px-4 py-3"
                >
                  <span className="flex items-center gap-2.5 text-sm font-semibold">
                    <Icon aria-hidden="true" className="size-4 text-primary" />
                    {label}
                  </span>
                  <strong className="font-display text-lg tabular-nums">
                    {compactNumber(value)}
                  </strong>
                </div>
              ))}
              <p className="pt-2 text-xs leading-5 text-muted-foreground">
                Toques repetidos em pouco tempo contam uma vez só.
              </p>
            </CardContent>
          </Card>
        </section>

        <Card className="rounded-card border-border-subtle">
          <CardHeader>
            <CardTitle className="font-display text-lg font-bold">Desempenho por lugar</CardTitle>
          </CardHeader>
          <CardContent>
            {dashboard.establishments.length > 0 ? (
              <div
                className="overflow-x-auto"
                role="region"
                aria-label="Desempenho por lugar"
                tabIndex={0}
              >
                <table className="w-full min-w-[640px] text-sm">
                  <caption className="sr-only">
                    Vezes que apareceu, visitas, contatos e sessões de cada lugar no período.
                  </caption>
                  <thead>
                    <tr className="border-b border-border-subtle text-left text-xs uppercase tracking-[0.1em] text-muted-foreground">
                      <th scope="col" className="px-3 py-3 font-bold">
                        Lugar
                      </th>
                      <th scope="col" className="px-3 py-3 text-right font-bold">
                        Apareceu
                      </th>
                      <th scope="col" className="px-3 py-3 text-right font-bold">
                        Visitas
                      </th>
                      <th scope="col" className="px-3 py-3 text-right font-bold">
                        Contatos
                      </th>
                      <th scope="col" className="px-3 py-3 text-right font-bold">
                        Sessões
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.establishments.map((establishment) => (
                      <tr
                        key={establishment.establishment_id}
                        className="border-b border-border-subtle last:border-0"
                      >
                        <th scope="row" className="px-3 py-4 text-left font-display font-bold">
                          {establishment.public_name}
                        </th>
                        <td className="px-3 py-4 text-right tabular-nums">
                          {compactNumber(establishment.impressions)}
                        </td>
                        <td className="px-3 py-4 text-right tabular-nums">
                          {compactNumber(establishment.views)}
                        </td>
                        <td className="px-3 py-4 text-right tabular-nums">
                          {compactNumber(establishment.conversions)}
                        </td>
                        <td className="px-3 py-4 text-right tabular-nums">
                          {compactNumber(establishment.unique_sessions)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border">
                <EmptyState
                  icon={Building2}
                  title="Nenhum dado por lugar"
                  description="Nenhum lugar recebeu visitas no período escolhido."
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}
