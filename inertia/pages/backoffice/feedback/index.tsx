import { Head, Link, router } from '@inertiajs/react'
import { MessageSquareText } from 'lucide-react'
import type { FormEvent } from 'react'
import { useState } from 'react'

import { FeedbackCard } from '~/components/backoffice/feedback_card'
import { EmptyState } from '~/components/empty_state'
import { PageHeader } from '~/components/page_header'
import { buildPageHref, PaginationNav } from '~/components/pagination'
import {
  EditorField,
  editorSelectClassName,
} from '~/components/portal/establishment_editor/editor_field'
import { Button } from '~/components/ui/button'
import { MainLayout } from '~/layouts/main_layout'
import { collection, numeric, record, text, type JsonRecord } from '~/lib/json'
import { PILOT_FEEDBACK_CONTEXT_LABELS, PILOT_FEEDBACK_STATUS_LABELS } from '~/lib/labels'

interface FeedbackIndexProps {
  feedback: unknown
  filters: JsonRecord
}

const FEEDBACK_PATH = '/backoffice/feedback'

function numericFilter(filters: JsonRecord, key: string): string {
  const value = filters[key]
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
}

export default function PilotFeedbackBackofficePage({ feedback, filters }: FeedbackIndexProps) {
  const items = collection(feedback)
  const meta = record(record(feedback)?.meta)
  const total = numeric(meta, 'total') || items.length
  const currentPage = numeric(meta, 'current_page') || 1
  const lastPage = numeric(meta, 'last_page') || 1

  const appliedStatus = text(filters, 'status')
  const appliedContext = text(filters, 'context')
  const [status, setStatus] = useState(appliedStatus)
  const [context, setContext] = useState(appliedContext)
  const hasActiveFilters = appliedStatus !== '' || appliedContext !== ''

  const preservedParams = {
    organization_id: numericFilter(filters, 'organization_id'),
    establishment_id: numericFilter(filters, 'establishment_id'),
    per_page: numericFilter(filters, 'per_page'),
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    router.get(buildPageHref(FEEDBACK_PATH, { ...preservedParams, status, context }))
  }

  function pageHref(page: number): string {
    return buildPageHref(FEEDBACK_PATH, {
      ...preservedParams,
      status: appliedStatus,
      context: appliedContext,
      page,
    })
  }

  return (
    <MainLayout>
      <Head title="Feedback do piloto" />

      <div className="space-y-7">
        <PageHeader
          eyebrow="Backoffice"
          icon={MessageSquareText}
          title="Feedback do piloto"
          description="Transforme relatos de onboarding, editor, catálogo e moderação em decisões de produto rastreáveis."
        />

        <section className="flex items-center gap-3 rounded-lg border border-border bg-card p-5">
          <span className="flex size-10 items-center justify-center rounded-md border border-info/20 bg-info/10 text-info">
            <MessageSquareText aria-hidden="true" className="size-4.5" />
          </span>
          <div>
            <p className="font-bold tracking-[-0.015em]">
              {total.toLocaleString('pt-BR')}{' '}
              {total === 1 ? 'relato encontrado' : 'relatos encontrados'}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              A fila comercial é separada da moderação de conteúdo.
            </p>
          </div>
        </section>

        <form
          onSubmit={applyFilters}
          aria-label="Filtros da fila de feedback"
          className="grid gap-4 rounded-lg border border-border bg-card p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        >
          <EditorField htmlFor="filter-status" label="Status">
            <select
              id="filter-status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className={editorSelectClassName}
            >
              <option value="">Todos os status</option>
              {Object.entries(PILOT_FEEDBACK_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </EditorField>
          <EditorField htmlFor="filter-context" label="Contexto">
            <select
              id="filter-context"
              value={context}
              onChange={(event) => setContext(event.target.value)}
              className={editorSelectClassName}
            >
              <option value="">Todos os contextos</option>
              {Object.entries(PILOT_FEEDBACK_CONTEXT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </EditorField>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" variant="primary">
              Filtrar
            </Button>
            {hasActiveFilters ? (
              <Button asChild variant="outline">
                <Link href={buildPageHref(FEEDBACK_PATH, preservedParams)}>Limpar filtros</Link>
              </Button>
            ) : null}
          </div>
        </form>

        {items.length === 0 ? (
          <EmptyState
            icon={MessageSquareText}
            headingLevel={2}
            title="Nenhum feedback nesta fila"
            description={
              hasActiveFilters
                ? 'Nenhum relato corresponde aos filtros aplicados.'
                : 'Novos relatos enviados pelos participantes do piloto aparecerão aqui.'
            }
            className="rounded-lg border border-dashed border-border bg-card"
          />
        ) : (
          <section aria-label="Relatos do piloto" className="space-y-4">
            {items.map((item) => (
              <FeedbackCard key={numeric(item, 'id')} item={item} />
            ))}
          </section>
        )}

        <PaginationNav
          currentPage={currentPage}
          lastPage={lastPage}
          buildHref={pageHref}
          label="Paginação da fila de feedback"
        />
      </div>
    </MainLayout>
  )
}
