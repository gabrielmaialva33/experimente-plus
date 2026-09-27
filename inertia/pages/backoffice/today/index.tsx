import { Head, Link } from '@inertiajs/react'
import { Inbox } from 'lucide-react'

import { EmptyState } from '~/components/empty_state'
import { PageHeader } from '~/components/page_header'
import { Badge } from '~/components/ui/badge'
import { TaskCard } from '~/components/ui/task-card'
import { MainLayout } from '~/layouts/main_layout'
import {
  reportReasonLabels,
  reportTargetLabels,
  type ReportReason,
  type ReportTargetType,
} from '~/lib/content_reports'
import type { PartnerContentPath } from '~/lib/partner_content'
import { dayMonthLabel, receivedLabel, todayOverline } from '~/lib/today'
import { cn } from '~/lib/utils'
import type { PlatformAccess } from '~/types'

type InboxItem =
  | {
      source: 'report'
      id: number
      target_type: ReportTargetType
      title: string | null
      establishment_name: string | null
      reason: ReportReason
      origin: 'user' | 'automatic'
      is_anonymous: boolean
      received_at: string | null
      due_at: string | null
      overdue: boolean
    }
  | {
      source: 'content'
      id: number
      kind: PartnerContentPath
      title: string
      establishment_name: string | null
      received_at: string | null
      due_at: null
      overdue: false
    }
  | {
      source: 'revision'
      id: number
      public_name: string | null
      organization_name: string | null
      received_at: string | null
      due_at: null
      overdue: false
    }

type BackofficeTodayProps = {
  platform_access: PlatformAccess
  counts: {
    revisions: number
    content: Record<PartnerContentPath, number>
    reports: number
    overdue_reports: number
    feedback: number | null
  }
  inbox: InboxItem[]
}

const CONTENT_KIND_TYPE: Record<PartnerContentPath, string> = {
  'experiences': 'Experiência',
  'events': 'Evento',
  'showcase-items': 'Vitrine',
}

const CONTENT_KIND_COUNT: Record<PartnerContentPath, [one: string, many: string]> = {
  'experiences': ['experiência', 'experiências'],
  'events': ['evento', 'eventos'],
  'showcase-items': ['item de vitrine', 'itens de vitrine'],
}

function plural(count: number, one: string, many: string) {
  return count === 1 ? `1 ${one}` : `${count} ${many}`
}

/** How the inbox names each row: its type, what it is, where it came from and where to act. */
function describe(item: InboxItem) {
  switch (item.source) {
    case 'report': {
      const target = reportTargetLabels[item.target_type]
      return {
        type: 'Denúncia',
        // Attention with a deadline, not conversion: orange (cta) is for buying.
        tone: 'warning' as const,
        title: item.title ?? [target, item.establishment_name].filter(Boolean).join(' · '),
        detail: reportReasonLabels[item.reason],
        origin:
          item.origin === 'automatic'
            ? 'Moderação automática'
            : item.is_anonymous
              ? 'Pessoa anônima'
              : 'Pessoa identificada',
        href: '/backoffice/reports',
      }
    }
    case 'content':
      return {
        type: CONTENT_KIND_TYPE[item.kind],
        tone: 'info' as const,
        title: item.title,
        detail: null,
        origin: item.establishment_name ?? 'Parceiro',
        href: `/backoffice/content?kind=${item.kind}`,
      }
    case 'revision':
      return {
        type: 'Dados do lugar',
        tone: 'primary' as const,
        title: item.public_name ?? 'Lugar sem nome',
        detail: null,
        origin: item.organization_name ?? 'Parceiro',
        href: `/backoffice/moderation/${item.id}`,
      }
  }
}

export default function BackofficeTodayPage({ counts, inbox }: BackofficeTodayProps) {
  const now = new Date()
  const contentTotal = Object.values(counts.content).reduce((sum, count) => sum + count, 0)
  const contentBreakdown = (Object.keys(CONTENT_KIND_COUNT) as PartnerContentPath[])
    .filter((path) => counts.content[path] > 0)
    .map((path) => plural(counts.content[path], ...CONTENT_KIND_COUNT[path]))
    .join(' · ')

  return (
    <MainLayout>
      <Head title="Hoje" />

      <div className="space-y-7">
        <PageHeader eyebrow={todayOverline(now)} title="O que resolver hoje" />

        <section
          aria-label="Pendências de hoje"
          className={cn(
            'grid gap-4.5 sm:grid-cols-2',
            counts.feedback === null ? 'xl:grid-cols-3' : 'xl:grid-cols-4'
          )}
        >
          <TaskCard
            title="Dados de lugares para revisar"
            value={counts.revisions}
            tone={counts.revisions > 0 ? 'primary' : 'muted'}
            description={
              counts.revisions > 0
                ? 'Unidades esperando a aprovação da operação.'
                : 'Nenhuma revisão esperando.'
            }
            href="/backoffice/moderation"
            actionLabel="Revisar dados"
            className="min-h-40"
          />
          <TaskCard
            title="Conteúdo em análise"
            value={contentTotal}
            tone={contentTotal > 0 ? 'primary' : 'muted'}
            description={contentTotal > 0 ? contentBreakdown : 'Nada em análise.'}
            href="/backoffice/content"
            actionLabel="Revisar conteúdo"
            className="min-h-40"
          />
          <TaskCard
            title="Denúncias pendentes"
            value={counts.reports}
            tone={counts.reports > 0 ? 'primary' : 'muted'}
            href="/backoffice/reports"
            actionLabel="Revisar denúncias"
            className="min-h-40"
          >
            <p
              className={cn(
                'text-sm font-bold',
                counts.overdue_reports > 0 ? 'text-destructive-accent' : 'text-success-accent'
              )}
            >
              {counts.overdue_reports > 0
                ? `${plural(counts.overdue_reports, 'fora do prazo', 'fora do prazo')}`
                : 'Nenhuma fora do prazo'}
            </p>
          </TaskCard>
          {counts.feedback !== null ? (
            <TaskCard
              title="Feedback do piloto"
              value={counts.feedback}
              tone={counts.feedback > 0 ? 'primary' : 'muted'}
              description={
                counts.feedback > 0 ? 'Enviado por parceiros durante o piloto.' : 'Nada novo.'
              }
              href="/backoffice/feedback?status=new"
              actionLabel="Ler feedback"
              className="min-h-40"
            />
          ) : null}
        </section>

        <section
          aria-labelledby="inbox-heading"
          className="rounded-card border border-border-subtle bg-card p-4 sm:p-6"
        >
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
            <h2
              id="inbox-heading"
              className="font-display text-[1.3125rem] font-extrabold tracking-[-0.01em]"
            >
              Caixa de moderação
            </h2>
            <p className="text-sm text-muted-foreground">
              O prazo mais curto primeiro; cada fila guarda o restante.
            </p>
          </div>

          {inbox.length === 0 ? (
            <EmptyState
              headingLevel={3}
              icon={Inbox}
              title="Nada para resolver agora"
              description="Dados de lugares, conteúdo de parceiros e denúncias aparecem aqui assim que chegam."
            />
          ) : (
            <table className="mt-3 w-full border-collapse text-[0.9375rem]">
              <thead>
                <tr className="text-left text-xs font-extrabold uppercase tracking-[0.06em] text-muted-foreground">
                  <th
                    scope="col"
                    className="hidden border-b border-border-subtle px-3 py-2.5 sm:table-cell"
                  >
                    Tipo
                  </th>
                  <th scope="col" className="border-b border-border-subtle px-2 py-2.5 sm:px-3">
                    Item
                  </th>
                  <th
                    scope="col"
                    className="hidden border-b border-border-subtle px-3 py-2.5 md:table-cell"
                  >
                    Origem
                  </th>
                  <th
                    scope="col"
                    className="hidden border-b border-border-subtle px-3 py-2.5 lg:table-cell"
                  >
                    Recebido
                  </th>
                  <th
                    scope="col"
                    className="hidden border-b border-border-subtle px-3 py-2.5 sm:table-cell"
                  >
                    Prazo
                  </th>
                  <th scope="col" className="border-b border-border-subtle px-3 py-2.5">
                    <span className="sr-only">Ação</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {inbox.map((item) => {
                  const row = describe(item)
                  const received = receivedLabel(item.received_at, now)
                  const due = dayMonthLabel(item.due_at)
                  const type = (className: string) => (
                    <Badge
                      variant={row.tone}
                      appearance="light"
                      shape="pill"
                      size="lg"
                      className={cn('whitespace-nowrap text-[0.8125rem] font-extrabold', className)}
                    >
                      {row.type}
                    </Badge>
                  )

                  return (
                    <tr
                      key={`${item.source}-${item.id}`}
                      className="border-b border-border-subtle last:border-0"
                    >
                      <td className="hidden px-3 py-3 align-middle sm:table-cell">{type('')}</td>
                      <td className="px-2 py-3 align-middle sm:px-3">
                        {/* On a phone the type rides above the item instead of taking a column. */}
                        {type('mb-1.5 sm:hidden')}
                        <p className="font-semibold">{row.title}</p>
                        {row.detail ? (
                          <p className="text-sm text-muted-foreground">{row.detail}</p>
                        ) : null}
                        <p className="text-sm text-muted-foreground md:hidden">{row.origin}</p>
                        {due ? (
                          <p
                            className={cn(
                              'text-sm sm:hidden',
                              item.overdue
                                ? 'font-bold text-destructive-accent'
                                : 'text-muted-foreground'
                            )}
                          >
                            {item.overdue ? `Venceu ${due}` : `Prazo ${due}`}
                          </p>
                        ) : null}
                      </td>
                      <td className="hidden px-3 py-3 align-middle text-muted-foreground md:table-cell">
                        {row.origin}
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-3 align-middle text-muted-foreground lg:table-cell">
                        {received ?? '—'}
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-3 align-middle sm:table-cell">
                        {item.overdue ? (
                          <Badge
                            variant="destructive"
                            appearance="light"
                            shape="pill"
                            size="lg"
                            className="text-[0.8125rem] font-extrabold"
                          >
                            Venceu {due}
                          </Badge>
                        ) : due ? (
                          due
                        ) : (
                          <span className="text-muted-foreground">
                            <span aria-hidden="true">—</span>
                            <span className="sr-only">Sem prazo</span>
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right align-middle">
                        <Link
                          href={row.href}
                          className="inline-flex h-10 items-center rounded-full border-[1.5px] border-primary px-4 font-bold text-primary transition-colors hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card motion-reduce:transition-none"
                        >
                          Revisar<span className="sr-only">: {row.title}</span>
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </MainLayout>
  )
}
