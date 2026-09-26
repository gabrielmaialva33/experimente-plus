import { Head, Link, router } from '@inertiajs/react'
import { AlertTriangle, Flag } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { ContentReportCard } from '~/components/backoffice/content_report_card'
import { EmptyState } from '~/components/empty_state'
import { buildPageHref, PaginationNav } from '~/components/pagination'
import { PageHeader } from '~/components/page_header'
import {
  EditorField,
  editorSelectClassName,
} from '~/components/portal/establishment_editor/editor_field'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { MainLayout } from '~/layouts/main_layout'
import { collection, numeric, record, text, type JsonRecord } from '~/lib/json'
import {
  isReportStatus,
  reportStatusMeta,
  reportTargetLabels,
  type ReportStatus,
  type ReportTargetType,
} from '~/lib/content_reports'

interface BackofficeReportsProps {
  reports: unknown
  filters: JsonRecord
  tenant_id: number
  /** Open reports past their deadline in the whole operation, counted by the server. */
  overdue_total?: number
}

const QUEUE_PATH = '/backoffice/reports'

/** The status agrees with the count: "0 denúncias · pendentes", "1 denúncia · resolvida". */
const STATUS_COUNT_LABEL: Record<ReportStatus, [one: string, many: string]> = {
  pending: ['pendente', 'pendentes'],
  under_review: ['em análise', 'em análise'],
  resolved: ['resolvida', 'resolvidas'],
  dismissed: ['descartada', 'descartadas'],
}

export default function BackofficeReports({
  reports,
  filters,
  overdue_total: overdueTotal = 0,
}: BackofficeReportsProps) {
  const page = record(reports)
  const rows = collection(page?.data)
  const meta = record(page?.meta)

  const rawStatus = text(filters, 'status', 'pending')
  const status: ReportStatus = isReportStatus(rawStatus) ? rawStatus : 'pending'
  const targetType = text(filters, 'target_type')

  const [selectedStatus, setSelectedStatus] = useState<ReportStatus>(status)
  const [selectedTarget, setSelectedTarget] = useState<string>(targetType)

  const applyFilters = (event: FormEvent) => {
    event.preventDefault()
    router.get(
      QUEUE_PATH,
      {
        status: selectedStatus,
        ...(selectedTarget ? { target_type: selectedTarget } : {}),
      },
      { preserveScroll: true, preserveState: true }
    )
  }

  const total = numeric(meta, 'total')
  const currentPage = numeric(meta, 'current_page') || 1
  const lastPage = numeric(meta, 'last_page') || 1

  return (
    <MainLayout>
      <Head title="Denúncias de conteúdo" />

      <div className="space-y-6">
        <PageHeader
          eyebrow="Caixa de moderação"
          icon={Flag}
          title="Denúncias de conteúdo"
          description="Avaliações, respostas do parceiro e unidades reportadas por quem usa o catálogo. Cada caso mostra o conteúdo denunciado, não apenas o protocolo."
          meta={
            <>
              <Badge variant="secondary" appearance="light" shape="pill">
                {total.toLocaleString('pt-BR')} {total === 1 ? 'denúncia' : 'denúncias'} ·{' '}
                {STATUS_COUNT_LABEL[status][total === 1 ? 0 : 1]}
              </Badge>
              {overdueTotal > 0 ? (
                <Badge
                  variant="destructive"
                  appearance="light"
                  shape="pill"
                  data-testid="overdue-total"
                >
                  <AlertTriangle aria-hidden="true" />
                  {overdueTotal} {overdueTotal === 1 ? 'denúncia vencida' : 'denúncias vencidas'} na
                  operação
                </Badge>
              ) : null}
            </>
          }
        />

        <form
          onSubmit={applyFilters}
          aria-label="Filtros de denúncias"
          className="grid gap-4 rounded-card border border-border-subtle bg-card p-5 md:grid-cols-[1fr_1fr_auto] md:items-end"
        >
          <EditorField htmlFor="report-status" label="Estado">
            <select
              id="report-status"
              value={selectedStatus}
              onChange={(event) => setSelectedStatus(event.target.value as ReportStatus)}
              className={editorSelectClassName}
            >
              {(Object.keys(reportStatusMeta) as ReportStatus[]).map((value) => (
                <option key={value} value={value}>
                  {reportStatusMeta[value].label}
                </option>
              ))}
            </select>
          </EditorField>

          <EditorField htmlFor="report-target" label="Tipo de conteúdo">
            <select
              id="report-target"
              value={selectedTarget}
              onChange={(event) => setSelectedTarget(event.target.value)}
              className={editorSelectClassName}
            >
              <option value="">Todos</option>
              {(Object.keys(reportTargetLabels) as ReportTargetType[]).map((value) => (
                <option key={value} value={value}>
                  {reportTargetLabels[value]}
                </option>
              ))}
            </select>
          </EditorField>

          <div className="flex gap-2">
            <Button type="submit" variant="primary" size="lg" shape="pill">
              Filtrar
            </Button>
            <Button asChild type="button" variant="ghost" size="lg" shape="pill">
              <Link href={QUEUE_PATH}>Limpar filtros</Link>
            </Button>
          </div>
        </form>

        {rows.length === 0 ? (
          <EmptyState
            icon={Flag}
            headingLevel={2}
            title="Nenhuma denúncia nesta visão"
            description="Uma fila vazia é o estado saudável. Altere o estado ou o tipo de conteúdo para consultar casos já decididos."
            className="rounded-card border border-dashed border-border bg-card"
          />
        ) : (
          <section aria-label="Denúncias de conteúdo" className="space-y-3">
            {rows.map((row) => (
              <ContentReportCard key={numeric(row, 'id')} report={row} />
            ))}
          </section>
        )}

        <PaginationNav
          currentPage={currentPage}
          lastPage={lastPage}
          buildHref={(target) =>
            buildPageHref(QUEUE_PATH, {
              status,
              target_type: targetType || null,
              page: target,
            })
          }
        />
      </div>
    </MainLayout>
  )
}
