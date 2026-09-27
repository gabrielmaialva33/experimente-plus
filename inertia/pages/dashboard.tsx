import { Head, Link } from '@inertiajs/react'
import {
  ArrowRight,
  Building2,
  FileText,
  Inbox,
  LayoutDashboard,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis } from 'recharts'

import { MetricCard } from '~/components/metric_card'
import { EmptyState } from '~/components/empty_state'
import { PageHeader } from '~/components/page_header'
import { Avatar, AvatarFallback } from '~/components/ui/avatar'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardHeading,
  CardTitle,
  CardToolbar,
} from '~/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '~/components/ui/chart'
import { useAuth } from '~/hooks/use_auth'
import { MainLayout } from '~/layouts'
import { globalRoleLabel } from '~/lib/labels'

interface DashboardStats {
  totals: { users: number; tenants: number; files: number; roles: number }
  signups: { month: string; users: number }[]
  recentUsers: {
    id: number
    full_name: string
    email: string
    created_at: string | null
    roles: string[]
  }[]
}

interface DashboardPageProps {
  stats: DashboardStats
}

const chartConfig = {
  users: { label: 'Novos usuários', color: 'var(--color-primary)' },
} satisfies ChartConfig

function initialsOf(name: string) {
  return name
    .split(' ')
    .map((part) => part.charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

/**
 * "Bom dia, Ana" by the hour in Brasília (audit W30). Without a name the
 * greeting stands alone instead of reading "Olá, por aqui".
 */
export function greetingFor(name: string | undefined, now = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat('pt-BR', {
      hour: 'numeric',
      hourCycle: 'h23',
      timeZone: 'America/Sao_Paulo',
    }).format(now)
  )
  const greeting =
    hour >= 5 && hour < 12 ? 'Bom dia' : hour >= 12 && hour < 18 ? 'Boa tarde' : 'Boa noite'
  const firstName = name?.trim().split(/\s+/)[0]
  return firstName ? `${greeting}, ${firstName}` : greeting
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    // The same day on the server render and in the browser (hydration).
    timeZone: 'America/Sao_Paulo',
  })
}

export default function DashboardPage({ stats }: DashboardPageProps) {
  const { user, activeTenant, can } = useAuth()
  const canListUsers = can('users.list')
  // The daily work of the operation starts on "Hoje"; this page is the long view (audit W13).
  const canOpenToday = Boolean(activeTenant) && can('establishments.list')

  return (
    <MainLayout>
      <Head title="Painel operacional" />

      <div className="space-y-6">
        <PageHeader
          eyebrow={greetingFor(user?.full_name)}
          icon={LayoutDashboard}
          title="Painel operacional"
          description={
            activeTenant
              ? `Acompanhe a atividade e os recursos da operação ${activeTenant.name}.`
              : 'Escolha uma operação ativa para visualizar os dados.'
          }
          actions={
            can('users.create') ? (
              <Button asChild variant="outline" size="lg" shape="pill">
                <Link href="/users/create">
                  <UserPlus aria-hidden="true" className="size-4" />
                  Adicionar usuário
                </Link>
              </Button>
            ) : undefined
          }
        />

        {canOpenToday ? (
          <section
            aria-labelledby="dashboard-today-heading"
            className="flex flex-col gap-4 rounded-card bg-chrome p-5 text-chrome-foreground sm:flex-row sm:items-center sm:justify-between sm:p-7"
          >
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-chrome-foreground/15">
                <Inbox aria-hidden="true" className="size-5" />
              </span>
              <div>
                <h2
                  id="dashboard-today-heading"
                  className="font-display text-xl font-extrabold tracking-[-0.01em]"
                >
                  O que pede atenção hoje
                </h2>
                <p className="mt-1 max-w-2xl text-sm text-chrome-muted">
                  Moderação, denúncias e prazos da operação em uma lista só. Comece o dia por lá;
                  este painel mostra a visão de longo prazo.
                </p>
              </div>
            </div>
            {/* Navigation, not conversion: the band speaks the sidebar's active-item colours,
                and orange stays for buying. */}
            <Button
              asChild
              variant="inverse"
              size="xl"
              shape="pill"
              className="shrink-0 bg-chrome-active text-chrome-active-foreground hover:bg-chrome-active/90 focus-visible:ring-offset-chrome"
            >
              <Link href="/backoffice/today">
                Abrir Hoje
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </Button>
          </section>
        ) : null}

        <section
          aria-label="Indicadores gerais"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <MetricCard
            label="Usuários na operação"
            value={stats.totals.users.toLocaleString('pt-BR')}
            icon={Users}
            href={canListUsers ? '/users' : undefined}
            linkLabel="Ver usuários"
          />
          <MetricCard
            label="Minhas operações"
            value={stats.totals.tenants.toLocaleString('pt-BR')}
            icon={Building2}
            tone="info"
          />
          <MetricCard
            label="Arquivos da operação"
            value={stats.totals.files.toLocaleString('pt-BR')}
            icon={FileText}
            tone="success"
            href={can('files.list') ? '/files' : undefined}
            linkLabel="Abrir arquivos"
          />
          <MetricCard
            label="Papéis globais"
            value={stats.totals.roles.toLocaleString('pt-BR')}
            icon={ShieldCheck}
            tone="warning"
            href={can('roles.list') ? '/roles' : undefined}
            linkLabel="Ver papéis"
          />
        </section>

        <section aria-label="Atividade recente" className="grid min-w-0 gap-5 xl:grid-cols-2">
          <Card className="min-w-0 overflow-hidden">
            <CardHeader>
              <CardHeading>
                <CardTitle className="font-display text-lg font-extrabold">
                  Novos usuários
                </CardTitle>
                <p className="text-sm text-muted-foreground">Cadastros nos últimos seis meses</p>
              </CardHeading>
            </CardHeader>
            <CardContent className="min-w-0 overflow-hidden">
              <ChartContainer
                config={chartConfig}
                className="h-[260px] min-w-0 w-full overflow-hidden aspect-auto"
              >
                <AreaChart data={stats.signups} margin={{ left: 4, right: 4 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    dataKey="users"
                    type="monotone"
                    fill="var(--color-users)"
                    fillOpacity={0.12}
                    stroke="var(--color-users)"
                    strokeWidth={2.25}
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card className="min-w-0 overflow-hidden">
            <CardHeader>
              <CardHeading>
                <CardTitle className="font-display text-lg font-extrabold">
                  Distribuição mensal
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Entradas registradas na operação ativa
                </p>
              </CardHeading>
            </CardHeader>
            <CardContent className="min-w-0 overflow-hidden">
              <ChartContainer
                config={chartConfig}
                className="h-[260px] min-w-0 w-full overflow-hidden aspect-auto"
              >
                <BarChart data={stats.signups} margin={{ left: 4, right: 4 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="users" fill="var(--color-users)" radius={[7, 7, 2, 2]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </section>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardHeading>
              <CardTitle className="font-display text-lg font-extrabold">
                Usuários recentes
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Pessoas adicionadas mais recentemente à operação
              </p>
            </CardHeading>
            {canListUsers && (
              <CardToolbar>
                <Button asChild variant="outline" size="md" shape="pill">
                  <Link href="/users">Ver todos</Link>
                </Button>
              </CardToolbar>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {stats.recentUsers.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Nenhum usuário nesta operação"
                description="Os usuários adicionados à operação aparecerão aqui."
              />
            ) : (
              <ul className="divide-y divide-border-subtle">
                {stats.recentUsers.map((recent) => (
                  <li
                    key={recent.id}
                    className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-accent/45"
                  >
                    <Avatar className="size-9">
                      <AvatarFallback className="bg-primary-soft font-bold text-primary-accent">
                        {initialsOf(recent.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{recent.full_name}</p>
                      <p className="truncate text-xs text-muted-foreground">{recent.email}</p>
                    </div>
                    <div className="hidden gap-1 sm:flex">
                      {recent.roles.length > 0 ? (
                        recent.roles.map((role) => (
                          <Badge
                            key={role}
                            variant="secondary"
                            appearance="light"
                            shape="pill"
                            size="sm"
                          >
                            {globalRoleLabel(role)}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">Sem papel</span>
                      )}
                    </div>
                    <span className="hidden text-xs text-muted-foreground md:block">
                      {formatDate(recent.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}
