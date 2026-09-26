import { Head, Link, router } from '@inertiajs/react'
import {
  Archive,
  Check,
  ClipboardCheck,
  Loader2,
  Megaphone,
  Save,
  ShieldCheck,
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
  policy: JsonRecord | null
  platform_access: 'platform_admin' | 'platform_moderator' | null
  tenant_id: number
}

interface PolicyForm {
  requireExperienceApproval: boolean
  requireEventApproval: boolean
  requireShowcaseApproval: boolean
  maxMedia: string
  minEventNotice: string
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

function booleanValue(source: JsonRecord | null, key: string): boolean {
  return source?.[key] === true
}

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

export default function BackofficePartnerContentPage({
  sections: rawSections,
  counts = {},
  filters,
  policy,
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
  const [policyProcessing, setPolicyProcessing] = useState(false)
  const [policyForm, setPolicyForm] = useState<PolicyForm>({
    requireExperienceApproval: booleanValue(policy, 'require_experience_approval'),
    requireEventApproval: booleanValue(policy, 'require_event_approval'),
    requireShowcaseApproval: booleanValue(policy, 'require_showcase_item_approval'),
    maxMedia: String(numeric(policy, 'max_media_per_content') || 0),
    minEventNotice: String(numeric(policy, 'min_event_notice_minutes') || 0),
  })

  const permissions = {
    approve: can('establishments.approve'),
    reject: can('establishments.reject'),
    archive: can('establishments.archive'),
    edit: can('establishments.update'),
  }
  const canUpdatePolicy = platformAccess === 'platform_admin' && can('settings.update')
  const totalAll = partnerContentKinds.reduce((sum, kind) => sum + (counts[kind.path] ?? 0), 0)
  const statusLabel = partnerContentStatusMeta[status].label.toLowerCase()

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

  function savePolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canUpdatePolicy) return
    setPolicyProcessing(true)
    router.put(
      '/backoffice/content/policy',
      {
        require_experience_approval: policyForm.requireExperienceApproval,
        require_event_approval: policyForm.requireEventApproval,
        require_showcase_item_approval: policyForm.requireShowcaseApproval,
        max_media_per_content: Math.max(0, Number(policyForm.maxMedia) || 0),
        min_event_notice_minutes: Math.max(0, Number(policyForm.minEventNotice) || 0),
      },
      { preserveScroll: true, onFinish: () => setPolicyProcessing(false) }
    )
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

      <div className="space-y-7">
        <PageHeader
          eyebrow="Backoffice"
          icon={Megaphone}
          title="Conteúdo de parceiros"
          description="Experiências, eventos e itens de vitrine que os parceiros enviaram."
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
          className="grid gap-4 rounded-lg border border-border bg-card p-5 md:grid-cols-[1fr_1fr_auto] md:items-end"
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
            <Button type="submit">Filtrar</Button>
            <Button asChild type="button" variant="outline">
              <Link href={QUEUE_PATH}>Limpar</Link>
            </Button>
          </div>
        </form>

        {visibleSections.every((section) => section.rows.length === 0) ? (
          <EmptyState
            icon={ClipboardCheck}
            headingLevel={2}
            title={
              scope === 'all'
                ? 'Nenhum conteúdo ' + statusLabel
                : 'Nenhum item de ' + kindLabel(scope).toLowerCase() + ' ' + statusLabel
            }
            description={
              scope !== 'all' && totalAll > 0
                ? 'Há itens de outros tipos neste estado. Veja em "Todos os tipos".'
                : 'Quando um parceiro enviar algo neste estado, aparece aqui.'
            }
            className="rounded-lg border border-dashed border-border bg-card"
          />
        ) : (
          visibleSections.map((section) => (
            <section
              key={section.kind}
              aria-labelledby={'section-' + section.kind}
              className="space-y-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id={'section-' + section.kind} className="text-lg font-bold">
                  {kindLabel(section.kind)}{' '}
                  <span className="text-sm font-semibold text-muted-foreground">
                    · {section.total.toLocaleString('pt-BR')} {statusLabel}
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

        {platformAccess === 'platform_admin' && policy ? (
          <section className="rounded-lg border border-border bg-card p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-primary/15 bg-primary-soft text-primary-accent">
                <ShieldCheck aria-hidden="true" className="size-4.5" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                  Política da operação
                </p>
                <h2 className="mt-1 text-xl font-bold">Publicação e limites</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Valem para esta operação. Mudar a política não reescreve conteúdo já publicado.
                </p>
              </div>
            </div>

            <form onSubmit={savePolicy} className="mt-6 grid gap-5">
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  ['Experiências', 'requireExperienceApproval'],
                  ['Eventos', 'requireEventApproval'],
                  ['Vitrine', 'requireShowcaseApproval'],
                ].map(([label, field]) => (
                  <label
                    key={field}
                    className="flex items-center justify-between gap-3 rounded-md border border-border p-4"
                  >
                    <span className="text-sm font-medium">
                      Aprovar {String(label).toLowerCase()}
                    </span>
                    <input
                      type="checkbox"
                      checked={Boolean(policyForm[field as keyof PolicyForm])}
                      onChange={(event) =>
                        setPolicyForm((current) => ({
                          ...current,
                          [field]: event.target.checked,
                        }))
                      }
                      disabled={!canUpdatePolicy || policyProcessing}
                      className="size-4 accent-primary"
                    />
                  </label>
                ))}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <EditorField htmlFor="policy-media" label="Máximo de mídias por conteúdo">
                  <Input
                    id="policy-media"
                    type="number"
                    min={0}
                    step={1}
                    value={policyForm.maxMedia}
                    onChange={(event) =>
                      setPolicyForm((current) => ({ ...current, maxMedia: event.target.value }))
                    }
                    disabled={!canUpdatePolicy || policyProcessing}
                  />
                </EditorField>
                <EditorField
                  htmlFor="policy-event-notice"
                  label="Antecedência mínima do evento"
                  hint="Em minutos"
                >
                  <Input
                    id="policy-event-notice"
                    type="number"
                    min={0}
                    step={1}
                    value={policyForm.minEventNotice}
                    onChange={(event) =>
                      setPolicyForm((current) => ({
                        ...current,
                        minEventNotice: event.target.value,
                      }))
                    }
                    disabled={!canUpdatePolicy || policyProcessing}
                  />
                </EditorField>
              </div>

              {canUpdatePolicy ? (
                <div className="flex justify-end">
                  <Button type="submit" disabled={policyProcessing}>
                    {policyProcessing ? (
                      <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                    ) : (
                      <Save aria-hidden="true" className="size-4" />
                    )}
                    {policyProcessing ? 'Salvando…' : 'Salvar política'}
                  </Button>
                </div>
              ) : null}
            </form>
          </section>
        ) : null}
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
 * One item of the queue. A component of its own, not a closure of the page, so
 * the refusal reason keeps its focus while the page re-renders.
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

  return (
    <article className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'inline-flex rounded-full border px-2.5 py-0.5 text-[0.68rem] font-semibold',
                statusMeta.className
              )}
            >
              {statusMeta.label}
            </span>
            {snapshot && rowStatus === 'pending_review' ? (
              <span className="text-xs font-medium text-primary">
                versão pública anterior preservada
              </span>
            ) : null}
          </div>

          <h3 className="mt-3 text-lg font-bold tracking-[-0.02em]">
            {text(row, 'title', 'Conteúdo sem título')}
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
            <p className="mt-3 text-sm font-medium">
              {formatPartnerContentDate(startsAt, timeZone)} →{' '}
              {formatPartnerContentDate(endsAt, timeZone)}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {rowStatus === 'pending_review' && permissions.approve ? (
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => onAction(base + '/approve', id)}
            >
              {busy ? (
                <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
              ) : (
                <Check aria-hidden="true" className="size-3.5" />
              )}
              Aprovar
            </Button>
          ) : null}

          {rowStatus === 'pending_review' && permissions.reject ? (
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
                <Button type="button" variant="outline" size="sm" disabled={busy}>
                  <X aria-hidden="true" className="size-3.5" />
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

          {rowStatus !== 'archived' && permissions.archive ? (
            <ConfirmDialog
              title="Retirar este conteúdo?"
              description="O item sai da descoberta imediatamente. O histórico permanece para auditoria."
              confirmLabel="Retirar conteúdo"
              destructive
              processing={busy}
              onConfirm={() => onAction(base + '/archive', id)}
              trigger={
                <Button type="button" variant="ghost" size="sm" disabled={busy}>
                  <Archive aria-hidden="true" className="size-3.5" />
                  Arquivar
                </Button>
              }
            />
          ) : null}
        </div>
      </div>
      <PartnerContentMediaModeration
        tenantId={tenantId}
        kind={kind}
        contentId={id}
        media={media}
        canApprove={permissions.approve}
        canReject={permissions.reject}
      />
      <div className="mt-4 flex flex-col gap-2">
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
              row.informational_price_cents === null || row.informational_price_cents === undefined
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
    </article>
  )
}
