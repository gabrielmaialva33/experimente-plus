import { Head, Link } from '@inertiajs/react'
import { Building2, FileText, LayoutDashboard, ShieldCheck, Users } from 'lucide-react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis } from 'recharts'

import { MetricCard } from '~/components/metric_card'
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

function firstNameOf(name: string | undefined): string {
  return name?.trim().split(/\s+/)[0] || 'por aqui'
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function DashboardPage({ stats }: DashboardPageProps) {
  const { user, activeTenant, can } = useAuth()
  const canListUsers = can('users.list')

  return (
    <MainLayout>
      <Head title="Visão geral" />

      <div className="space-y-7">
        <PageHeader
          eyebrow="Visão geral"
          icon={LayoutDashboard}
          title={`Olá, ${firstNameOf(user?.full_name)}`}
          description={
            activeTenant
              ? `Acompanhe a atividade e os recursos da operação ${activeTenant.name}.`
              : 'Escolha um espaço de trabalho ativo para visualizar os dados da operação.'
          }
          actions={
            can('users.create') ? (
              <Link href="/users/create">
                <Button variant="primary">Adicionar usuário</Button>
              </Link>
            ) : undefined
          }
        />

        <section
          aria-label="Indicadores gerais"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <MetricCard
            label="Usuários no espaço"
            value={stats.totals.users.toLocaleString('pt-BR')}
            icon={Users}
            href={canListUsers ? '/users' : undefined}
            linkLabel="Ver usuários"
          />
          <MetricCard
            label="Meus espaços"
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
          <Card className="min-w-0 overflow-hidden border-border/70 shadow-xs">
            <CardHeader>
              <CardHeading>
                <CardTitle>Novos usuários</CardTitle>
                <p className="text-sm text-muted-foreground">Cadastros nos últimos seis meses</p>
              </CardHeading>
            </CardHeader>
            <CardContent className="min-w-0 overflow-hidden">
              <ChartContainer
                config={chartConfig}
                className="h-[260px] min-w-0 w-full overflow-hidden aspect-auto"
              >
                <AreaChart data={stats.signups} margin={{ left: 4, right: 4 }}>
                  <defs>
                    <linearGradient id="fillUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-users)" stopOpacity={0.32} />
                      <stop offset="95%" stopColor="var(--color-users)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    dataKey="users"
                    type="monotone"
                    fill="url(#fillUsers)"
                    stroke="var(--color-users)"
                    strokeWidth={2.25}
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card className="min-w-0 overflow-hidden border-border/70 shadow-xs">
            <CardHeader>
              <CardHeading>
                <CardTitle>Distribuição mensal</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Entradas registradas no espaço de trabalho ativo
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

        <Card className="overflow-hidden border-border/70 shadow-xs">
          <CardHeader>
            <CardHeading>
              <CardTitle>Usuários recentes</CardTitle>
              <p className="text-sm text-muted-foreground">
                Pessoas adicionadas mais recentemente à operação
              </p>
            </CardHeading>
            {canListUsers && (
              <CardToolbar>
                <Link href="/users">
                  <Button variant="outline" size="sm">
                    Ver todos
                  </Button>
                </Link>
              </CardToolbar>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {stats.recentUsers.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">
                Ainda não há usuários neste espaço de trabalho.
              </p>
            ) : (
              <ul className="divide-y divide-border/70">
                {stats.recentUsers.map((recent) => (
                  <li
                    key={recent.id}
                    className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-accent/45"
                  >
                    <Avatar className="size-9">
                      <AvatarFallback className="bg-primary/10 text-primary">
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
                          <Badge key={role} variant="secondary" appearance="light" size="sm">
                            {role}
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
