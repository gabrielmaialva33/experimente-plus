import { Head, Link, router } from '@inertiajs/react'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { ArrowRight, ClipboardCheck, Clock3 } from 'lucide-react'

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
import { formatDateTime, getRevisionStatusMeta } from '~/lib/labels'
import { cn } from '~/lib/utils'

interface ModerationIndexProps {
  revisions: unknown
  filters: JsonRecord
}

const QUEUE_PATH = '/backoffice/moderation'

function filterValue(filters: JsonRecord, key: string): string {
  const value = filters[key]
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
}

export default function ModerationQueuePage({ revisions, filters }: ModerationIndexProps) {
  const items = collection(revisions)
  const meta = record(record(revisions)?.meta)
  const total = numeric(meta, 'total') || items.length
  const currentPage = numeric(meta, 'current_page') || 1
  const lastPage = numeric(meta, 'last_page') || 1
  const perPage = filterValue(filters, 'per_page')
  const appliedOrganizationId = filterValue(filters, 'organization_id')
  const appliedCityId = filterValue(filters, 'city_id')

  const [organizationId, setOrganizationId] = useState(appliedOrganizationId)
  const [cityId, setCityId] = useState(appliedCityId)
  const hasActiveFilters = appliedOrganizationId !== '' || appliedCityId !== ''
  const organizationOptions = Array.from(
    new Map(
      items
        .map((item) => [numeric(item, 'organization_id'), text(item, 'organization_name')] as const)
        .filter(([id, name]) => id > 0 && name !== '')
    )
  ).map(([id, name]) => ({ id, name }))
  const cityOptions = Array.from(
    new Map(
      items
        .map((item) => [numeric(item, 'city_id'), text(item, 'city_name')] as const)
        .filter(([id, name]) => id > 0 && name !== '')
    )
  ).map(([id, name]) => ({ id, name }))
  const selectedOrganizationIsListed = organizationOptions.some(
    (option) => String(option.id) === appliedOrganizationId
  )
  const selectedCityIsListed = cityOptions.some((option) => String(option.id) === appliedCityId)

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    router.get(
      buildPageHref(QUEUE_PATH, {
        organization_id: organizationId,
        city_id: cityId,
        per_page: perPage,
      })
    )
  }

  function pageHref(page: number): string {
    return buildPageHref(QUEUE_PATH, {
      organization_id: filterValue(filters, 'organization_id'),
      city_id: filterValue(filters, 'city_id'),
      per_page: perPage,
      page,
    })
  }

  return (
    <MainLayout>
      <Head title="Fila de moderação" />

      <div className="space-y-7">
        <PageHeader
          eyebrow="Backoffice"
          icon={ClipboardCheck}
          title="Fila de moderação"
          description="Analise revisões submetidas, registre correções estruturadas e publique somente conteúdo aprovado."
        />

        <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-md border border-warning/20 bg-warning/15 text-warning-foreground">
              <Clock3 aria-hidden="true" className="size-4.5" />
            </span>
            <div>
              <p className="font-bold tracking-[-0.015em]">
                {total.toLocaleString('pt-BR')}{' '}
                {total === 1 ? 'revisão pendente' : 'revisões pendentes'}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                A fila prioriza as submissões mais antigas.
              </p>
            </div>
          </div>
          <span className="w-fit rounded-full bg-muted px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Operação ativa
          </span>
        </section>

        <form
          onSubmit={applyFilters}
          aria-label="Filtros da fila de moderação"
          className="grid gap-4 rounded-lg border border-border bg-card p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        >
          <EditorField htmlFor="filter-organization" label="Organização">
            <select
              id="filter-organization"
              value={organizationId}
              onChange={(event) => setOrganizationId(event.target.value)}
              className={editorSelectClassName}
            >
              <option value="">Todas as organizações</option>
              {appliedOrganizationId && !selectedOrganizationIsListed ? (
                <option value={appliedOrganizationId}>
                  Organização selecionada · código {appliedOrganizationId}
                </option>
              ) : null}
              {organizationOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </EditorField>
          <EditorField htmlFor="filter-city" label="Cidade">
            <select
              id="filter-city"
              value={cityId}
              onChange={(event) => setCityId(event.target.value)}
              className={editorSelectClassName}
            >
              <option value="">Todas as cidades</option>
              {appliedCityId && !selectedCityIsListed ? (
                <option value={appliedCityId}>Cidade selecionada · código {appliedCityId}</option>
              ) : null}
              {cityOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
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
                <Link href={buildPageHref(QUEUE_PATH, { per_page: perPage })}>Limpar filtros</Link>
              </Button>
            ) : null}
          </div>
        </form>

        {items.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            headingLevel={2}
            title="Fila vazia"
            description={
              hasActiveFilters
                ? 'Nenhuma revisão pendente corresponde aos filtros aplicados.'
                : 'Não existem revisões aguardando decisão nesta operação.'
            }
            className="rounded-lg border border-dashed border-border bg-card"
          />
        ) : (
          <section aria-label="Revisões aguardando moderação" className="space-y-3">
            {items.map((item) => {
              const id = numeric(item, 'id')
              const statusMeta = getRevisionStatusMeta(text(item, 'status'))
              const submittedAt = formatDateTime(text(item, 'submitted_at') || null)

              return (
                <article
                  key={id}
                  className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3.5">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-primary/15 bg-primary/10 text-primary">
                      <ClipboardCheck aria-hidden="true" className="size-4.5" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate font-bold tracking-[-0.015em]">
                          {text(item, 'public_name', 'Unidade sem nome')}
                        </h2>
                        <span className="rounded-full bg-muted px-2.5 py-1 text-[0.68rem] font-semibold text-muted-foreground">
                          versão {numeric(item, 'version')}
                        </span>
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.68rem] font-semibold',
                            statusMeta.className
                          )}
                        >
                          {statusMeta.label}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {text(item, 'organization_name', 'Organização não informada')} ·{' '}
                        {text(item, 'city_name', 'Cidade não informada')}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {submittedAt
                          ? `Submetida em ${submittedAt}`
                          : 'Data de submissão indisponível'}
                      </p>
                    </div>
                  </div>

                  <Button asChild variant="outline" size="sm" className="shrink-0">
                    <Link href={`/backoffice/moderation/${id}`}>
                      Revisar
                      <ArrowRight aria-hidden="true" className="size-3.5" />
                    </Link>
                  </Button>
                </article>
              )
            })}
          </section>
        )}

        <PaginationNav
          currentPage={currentPage}
          lastPage={lastPage}
          buildHref={pageHref}
          label="Paginação da fila de moderação"
        />
      </div>
    </MainLayout>
  )
}
