import { Head, Link } from '@inertiajs/react'
import {
  ArrowLeft,
  Building2,
  ChartNoAxesColumn,
  Eye,
  MousePointerClick,
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
      label: 'Impressões',
      value: impressions,
      hint: 'Cards exibidos no catálogo',
      icon: Building2,
    },
    {
      label: 'Aberturas da ficha',
      value: views,
      hint: 'Visitas à página da unidade',
      icon: Eye,
    },
    {
      label: 'Ações de contato',
      value: conversions,
      hint: `${conversionRate.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% das visitas`,
      icon: MousePointerClick,
    },
    {
      label: 'Sessões únicas/dia',
      value: uniqueSessions,
      hint: 'Maior alcance diário no período',
      icon: UsersRound,
    },
  ]

  return (
    <MainLayout>
      <Head title="Analytics de descoberta" />

      <div className="space-y-6">
        <PageHeader
          eyebrow="Portal do parceiro"
          title="Analytics de descoberta"
          description="Alcance e ações públicas da organização, sem identificar visitantes."
          actions={
            <Button variant="outline" asChild>
              <Link href={`/portal/organizations/${dashboard.organization_id}`}>
                <ArrowLeft aria-hidden="true" className="size-4" />
                Voltar à organização
              </Link>
            </Button>
          }
        />

        <form className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4" method="get">
          <label className="grid gap-1 text-sm font-medium">
            De
            <input
              type="date"
              name="from"
              defaultValue={dashboard.from}
              max={dashboard.to}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Até
            <input
              type="date"
              name="to"
              defaultValue={dashboard.to}
              min={dashboard.from}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            />
          </label>
          <Button type="submit">Atualizar período</Button>
          <p className="basis-full text-xs text-muted-foreground sm:basis-auto">
            Os números são agregados por dia e respeitam a retenção definida pela plataforma.
          </p>
        </form>

        <section
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          aria-label="Resumo do período"
        >
          {cards.map(({ label, value, hint, icon: Icon }) => (
            <Card key={label}>
              <CardContent className="flex items-start justify-between gap-4 pt-6">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{label}</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight">
                    {compactNumber(value)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
                </div>
                <span className="rounded-md bg-primary/10 p-3 text-primary">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.8fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Descoberta ao longo do período</CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <div
                  className="h-[320px] w-full"
                  role="img"
                  aria-label="Gráfico diário de analytics"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ left: 0, right: 12 }}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} />
                      <Tooltip />
                      <Bar
                        dataKey="impressions"
                        name="Impressões"
                        fill="var(--color-primary)"
                        radius={4}
                      />
                      <Bar
                        dataKey="views"
                        name="Aberturas"
                        fill="var(--color-chart-2)"
                        radius={4}
                      />
                      <Bar
                        dataKey="conversions"
                        name="Ações"
                        fill="var(--color-chart-3)"
                        radius={4}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="min-h-64 rounded-md border border-dashed">
                  <EmptyState
                    icon={ChartNoAxesColumn}
                    title="Nenhum evento no período"
                    description="Ajuste o intervalo ou aguarde novas interações no catálogo."
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ações de contato</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                ['Como chegar', routeClicks],
                ['WhatsApp', whatsappClicks],
                ['Telefone', phoneClicks],
                ['Site', websiteClicks],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between rounded-lg border px-3 py-3"
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Route aria-hidden="true" className="size-4 text-muted-foreground" />
                    {label}
                  </span>
                  <strong>{compactNumber(Number(value))}</strong>
                </div>
              ))}
              <p className="pt-2 text-xs leading-5 text-muted-foreground">
                Cliques repetidos em uma janela curta são deduplicados para reduzir ruído e abuso.
              </p>
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Desempenho por unidade</CardTitle>
          </CardHeader>
          <CardContent>
            {dashboard.establishments.length > 0 ? (
              <div
                className="overflow-x-auto"
                role="region"
                aria-label="Desempenho por unidade"
                tabIndex={0}
              >
                <table className="w-full min-w-[720px] text-sm">
                  <caption className="sr-only">
                    Impressões, aberturas, ações e sessões de cada unidade no período selecionado.
                  </caption>
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th scope="col" className="px-3 py-3 font-medium">
                        Unidade
                      </th>
                      <th scope="col" className="px-3 py-3 text-right font-medium">
                        Impressões
                      </th>
                      <th scope="col" className="px-3 py-3 text-right font-medium">
                        Aberturas
                      </th>
                      <th scope="col" className="px-3 py-3 text-right font-medium">
                        Ações
                      </th>
                      <th scope="col" className="px-3 py-3 text-right font-medium">
                        Sessões
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.establishments.map((establishment) => (
                      <tr key={establishment.establishment_id} className="border-b last:border-0">
                        <td className="px-3 py-4">
                          <p className="font-medium">{establishment.public_name}</p>
                        </td>
                        <td className="px-3 py-4 text-right">
                          {compactNumber(establishment.impressions)}
                        </td>
                        <td className="px-3 py-4 text-right">
                          {compactNumber(establishment.views)}
                        </td>
                        <td className="px-3 py-4 text-right">
                          {compactNumber(establishment.conversions)}
                        </td>
                        <td className="px-3 py-4 text-right">
                          {compactNumber(establishment.unique_sessions)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-md border border-dashed">
                <EmptyState
                  icon={Building2}
                  title="Nenhum dado por unidade"
                  description="Nenhuma unidade recebeu eventos no período selecionado."
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}
