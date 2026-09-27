import { Head, Link, router } from '@inertiajs/react'
import {
  Archive,
  Check,
  ClipboardCheck,
  Loader2,
  Megaphone,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'

import {
  PartnerContentAdminEditor,
  PartnerContentHistory,
} from '~/components/backoffice/partner_content_admin_tools'
import { PartnerContentMediaModeration } from '~/components/backoffice/partner_content_media_moderation'
import { ConfirmDialog } from '~/components/confirm_dialog'
import { EmptyState } from '~/components/empty_state'
import { buildPageHref, PaginationNav } from '~/components/pagination'
import { PageHeader } from '~/components/page_header'
import {
  EditorField,
  editorSelectClassName,
} from '~/components/portal/establishment_editor/editor_field'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import { MainLayout } from '~/layouts/main_layout'
import { useAuth } from '~/hooks/use_auth'
import { collection, numeric, record, text, type JsonRecord } from '~/lib/json'
import {
  formatPartnerContentDate,
  partnerContentKinds,
  partnerContentStatusMeta,
  type PartnerContentPath,
  type PartnerContentStatus,
} from '~/lib/partner_content'
import { partnerContentMediaItems } from '~/lib/partner_content_media'
import { cn } from '~/lib/utils'

/** The queue shows every kind at once, or one kind with its own pages. */
type Scope = PartnerContentPath | 'all'

interface BackofficeContentProps {
  sections: unknown
  counts?: Partial<Record<PartnerContentPath, number>>
  filters: JsonRecord
  platform_access: 'platform_admin' | 'platform_moderator' | null
  tenant_id: number
}

interface Section {
  kind: PartnerContentPath
  rows: JsonRecord[]
  total: number
  page: number
  lastPage: number
}

interface Refusal {
  id: number
  reason: string
}

const QUEUE_PATH = '/backoffice/content'

function statusValue(value: string): PartnerContentStatus {
  return value === 'draft' ||
    value === 'pending_review' ||
    value === 'published' ||
    value === 'archived'
    ? value
    : 'draft'
}

function currentScope(filters: JsonRecord): Scope {
  const value = text(filters, 'kind')
  return partnerContentKinds.some((kind) => kind.path === value)
    ? (value as PartnerContentPath)
    : 'all'
}

function sectionsOf(value: unknown): Section[] {
  return collection(value).flatMap((entry) => {
    const kind = text(entry, 'kind')
    if (!partnerContentKinds.some((item) => item.path === kind)) return []
    const meta = record(entry.meta)
    return [
      {
        kind: kind as PartnerContentPath,
        rows: collection(entry.data),
        total: numeric(meta, 'total'),
        page: numeric(meta, 'current_page') || 1,
        lastPage: numeric(meta, 'last_page') || 1,
      },
    ]
  })
}

function kindLabel(kind: PartnerContentPath): string {
  return partnerContentKinds.find((item) => item.path === kind)!.label
}

/** The state as it follows a count: "1 item publicado", "3 itens publicados", "2 itens em rascunho". */
const STATUS_COUNT_LABEL: Record<PartnerContentStatus, [one: string, many: string]> = {
  draft: ['em rascunho', 'em rascunho'],
  pending_review: ['em análise', 'em análise'],
  published: ['publicado', 'publicados'],
  archived: ['arquivado', 'arquivados'],
}

export default function BackofficePartnerContentPage({
  sections: rawSections,
  counts = {},
  filters,
  platform_access: platformAccess,
  tenant_id: tenantId,
}: BackofficeContentProps) {
  const { can } = useAuth()
  const sections = sectionsOf(rawSections)
  const scope = currentScope(filters)
  const status = statusValue(text(filters, 'status', 'pending_review'))
  const perPage = numeric(filters, 'per_page') || 20
  const establishmentId = numeric(filters, 'establishment_id')
  const [selectedStatus, setSelectedStatus] = useState<PartnerContentStatus>(status)
  const [selectedEstablishment, setSelectedEstablishment] = useState(
    establishmentId > 0 ? String(establishmentId) : ''
  )
  const [actionId, setActionId] = useState<number | null>(null)
  // One refusal is written at a time; the reason belongs to the item it opened on.
  const [refusal, setRefusal] = useState<Refusal | null>(null)

  const permissions = {
    approve: can('establishments.approve'),
    reject: can('establishments.reject'),
    archive: can('establishments.archive'),
    edit: can('establishments.update'),
  }
  const isPlatformAdmin = platformAccess === 'platform_admin'
  const totalAll = partnerContentKinds.reduce((sum, kind) => sum + (counts[kind.path] ?? 0), 0)
  const [statusOne, statusMany] = STATUS_COUNT_LABEL[status]

  function scopeHref(next: Scope, page?: number): string {
    return buildPageHref(QUEUE_PATH, {
      kind: next,
      status,
      establishment_id: establishmentId > 0 ? String(establishmentId) : '',
      per_page: String(perPage),
      ...(page ? { page } : {}),
    })
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    router.get(
      buildPageHref(QUEUE_PATH, {
        kind: scope,
        status: selectedStatus,
        establishment_id: selectedEstablishment,
        per_page: String(perPage),
      })
    )
  }

  function action(path: string, id: number, data: Record<string, string> = {}) {
    setActionId(id)
    router.post(path, data, { preserveScroll: true, onFinish: () => setActionId(null) })
  }

  const tabs: Array<{ scope: Scope; label: string; count: number }> = [
    { scope: 'all', label: 'Todos os tipos', count: totalAll },
    ...partnerContentKinds.map((kind) => ({
      scope: kind.path as Scope,
      label: kind.label,
      count: counts[kind.path] ?? 0,
    })),
  ]
  const visibleSections =
    scope === 'all' ? sections.filter((section) => section.total > 0) : sections

  return (
    <MainLayout>
      <Head title="Conteúdo de parceiros" />

      <div className="space-y-6">
        <PageHeader
          eyebrow="Caixa de moderação"
          icon={Megaphone}
          title="Conteúdo de parceiros"
          description="Experiências, eventos e itens de vitrine que os parceiros enviaram. Leia, confira as imagens e decida."
          meta={
            // Amber only for work waiting on the operation; any other count is neutral.
            <Badge
              variant={status === 'pending_review' && totalAll > 0 ? 'warning' : 'neutral'}
              appearance="light"
              shape="pill"
            >
              {totalAll === 1
                ? '1 item ' + statusOne
                : totalAll.toLocaleString('pt-BR') + ' itens ' + statusMany}
            </Badge>
          }
          actions={
            isPlatformAdmin ? (
              <Button asChild variant="outline" size="lg" shape="pill">
                <Link href="/backoffice/review-policy#publicacao">
                  <SlidersHorizontal aria-hidden="true" className="size-4" />
                  Regras de publicação
                </Link>
              </Button>
            ) : null
          }
        />

        <nav aria-label="Tipos de conteúdo" className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const selected = tab.scope === scope
            return (
              <Link
                key={tab.scope}
                href={scopeHref(tab.scope)}
                aria-current={selected ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selected
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-foreground hover:bg-accent'
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    'inline-flex min-w-6 justify-center rounded-full px-1.5 text-xs font-bold tabular-nums',
                    selected ? 'bg-primary-foreground/20' : 'bg-muted text-muted-foreground'
                  )}
                >
                  {tab.count.toLocaleString('pt-BR')}
                </span>
              </Link>
            )
          })}
        </nav>

        <form
          onSubmit={applyFilters}
          aria-label="Filtros de conteúdo de parceiros"
          className="grid gap-4 rounded-card border border-border-subtle bg-card p-5 md:grid-cols-[1fr_1fr_auto] md:items-end"
        >
          <EditorField htmlFor="content-status" label="Estado">
            <select
              id="content-status"
              value={selectedStatus}
              onChange={(event) => setSelectedStatus(event.target.value as PartnerContentStatus)}
              className={editorSelectClassName}
            >
              <option value="pending_review">Em análise</option>
              <option value="draft">Rascunho</option>
              <option value="published">Publicado</option>
              <option value="archived">Arquivado</option>
            </select>
          </EditorField>

          <EditorField htmlFor="content-establishment-filter" label="Código da unidade">
            <Input
              id="content-establishment-filter"
              inputMode="numeric"
              value={selectedEstablishment}
              onChange={(event) => setSelectedEstablishment(event.target.value.replace(/\D/g, ''))}
              placeholder="Todas"
            />
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

        {visibleSections.every((section) => section.rows.length === 0) ? (
          <EmptyState
            icon={ClipboardCheck}
            headingLevel={2}
            title={
              scope === 'all'
                ? 'Nenhum conteúdo ' + statusOne
                : 'Nenhum item de ' + kindLabel(scope).toLowerCase() + ' ' + statusOne
            }
            description={
              scope !== 'all' && totalAll > 0
                ? 'Há itens de outros tipos neste estado. Veja em "Todos os tipos".'
                : 'Quando um parceiro enviar algo neste estado, aparece aqui.'
            }
            className="rounded-card border border-dashed border-border bg-card"
          />
        ) : (
          visibleSections.map((section) => (
            <section
              key={section.kind}
              aria-labelledby={'section-' + section.kind}
              className="space-y-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2
                  id={'section-' + section.kind}
                  className="font-display text-xl font-extrabold tracking-[-0.01em]"
                >
                  {kindLabel(section.kind)}{' '}
                  <span className="text-sm font-semibold text-muted-foreground">
                    · {section.total.toLocaleString('pt-BR')}{' '}
                    {section.total === 1 ? statusOne : statusMany}
                  </span>
                </h2>
                {scope === 'all' && section.total > section.rows.length ? (
                  <Link
                    href={scopeHref(section.kind)}
                    className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
                  >
                    Ver todos os {section.total.toLocaleString('pt-BR')}
                  </Link>
                ) : null}
              </div>

              {section.rows.map((row) => {
                const id = numeric(row, 'id')
                return (
                  <ModerationItem
                    key={section.kind + ':' + id}
                    kind={section.kind}
                    row={row}
                    tenantId={tenantId}
                    busy={actionId === id}
                    permissions={permissions}
                    refusal={refusal?.id === id ? refusal : null}
                    onRefusalChange={setRefusal}
                    onAction={action}
                  />
                )
              })}

              {scope !== 'all' ? (
                <PaginationNav
                  currentPage={section.page}
                  lastPage={section.lastPage}
                  buildHref={(nextPage) => scopeHref(section.kind, nextPage)}
                  label={'Paginação de ' + kindLabel(section.kind).toLowerCase()}
                />
              ) : null}
            </section>
          ))
        )}
      </div>
    </MainLayout>
  )
}

interface ModerationItemProps {
  kind: PartnerContentPath
  row: JsonRecord
  tenantId: number
  busy: boolean
  permissions: { approve: boolean; reject: boolean; archive: boolean; edit: boolean }
  refusal: Refusal | null
  onRefusalChange: (refusal: Refusal | null) => void
  onAction: (path: string, id: number, data?: Record<string, string>) => void
}

/**
 * One item of the queue, read top to bottom in the order a moderator works
 * (audit W79): what the partner sent, a correction if one is needed, the
 * images, and then a single decision row at the end. A component of its own,
 * not a closure of the page, so the refusal reason keeps its focus while the
 * page re-renders.
 */
function ModerationItem({
  kind,
  row,
  tenantId,
  busy,
  permissions,
  refusal,
  onRefusalChange,
  onAction,
}: ModerationItemProps) {
  const id = numeric(row, 'id')
  const rowStatus = statusValue(text(row, 'status'))
  const statusMeta = partnerContentStatusMeta[rowStatus]
  const establishment = record(row.establishment)
  const organization = record(establishment?.organization)
  const publishedRevision = record(establishment?.published_revision)
  const city = record(publishedRevision?.city)
  const snapshot = record(row.published_snapshot)
  const startsAt = text(row, 'starts_at') || null
  const endsAt = text(row, 'ends_at') || null
  const timeZone = text(city, 'timezone') || null
  const media = partnerContentMediaItems(row.media)
  const base = '/backoffice/content/' + kind + '/' + id
  const title = text(row, 'title', 'Conteúdo sem título')
  const pending = rowStatus === 'pending_review'
  const canDecide = pending && (permissions.approve || permissions.reject)
  const canArchive = rowStatus !== 'archived' && permissions.archive

  return (
    <article
      aria-labelledby={'content-' + kind + '-' + id}
      className="overflow-hidden rounded-card border border-border-subtle bg-card"
    >
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold',
              statusMeta.className
            )}
          >
            {statusMeta.label}
          </span>
          {snapshot && pending ? (
            <Badge variant="info" appearance="light" shape="pill" size="sm">
              versão pública anterior preservada
            </Badge>
          ) : null}
        </div>

        <h3
          id={'content-' + kind + '-' + id}
          className="mt-3 font-display text-lg font-extrabold tracking-[-0.01em]"
        >
          {title}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {text(publishedRevision, 'public_name', 'Unidade ' + numeric(row, 'establishment_id'))}
          {text(organization, 'trade_name') ? ' · ' + text(organization, 'trade_name') : ''}
        </p>

        {text(row, 'description') ? (
          <p className="mt-3 max-w-3xl whitespace-pre-line text-sm leading-6 text-muted-foreground">
            {text(row, 'description')}
          </p>
        ) : null}

        {startsAt && endsAt ? (
          <p className="mt-3 text-sm font-semibold">
            {formatPartnerContentDate(startsAt, timeZone)} →{' '}
            {formatPartnerContentDate(endsAt, timeZone)}
          </p>
        ) : null}

        <div className="mt-4 flex flex-col items-start gap-2">
          {permissions.edit ? (
            <PartnerContentAdminEditor
              key={id + ':' + text(row, 'updated_at')}
              kind={kind}
              contentId={id}
              status={rowStatus}
              title={text(row, 'title')}
              description={text(row, 'description') || null}
              startsAt={startsAt}
              endsAt={endsAt}
              priceCents={
                row.informational_price_cents === null ||
                row.informational_price_cents === undefined
                  ? null
                  : numeric(row, 'informational_price_cents')
              }
              timeZone={timeZone}
            />
          ) : null}
          <PartnerContentHistory
            key={'history:' + id + ':' + text(row, 'updated_at')}
            tenantId={tenantId}
            kind={kind}
            contentId={id}
            timeZone={timeZone}
          />
        </div>

        <PartnerContentMediaModeration
          tenantId={tenantId}
          kind={kind}
          contentId={id}
          media={media}
          canApprove={permissions.approve}
          canReject={permissions.reject}
        />
      </div>

      {canDecide || canArchive ? (
        <div
          role="group"
          aria-label={'Decisão sobre ' + title}
          className="flex flex-col gap-3 border-t border-border-subtle bg-muted/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
        >
          <p className="text-sm text-muted-foreground">
            {canDecide
              ? 'Aprovar publica agora. Recusar devolve ao parceiro com o motivo.'
              : 'Publicado. Retirar tira da descoberta na hora.'}
          </p>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {canArchive ? (
              <ConfirmDialog
                title="Retirar este conteúdo?"
                description="O item sai da descoberta imediatamente. O histórico permanece para auditoria."
                confirmLabel="Retirar conteúdo"
                destructive
                processing={busy}
                onConfirm={() => onAction(base + '/archive', id)}
                trigger={
                  <Button
                    type="button"
                    variant="dim"
                    size="lg"
                    shape="pill"
                    disabled={busy}
                    className="sm:mr-2"
                  >
                    <Archive aria-hidden="true" className="size-4" />
                    Arquivar
                  </Button>
                }
              />
            ) : null}

            {pending && permissions.reject ? (
              <ConfirmDialog
                title="Recusar esta versão?"
                description="O parceiro recebe o motivo junto do item e pode corrigir. Se já existia uma versão aprovada, ela continua pública."
                confirmLabel="Recusar versão"
                processing={busy}
                disabled={(refusal?.reason.trim().length ?? 0) < 3}
                onOpenChange={(open) => onRefusalChange(open ? { id, reason: '' } : null)}
                onConfirm={() =>
                  onAction(base + '/reject', id, { reason: refusal?.reason.trim() ?? '' })
                }
                trigger={
                  <Button type="button" variant="outline" size="lg" shape="pill" disabled={busy}>
                    <X aria-hidden="true" className="size-4" />
                    Recusar
                  </Button>
                }
              >
                <div className="space-y-2">
                  <Label htmlFor={'refusal-reason-' + id}>Motivo da recusa</Label>
                  <Textarea
                    id={'refusal-reason-' + id}
                    value={refusal?.reason ?? ''}
                    onChange={(event) =>
                      onRefusalChange({ id, reason: event.target.value.slice(0, 2000) })
                    }
                    rows={4}
                    required
                    aria-describedby={'refusal-reason-help-' + id}
                    placeholder="Ex.: a foto mostra outro estabelecimento; troque pela do seu lugar."
                  />
                  <p id={'refusal-reason-help-' + id} className="text-xs text-muted-foreground">
                    Escreva o que o parceiro precisa mudar. Ele lê este texto no portal.
                  </p>
                </div>
              </ConfirmDialog>
            ) : null}

            {pending && permissions.approve ? (
              <Button
                type="button"
                variant="primary"
                size="lg"
                shape="pill"
                disabled={busy}
                onClick={() => onAction(base + '/approve', id)}
              >
                {busy ? (
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                ) : (
                  <Check aria-hidden="true" className="size-4" />
                )}
                Aprovar e publicar
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  )
}
