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

interface BackofficeContentProps {
  items: unknown
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

function currentKind(filters: JsonRecord): PartnerContentPath {
  const value = text(filters, 'kind')
  return partnerContentKinds.some((kind) => kind.path === value)
    ? (value as PartnerContentPath)
    : 'events'
}

export default function BackofficePartnerContentPage({
  items,
  filters,
  policy,
  platform_access: platformAccess,
  tenant_id: tenantId,
}: BackofficeContentProps) {
  const { can } = useAuth()
  const rows = collection(items)
  const meta = record(record(items)?.meta)
  const page = numeric(meta, 'current_page') || 1
  const lastPage = numeric(meta, 'last_page') || 1
  const kind = currentKind(filters)
  const status = statusValue(text(filters, 'status', 'pending_review'))
  const perPage = numeric(filters, 'per_page') || 20
  const establishmentId = numeric(filters, 'establishment_id')
  const [selectedKind, setSelectedKind] = useState<PartnerContentPath>(kind)
  const [selectedStatus, setSelectedStatus] = useState<PartnerContentStatus>(status)
  const [selectedEstablishment, setSelectedEstablishment] = useState(
    establishmentId > 0 ? String(establishmentId) : ''
  )
  const [actionId, setActionId] = useState<number | null>(null)
  const [policyProcessing, setPolicyProcessing] = useState(false)
  const [policyForm, setPolicyForm] = useState<PolicyForm>({
    requireExperienceApproval: booleanValue(policy, 'require_experience_approval'),
    requireEventApproval: booleanValue(policy, 'require_event_approval'),
    requireShowcaseApproval: booleanValue(policy, 'require_showcase_item_approval'),
    maxMedia: String(numeric(policy, 'max_media_per_content') || 0),
    minEventNotice: String(numeric(policy, 'min_event_notice_minutes') || 0),
  })

  const kindMeta = partnerContentKinds.find((item) => item.path === kind)!
  const canApprove = can('establishments.approve')
  const canReject = can('establishments.reject')
  const canArchive = can('establishments.archive')
  const canEdit = can('establishments.update')
  const canUpdatePolicy = platformAccess === 'platform_admin' && can('settings.update')

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    router.get(
      buildPageHref(QUEUE_PATH, {
        kind: selectedKind,
        status: selectedStatus,
        establishment_id: selectedEstablishment,
        per_page: String(perPage),
      })
    )
  }

  function pageHref(nextPage: number): string {
    return buildPageHref(QUEUE_PATH, {
      kind,
      status,
      establishment_id: establishmentId > 0 ? String(establishmentId) : '',
      per_page: String(perPage),
      page: nextPage,
    })
  }

  function action(path: string, id: number) {
    setActionId(id)
    router.post(path, {}, { preserveScroll: true, onFinish: () => setActionId(null) })
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

  return (
    <MainLayout>
      <Head title="Conteúdo de parceiros" />

      <div className="space-y-7">
        <PageHeader
          eyebrow="Backoffice"
          icon={Megaphone}
          title="Conteúdo de parceiros"
          description="Modere experiências, eventos e itens de vitrine sem misturar essa fila ao workflow da ficha da unidade."
        />

        <form
          onSubmit={applyFilters}
          aria-label="Filtros de conteúdo de parceiros"
          className="grid gap-4 rounded-lg border border-border bg-card p-5 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end"
        >
          <EditorField htmlFor="content-kind" label="Tipo">
            <select
              id="content-kind"
              value={selectedKind}
              onChange={(event) => setSelectedKind(event.target.value as PartnerContentPath)}
              className={editorSelectClassName}
            >
              {partnerContentKinds.map((item) => (
                <option key={item.path} value={item.path}>
                  {item.label}
                </option>
              ))}
            </select>
          </EditorField>

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
              <Link href={QUEUE_PATH + '?kind=' + kind}>Limpar</Link>
            </Button>
          </div>
        </form>

        <section className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-md border border-primary/15 bg-primary-soft text-primary-accent">
              <ClipboardCheck aria-hidden="true" className="size-4.5" />
            </span>
            <div>
              <p className="font-bold">
                {numeric(meta, 'total').toLocaleString('pt-BR')}{' '}
                {numeric(meta, 'total') === 1 ? 'item' : 'itens'} · {kindMeta.label}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Estado atual: {partnerContentStatusMeta[status].label}
              </p>
            </div>
          </div>
        </section>

        {rows.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            headingLevel={2}
            title="Nenhum conteúdo nesta visão"
            description="Altere o tipo ou o estado para consultar outros itens da operação."
            className="rounded-lg border border-dashed border-border bg-card"
          />
        ) : (
          <section aria-label="Conteúdo de parceiros" className="space-y-3">
            {rows.map((row) => {
              const id = numeric(row, 'id')
              const rowStatus = statusValue(text(row, 'status'))
              const statusMeta = partnerContentStatusMeta[rowStatus]
              const establishment = record(row.establishment)
              const organization = record(establishment?.organization)
              const publishedRevision = record(establishment?.published_revision)
              const city = record(publishedRevision?.city)
              const snapshot = record(row.published_snapshot)
              const busy = actionId === id
              const startsAt = text(row, 'starts_at') || null
              const endsAt = text(row, 'ends_at') || null
              const timeZone = text(city, 'timezone') || null
              const media = partnerContentMediaItems(row.media)

              return (
                <article key={id} className="rounded-lg border border-border bg-card p-5">
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

                      <h2 className="mt-3 text-lg font-bold tracking-[-0.02em]">
                        {text(row, 'title', 'Conteúdo sem título')}
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {text(
                          publishedRevision,
                          'public_name',
                          'Unidade ' + numeric(row, 'establishment_id')
                        )}
                        {text(organization, 'trade_name')
                          ? ' · ' + text(organization, 'trade_name')
                          : ''}
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
                      {rowStatus === 'pending_review' && canApprove ? (
                        <Button
                          type="button"
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            action('/backoffice/content/' + kind + '/' + id + '/approve', id)
                          }
                        >
                          {busy ? (
                            <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
                          ) : (
                            <Check aria-hidden="true" className="size-3.5" />
                          )}
                          Aprovar
                        </Button>
                      ) : null}

                      {rowStatus === 'pending_review' && canReject ? (
                        <ConfirmDialog
                          title="Recusar esta versão?"
                          description="O item volta para rascunho. Se já existia uma versão aprovada, ela continua pública."
                          confirmLabel="Recusar versão"
                          processing={busy}
                          onConfirm={() =>
                            action('/backoffice/content/' + kind + '/' + id + '/reject', id)
                          }
                          trigger={
                            <Button type="button" variant="outline" size="sm" disabled={busy}>
                              <X aria-hidden="true" className="size-3.5" />
                              Recusar
                            </Button>
                          }
                        />
                      ) : null}

                      {rowStatus !== 'archived' && canArchive ? (
                        <ConfirmDialog
                          title="Retirar este conteúdo?"
                          description="O item sai da descoberta imediatamente. O histórico permanece para auditoria."
                          confirmLabel="Retirar conteúdo"
                          destructive
                          processing={busy}
                          onConfirm={() =>
                            action('/backoffice/content/' + kind + '/' + id + '/archive', id)
                          }
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
                    canApprove={canApprove}
                    canReject={canReject}
                  />
                  <div className="mt-4 flex flex-col gap-2">
                    {canEdit ? (
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
                </article>
              )
            })}
          </section>
        )}

        <PaginationNav
          currentPage={page}
          lastPage={lastPage}
          buildHref={pageHref}
          label="Paginação do conteúdo de parceiros"
        />

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
                  Estes valores são configuração por tenant; mudar a política não reescreve conteúdo
                  já publicado.
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
