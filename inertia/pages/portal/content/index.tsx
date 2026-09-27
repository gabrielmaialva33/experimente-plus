import { Head, Link, router } from '@inertiajs/react'
import {
  Archive,
  CalendarDays,
  Edit3,
  Eye,
  Loader2,
  Megaphone,
  MessageSquareWarning,
  PackageOpen,
  Plus,
  Rocket,
  Send,
  Store,
  X,
} from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'

import { ConfirmDialog } from '~/components/confirm_dialog'
import { EmptyState } from '~/components/empty_state'
import { PageHeader } from '~/components/page_header'
import {
  EditorField,
  editorSelectClassName,
} from '~/components/portal/establishment_editor/editor_field'
import { PartnerContentMediaManager } from '~/components/portal/partner_content_media_manager'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Textarea } from '~/components/ui/textarea'
import { useUnsavedChangesGuard } from '~/hooks/use_unsaved_changes_guard'
import { MainLayout } from '~/layouts/main_layout'
import { collection, numeric, record, text, type JsonRecord } from '~/lib/json'
import {
  centsToReais,
  formatPartnerContentDate,
  isoToZonedLocal,
  partnerContentKinds,
  partnerContentStatusMeta,
  reaisToCents,
  type PartnerContentPath,
  type PartnerContentStatus,
  zonedLocalToIso,
} from '~/lib/partner_content'
import { partnerContentMediaItems, type PartnerContentMediaItem } from '~/lib/partner_content_media'
import { cn } from '~/lib/utils'

interface EstablishmentOption {
  id: number
  organization_id: number
  organization_name: string
  public_name: string
  city: {
    id: number
    name: string
    state_code: string
    timezone: string
  } | null
  allowed_actions: {
    update: boolean
    submit: boolean
    archive: boolean
  }
}

interface PartnerContentPageProps {
  content: {
    experiences: unknown
    events: unknown
    showcase_items: unknown
  }
  establishments: EstablishmentOption[]
  /** Per kind: whether sending queues the item for a person to review. */
  requires_approval?: Partial<Record<PartnerContentPath, boolean>>
  tenant_id: number
  errors?: Record<string, string>
}

interface ContentRow {
  id: number
  establishmentId: number
  title: string
  description: string
  status: PartnerContentStatus
  startsAt: string | null
  endsAt: string | null
  informationalPriceCents: number | null
  publishedAt: string | null
  publishedSnapshot: JsonRecord | null
  /** Set while the moderation's last refusal is the item's current state. */
  rejectionReason: string | null
  rejectedAt: string | null
  media: PartnerContentMediaItem[]
}

interface FormState {
  establishmentId: string
  title: string
  description: string
  startsAt: string
  endsAt: string
  priceReais: string
}

/** Partner-facing copy per kind; the shared labels also serve the backoffice. */
const KIND_COPY: Record<
  PartnerContentPath,
  { description: string; empty: string; createFirst: string }
> = {
  'experiences': {
    description: 'Atividades e vivências que o lugar oferece.',
    empty: 'Nenhuma experiência ainda',
    createFirst: 'Use o formulário acima para criar a primeira.',
  },
  'events': {
    description: 'Programação com data e horário de início e fim.',
    empty: 'Nenhum evento ainda',
    createFirst: 'Use o formulário acima para criar o primeiro.',
  },
  'showcase-items': {
    description: 'Itens em destaque, com preço opcional só para exibição.',
    empty: 'Nenhum item de vitrine ainda',
    createFirst: 'Use o formulário acima para criar o primeiro.',
  },
}

const emptyForm: FormState = {
  establishmentId: '',
  title: '',
  description: '',
  startsAt: '',
  endsAt: '',
  priceReais: '',
}

function validStatus(value: string): PartnerContentStatus {
  return value === 'pending_review' ||
    value === 'published' ||
    value === 'archived' ||
    value === 'draft'
    ? value
    : 'draft'
}

function contentRows(value: unknown): ContentRow[] {
  return collection(value)
    .map((row) => ({
      id: numeric(row, 'id'),
      establishmentId: numeric(row, 'establishment_id'),
      title: text(row, 'title'),
      description: text(row, 'description'),
      status: validStatus(text(row, 'status')),
      startsAt: text(row, 'starts_at') || null,
      endsAt: text(row, 'ends_at') || null,
      informationalPriceCents:
        row.informational_price_cents === null || row.informational_price_cents === undefined
          ? null
          : numeric(row, 'informational_price_cents'),
      publishedAt: text(row, 'published_at') || null,
      publishedSnapshot: record(row.published_snapshot),
      rejectionReason: text(row, 'rejection_reason') || null,
      rejectedAt: text(row, 'rejected_at') || null,
      media: partnerContentMediaItems(row.media),
    }))
    .filter((row) => row.id > 0 && row.establishmentId > 0)
}

export default function PartnerContentPage({
  content,
  establishments,
  requires_approval: requiresApproval = {},
  errors = {},
  tenant_id: tenantId,
}: PartnerContentPageProps) {
  const rowsByKind = useMemo(
    () => ({
      'experiences': contentRows(content.experiences),
      'events': contentRows(content.events),
      'showcase-items': contentRows(content.showcase_items),
    }),
    [content]
  )
  const [kind, setKind] = useState<PartnerContentPath>('experiences')
  const [form, setForm] = useState<FormState>(emptyForm)
  // What the form held when it was last emptied or loaded for editing: anything else
  // is typing that a visit, a tab change or another "Editar" would throw away.
  const [savedForm, setSavedForm] = useState<FormState>(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [processing, setProcessing] = useState(false)
  const { allowNextVisit, confirmDiscard } = useUnsavedChangesGuard({
    enabled: !processing && JSON.stringify(form) !== JSON.stringify(savedForm),
  })
  const [actionId, setActionId] = useState<number | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  const establishmentById = useMemo(
    () => new Map(establishments.map((establishment) => [establishment.id, establishment])),
    [establishments]
  )
  const rows = rowsByKind[kind]
  const currentKind = partnerContentKinds.find((item) => item.path === kind)!
  const manageableEstablishments = establishments.filter(
    (establishment) => establishment.allowed_actions.update
  )
  const selectedEstablishment = establishmentById.get(Number(form.establishmentId)) ?? null
  const publishedCount = rows.filter((row) => row.status === 'published').length
  const pendingCount = rows.filter((row) => row.status === 'pending_review').length
  const draftCount = rows.filter((row) => row.status === 'draft').length
  const needsReview = requiresApproval[kind] === true

  function resetForm() {
    setForm(emptyForm)
    setSavedForm(emptyForm)
    setEditingId(null)
    setLocalError(null)
  }

  function cancelEdit() {
    if (!confirmDiscard()) return
    resetForm()
  }

  function changeKind(nextKind: PartnerContentPath) {
    if (nextKind === kind || !confirmDiscard()) return
    setKind(nextKind)
    resetForm()
  }

  function beginEdit(row: ContentRow) {
    if (!confirmDiscard()) return
    const establishment = establishmentById.get(row.establishmentId)
    const timeZone = establishment?.city?.timezone
    const loaded: FormState = {
      establishmentId: String(row.establishmentId),
      title: row.title,
      description: row.description,
      startsAt: timeZone ? isoToZonedLocal(row.startsAt, timeZone) : '',
      endsAt: timeZone ? isoToZonedLocal(row.endsAt, timeZone) : '',
      priceReais: centsToReais(row.informationalPriceCents),
    }
    setEditingId(row.id)
    setLocalError(null)
    setForm(loaded)
    setSavedForm(loaded)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function updateField<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLocalError(null)

    const establishment = establishmentById.get(Number(form.establishmentId))
    if (!establishment || !establishment.allowed_actions.update) {
      setLocalError('Selecione um lugar que você possa gerenciar.')
      return
    }
    if (!form.title.trim()) {
      setLocalError('Informe um título.')
      return
    }

    const payload: Record<string, string | number | null> = {
      ...(editingId === null ? { establishment_id: establishment.id } : {}),
      title: form.title.trim(),
      description: form.description.trim() || null,
    }

    if (kind === 'events') {
      if (!establishment.city?.timezone) {
        setLocalError('Defina a cidade do lugar antes de cadastrar um evento.')
        return
      }
      if (!form.startsAt || !form.endsAt) {
        setLocalError('Informe o início e o fim do evento.')
        return
      }

      const startsAt = zonedLocalToIso(form.startsAt, establishment.city.timezone)
      const endsAt = zonedLocalToIso(form.endsAt, establishment.city.timezone)
      if (!startsAt || !endsAt) {
        setLocalError('Os horários informados não são válidos na cidade do lugar.')
        return
      }
      if (new Date(endsAt) <= new Date(startsAt)) {
        setLocalError('O término do evento precisa ser posterior ao início.')
        return
      }
      payload.starts_at = startsAt
      payload.ends_at = endsAt
    }

    if (kind === 'showcase-items') {
      const cents = reaisToCents(form.priceReais)
      if (form.priceReais.trim() && cents === null) {
        setLocalError('Informe um preço válido ou deixe o campo vazio.')
        return
      }
      payload.informational_price_cents = cents
    }

    setProcessing(true)
    const options = {
      preserveScroll: true,
      onSuccess: resetForm,
      onFinish: () => setProcessing(false),
    }

    allowNextVisit()
    if (editingId === null) {
      router.post('/portal/content/' + kind, payload, options)
    } else {
      router.put('/portal/content/' + kind + '/' + editingId, payload, options)
    }
  }

  function runAction(path: string, id: number) {
    setActionId(id)
    router.post(path, {}, { preserveScroll: true, onFinish: () => setActionId(null) })
  }

  return (
    <MainLayout>
      <Head title="Experiências e eventos" />

      <div className="space-y-6">
        <PageHeader
          title="Experiências e eventos"
          description="Divulgue experiências, eventos e itens de vitrine dos seus lugares. Eles aparecem no app e no site, separados dos dados do lugar."
        />

        <div
          className="flex w-full min-w-0 gap-1 rounded-[1.75rem] bg-muted p-1 sm:inline-flex sm:w-auto sm:self-start sm:rounded-full"
          role="tablist"
          aria-label="Tipos de conteúdo"
        >
          {partnerContentKinds.map((item) => {
            const count = rowsByKind[item.path].length
            const selected = item.path === kind
            return (
              <button
                key={item.path}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => changeKind(item.path)}
                className={cn(
                  // The tabs share a phone's width; where a label and its count no longer
                  // fit (a 320 px phone), the count drops under the label instead of pushing
                  // the last tab off screen.
                  'inline-flex min-h-10 min-w-0 flex-auto flex-wrap pointer-coarse:min-h-11 items-center justify-center gap-x-1.5 gap-y-0.5 rounded-full px-1.5 py-1 text-[0.8125rem] transition-colors sm:h-10 sm:flex-none sm:flex-nowrap sm:gap-2 sm:px-4 sm:py-0 sm:text-[0.9375rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-muted motion-reduce:transition-none',
                  selected
                    ? 'bg-primary font-bold text-primary-foreground'
                    : 'font-semibold text-foreground hover:bg-background'
                )}
              >
                <span className="whitespace-nowrap">{item.label}</span>{' '}
                <span
                  className={cn(
                    'rounded-full px-2 text-xs font-bold tabular-nums',
                    selected ? 'bg-primary-foreground/20' : 'bg-background'
                  )}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Three tiles from 360 px; below it a tile is too narrow for its status pill, so
            the three become rows with the count beside the pill. */}
        <section
          className="grid grid-cols-1 gap-3 min-[22.5rem]:grid-cols-3"
          aria-label="Resumo do conteúdo selecionado"
        >
          {(
            [
              ['Rascunhos', draftCount, 'neutral'],
              ['Em análise', pendingCount, 'info'],
              ['Publicados', publishedCount, 'success'],
            ] as const
          ).map(([label, count, variant]) => (
            <div
              key={label}
              className="flex min-w-0 items-center justify-between gap-3 rounded-card border border-border-subtle bg-card p-3 min-[22.5rem]:block sm:p-5"
            >
              <Badge
                variant={variant}
                appearance="light"
                shape="pill"
                size="sm"
                className="whitespace-nowrap"
              >
                {label}
              </Badge>
              <p className="font-display text-2xl font-extrabold tabular-nums min-[22.5rem]:mt-3 min-[22.5rem]:text-3xl">
                {count}
              </p>
            </div>
          ))}
        </section>

        {manageableEstablishments.length > 0 ? (
          <section className="rounded-card border border-border-subtle bg-card p-5 sm:p-6">
            <div className="flex flex-col gap-3 border-b border-border-subtle pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-display text-xl font-bold tracking-[-0.02em]">
                  {editingId === null
                    ? 'Adicionar ' + currentKind.singular
                    : 'Atualizar ' + currentKind.singular}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{KIND_COPY[kind].description}</p>
              </div>
              {editingId !== null ? (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  shape="pill"
                  onClick={cancelEdit}
                  disabled={processing}
                >
                  <X aria-hidden="true" className="size-4" />
                  Cancelar edição
                </Button>
              ) : null}
            </div>

            <form onSubmit={submit} aria-busy={processing} className="mt-5 grid gap-4">
              <EditorField htmlFor="content-establishment" label="Lugar" required>
                <select
                  id="content-establishment"
                  required
                  value={form.establishmentId}
                  onChange={(event) => updateField('establishmentId', event.target.value)}
                  className={editorSelectClassName}
                  disabled={processing || editingId !== null}
                >
                  <option value="">Selecione um lugar</option>
                  {manageableEstablishments.map((establishment) => (
                    <option key={establishment.id} value={establishment.id}>
                      {establishment.public_name} · {establishment.organization_name}
                    </option>
                  ))}
                </select>
              </EditorField>

              <EditorField htmlFor="content-title" label="Título" required>
                <Input
                  id="content-title"
                  required
                  maxLength={180}
                  value={form.title}
                  onChange={(event) => updateField('title', event.target.value)}
                  disabled={processing}
                />
              </EditorField>

              <EditorField
                htmlFor="content-description"
                label="Descrição"
                hint="opcional · até 4.000 caracteres"
              >
                <Textarea
                  id="content-description"
                  rows={4}
                  maxLength={4000}
                  value={form.description}
                  onChange={(event) => updateField('description', event.target.value)}
                  disabled={processing}
                />
              </EditorField>

              {kind === 'events' ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <EditorField
                    htmlFor="content-start"
                    label="Início"
                    required
                    hint={
                      selectedEstablishment?.city
                        ? 'Horário de ' + selectedEstablishment.city.name
                        : 'Selecione um lugar com cidade definida'
                    }
                  >
                    <Input
                      id="content-start"
                      type="datetime-local"
                      required
                      value={form.startsAt}
                      onChange={(event) => updateField('startsAt', event.target.value)}
                      disabled={processing || !selectedEstablishment?.city}
                    />
                  </EditorField>
                  <EditorField htmlFor="content-end" label="Fim" required>
                    <Input
                      id="content-end"
                      type="datetime-local"
                      required
                      value={form.endsAt}
                      onChange={(event) => updateField('endsAt', event.target.value)}
                      disabled={processing || !selectedEstablishment?.city}
                    />
                  </EditorField>
                </div>
              ) : null}

              {kind === 'showcase-items' ? (
                <EditorField
                  htmlFor="content-price"
                  label="Preço informativo"
                  hint="opcional · só para exibição, sem venda"
                >
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
                      R$
                    </span>
                    <Input
                      id="content-price"
                      inputMode="decimal"
                      placeholder="0,00"
                      className="pl-10"
                      value={form.priceReais}
                      onChange={(event) => updateField('priceReais', event.target.value)}
                      disabled={processing}
                    />
                  </div>
                </EditorField>
              ) : null}

              {localError ? (
                <p
                  role="alert"
                  className="rounded-xl border border-destructive/25 bg-destructive-soft px-3 py-2 text-sm text-destructive-accent"
                >
                  {localError}
                </p>
              ) : null}
              {Object.keys(errors).length > 0 ? (
                <p
                  role="alert"
                  className="rounded-xl border border-destructive/25 bg-destructive-soft px-3 py-2 text-sm text-destructive-accent"
                >
                  Revise os campos informados e tente novamente.
                </p>
              ) : null}

              <div className="flex justify-end">
                <Button type="submit" size="xl" shape="pill" disabled={processing}>
                  {processing ? (
                    <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                  ) : editingId === null ? (
                    <Plus aria-hidden="true" className="size-4" />
                  ) : (
                    <Edit3 aria-hidden="true" className="size-4" />
                  )}
                  {processing
                    ? 'Salvando…'
                    : editingId === null
                      ? 'Criar rascunho'
                      : 'Salvar alterações'}
                </Button>
              </div>
            </form>
          </section>
        ) : null}

        <section aria-label={currentKind.label} className="space-y-4">
          {rows.length === 0 ? (
            <EmptyState
              icon={PackageOpen}
              headingLevel={2}
              title={KIND_COPY[kind].empty}
              description={
                manageableEstablishments.length > 0
                  ? KIND_COPY[kind].createFirst
                  : 'Ainda não há conteúdo deste tipo nos lugares da sua conta.'
              }
              className="rounded-card border border-dashed border-border bg-card"
            />
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {rows.map((row) => {
                const establishment = establishmentById.get(row.establishmentId)
                const meta = partnerContentStatusMeta[row.status]
                const busy = actionId === row.id
                const canUpdate = establishment?.allowed_actions.update === true
                const canSubmit = establishment?.allowed_actions.submit === true
                const canArchive = establishment?.allowed_actions.archive === true
                const startsAt =
                  kind === 'events'
                    ? formatPartnerContentDate(row.startsAt, establishment?.city?.timezone)
                    : null
                const endsAt =
                  kind === 'events'
                    ? formatPartnerContentDate(row.endsAt, establishment?.city?.timezone)
                    : null

                return (
                  <article
                    key={row.id}
                    className="rounded-card border border-border-subtle bg-card p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {row.rejectionReason && row.status === 'draft' ? (
                            <span className="inline-flex h-6 items-center rounded-full border border-destructive/30 bg-destructive-soft px-2.5 text-xs font-bold text-destructive-accent">
                              Recusado
                            </span>
                          ) : (
                            <span
                              className={cn(
                                'inline-flex h-6 items-center rounded-full border px-2.5 text-xs font-bold',
                                meta.className
                              )}
                            >
                              {meta.label}
                            </span>
                          )}
                          {row.status === 'pending_review' && row.publishedSnapshot ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                              <Eye aria-hidden="true" className="size-3.5" />
                              versão anterior continua pública
                            </span>
                          ) : null}
                        </div>
                        <h2 className="mt-3 font-display text-lg font-bold tracking-[-0.02em]">
                          {row.title}
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {establishment?.public_name || 'Lugar ' + row.establishmentId}
                          {establishment?.organization_name
                            ? ' · ' + establishment.organization_name
                            : ''}
                        </p>
                      </div>
                      {kind === 'events' ? (
                        <CalendarDays aria-hidden="true" className="size-5 shrink-0 text-primary" />
                      ) : kind === 'showcase-items' ? (
                        <Store aria-hidden="true" className="size-5 shrink-0 text-primary" />
                      ) : (
                        <Megaphone aria-hidden="true" className="size-5 shrink-0 text-primary" />
                      )}
                    </div>

                    {row.rejectionReason ? (
                      <section
                        aria-label="Recusa da moderação"
                        className="mt-4 rounded-2xl border border-destructive/30 bg-destructive-soft p-4 text-destructive-accent"
                      >
                        <p className="flex items-center gap-2 text-sm font-bold">
                          <MessageSquareWarning aria-hidden="true" className="size-4 shrink-0" />
                          {row.status === 'published'
                            ? 'Sua alteração foi recusada pela moderação'
                            : 'Recusado pela moderação'}
                          {row.rejectedAt
                            ? ' · ' +
                              formatPartnerContentDate(
                                row.rejectedAt,
                                establishment?.city?.timezone
                              )
                            : ''}
                        </p>
                        <p className="mt-2 whitespace-pre-line text-sm leading-6 text-foreground">
                          {row.rejectionReason}
                        </p>
                        <p className="mt-2 text-xs text-foreground">
                          {row.status === 'published'
                            ? 'A versão aprovada continua no ar. Edite e a alteração volta para análise.'
                            : 'Edite o item e envie de novo quando estiver pronto.'}
                        </p>
                      </section>
                    ) : null}

                    {row.description ? (
                      <p className="mt-4 whitespace-pre-line text-sm leading-6 text-muted-foreground">
                        {row.description}
                      </p>
                    ) : null}

                    {startsAt && endsAt ? (
                      <p className="mt-4 inline-flex items-center gap-2 text-sm font-semibold">
                        <CalendarDays aria-hidden="true" className="size-4 text-primary" />
                        {startsAt} → {endsAt}
                      </p>
                    ) : null}

                    {kind === 'showcase-items' && row.informationalPriceCents !== null ? (
                      <p className="mt-4 text-lg font-bold text-cta-accent">
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        }).format(row.informationalPriceCents / 100)}
                      </p>
                    ) : null}

                    <PartnerContentMediaManager
                      tenantId={tenantId}
                      kind={kind}
                      contentId={row.id}
                      media={row.media}
                      editable={canUpdate && row.status !== 'archived'}
                    />

                    <div className="mt-5 flex flex-wrap gap-2 border-t border-border-subtle pt-4">
                      <Button asChild variant="ghost" size="md" shape="pill">
                        <Link href={'/portal/establishments/' + row.establishmentId}>
                          <Store aria-hidden="true" className="size-4" />
                          Ver lugar
                        </Link>
                      </Button>

                      {canUpdate && row.status !== 'archived' ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="md"
                          shape="pill"
                          onClick={() => beginEdit(row)}
                          disabled={busy}
                        >
                          <Edit3 aria-hidden="true" className="size-4" />
                          Editar
                        </Button>
                      ) : null}

                      {canSubmit && row.status === 'draft' ? (
                        <Button
                          type="button"
                          size="md"
                          shape="pill"
                          onClick={() =>
                            runAction('/portal/content/' + kind + '/' + row.id + '/submit', row.id)
                          }
                          disabled={busy}
                        >
                          {busy ? (
                            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                          ) : needsReview ? (
                            <Send aria-hidden="true" className="size-4" />
                          ) : (
                            <Rocket aria-hidden="true" className="size-4" />
                          )}
                          {needsReview ? 'Enviar para análise' : 'Publicar'}
                        </Button>
                      ) : null}

                      {canArchive && row.status !== 'archived' ? (
                        <ConfirmDialog
                          title="Arquivar este conteúdo?"
                          description="Ele sai do app e do site na hora, mas o histórico fica guardado."
                          confirmLabel="Arquivar"
                          destructive
                          processing={busy}
                          onConfirm={() =>
                            runAction('/portal/content/' + kind + '/' + row.id + '/archive', row.id)
                          }
                          trigger={
                            <Button
                              type="button"
                              variant="ghost"
                              size="md"
                              shape="pill"
                              className="ms-auto"
                              disabled={busy}
                            >
                              <Archive aria-hidden="true" className="size-4" />
                              Arquivar
                            </Button>
                          }
                        />
                      ) : null}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <p className="text-xs leading-5 text-muted-foreground">
          Esta tela mostra até 100 itens de cada tipo. O que for arquivado continua no histórico e
          não volta ao app e ao site sozinho.
        </p>
      </div>
    </MainLayout>
  )
}
