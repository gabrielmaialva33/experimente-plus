import { Head, Link, router } from '@inertiajs/react'
import {
  Archive,
  CalendarDays,
  Edit3,
  Eye,
  Loader2,
  Megaphone,
  PackageOpen,
  Plus,
  Rocket,
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
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Textarea } from '~/components/ui/textarea'
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
      media: partnerContentMediaItems(row.media),
    }))
    .filter((row) => row.id > 0 && row.establishmentId > 0)
}

export default function PartnerContentPage({
  content,
  establishments,
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
  const [editingId, setEditingId] = useState<number | null>(null)
  const [processing, setProcessing] = useState(false)
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

  function resetForm() {
    setForm(emptyForm)
    setEditingId(null)
    setLocalError(null)
  }

  function changeKind(nextKind: PartnerContentPath) {
    setKind(nextKind)
    resetForm()
  }

  function beginEdit(row: ContentRow) {
    const establishment = establishmentById.get(row.establishmentId)
    const timeZone = establishment?.city?.timezone
    setEditingId(row.id)
    setLocalError(null)
    setForm({
      establishmentId: String(row.establishmentId),
      title: row.title,
      description: row.description,
      startsAt: timeZone ? isoToZonedLocal(row.startsAt, timeZone) : '',
      endsAt: timeZone ? isoToZonedLocal(row.endsAt, timeZone) : '',
      priceReais: centsToReais(row.informationalPriceCents),
    })
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
      setLocalError('Selecione uma unidade que você possa gerenciar.')
      return
    }
    if (!form.title.trim()) {
      setLocalError('Informe um título para o conteúdo.')
      return
    }

    const payload: Record<string, string | number | null> = {
      ...(editingId === null ? { establishment_id: establishment.id } : {}),
      title: form.title.trim(),
      description: form.description.trim() || null,
    }

    if (kind === 'events') {
      if (!establishment.city?.timezone) {
        setLocalError('Defina a cidade da unidade antes de cadastrar um evento.')
        return
      }
      if (!form.startsAt || !form.endsAt) {
        setLocalError('Informe o início e o fim do evento.')
        return
      }

      const startsAt = zonedLocalToIso(form.startsAt, establishment.city.timezone)
      const endsAt = zonedLocalToIso(form.endsAt, establishment.city.timezone)
      if (!startsAt || !endsAt) {
        setLocalError('Os horários informados não são válidos no fuso da cidade.')
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
      <Head title="Conteúdo do parceiro" />

      <div className="space-y-7">
        <PageHeader
          eyebrow="Portal do parceiro"
          icon={Megaphone}
          title="Conteúdo do parceiro"
          description="Publique experiências, eventos e itens de vitrine sem misturar esse conteúdo com a revisão da ficha da unidade."
        />

        <div
          className="grid gap-2 rounded-lg border border-border bg-card p-2 sm:grid-cols-3"
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
                  'rounded-md border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selected
                    ? 'border-primary/25 bg-primary-soft text-primary-accent'
                    : 'border-transparent hover:bg-accent'
                )}
              >
                <span className="block text-sm font-bold">{item.label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {count} {count === 1 ? 'item' : 'itens'}
                </span>
              </button>
            )
          })}
        </div>

        <section className="grid gap-4 sm:grid-cols-3" aria-label="Resumo do conteúdo selecionado">
          {[
            ['Rascunhos', draftCount, 'bg-muted text-muted-foreground'],
            ['Em análise', pendingCount, 'bg-warning/15 text-warning-foreground'],
            ['Publicados', publishedCount, 'bg-success/10 text-success'],
          ].map(([label, count, className]) => (
            <div key={String(label)} className="rounded-lg border border-border bg-card p-4">
              <span
                className={cn('inline-flex rounded-md px-2 py-1 text-xs font-semibold', className)}
              >
                {label}
              </span>
              <p className="mt-3 text-2xl font-bold tabular-nums">{Number(count)}</p>
            </div>
          ))}
        </section>

        {manageableEstablishments.length > 0 ? (
          <section className="rounded-lg border border-border bg-card p-5 sm:p-6">
            <div className="flex flex-col gap-2 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                  {editingId === null ? 'Novo conteúdo' : 'Editar conteúdo'}
                </p>
                <h2 className="mt-1 text-xl font-bold tracking-[-0.02em]">
                  {editingId === null
                    ? 'Adicionar ' + currentKind.singular
                    : 'Atualizar ' + currentKind.singular}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{currentKind.description}</p>
              </div>
              {editingId !== null ? (
                <Button type="button" variant="outline" onClick={resetForm} disabled={processing}>
                  <X aria-hidden="true" className="size-4" />
                  Cancelar edição
                </Button>
              ) : null}
            </div>

            <form onSubmit={submit} aria-busy={processing} className="mt-5 grid gap-4">
              <EditorField htmlFor="content-establishment" label="Unidade">
                <select
                  id="content-establishment"
                  required
                  value={form.establishmentId}
                  onChange={(event) => updateField('establishmentId', event.target.value)}
                  className={editorSelectClassName}
                  disabled={processing || editingId !== null}
                >
                  <option value="">Selecione uma unidade</option>
                  {manageableEstablishments.map((establishment) => (
                    <option key={establishment.id} value={establishment.id}>
                      {establishment.public_name} · {establishment.organization_name}
                    </option>
                  ))}
                </select>
              </EditorField>

              <EditorField htmlFor="content-title" label="Título">
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
                hint="Opcional · até 4.000 caracteres"
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
                    hint={
                      selectedEstablishment?.city
                        ? 'Fuso: ' + selectedEstablishment.city.timezone
                        : 'Selecione uma unidade com cidade definida'
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
                  <EditorField htmlFor="content-end" label="Fim">
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
                  hint="Opcional · apenas exibição; não cria produto nem checkout"
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
                  className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {localError}
                </p>
              ) : null}
              {Object.keys(errors).length > 0 ? (
                <p
                  role="alert"
                  className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  Revise os campos informados e tente novamente.
                </p>
              ) : null}

              <div className="flex justify-end">
                <Button type="submit" size="lg" disabled={processing}>
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
              title={'Nenhuma ' + currentKind.singular + ' cadastrada'}
              description={
                manageableEstablishments.length > 0
                  ? 'Use o formulário acima para criar o primeiro item.'
                  : 'Ainda não há conteúdo deste tipo nas unidades disponíveis para sua conta.'
              }
              className="rounded-lg border border-dashed border-border bg-card"
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
                  <article key={row.id} className="rounded-lg border border-border bg-card p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              'inline-flex rounded-full border px-2.5 py-0.5 text-[0.68rem] font-semibold',
                              meta.className
                            )}
                          >
                            {meta.label}
                          </span>
                          {row.status === 'pending_review' && row.publishedSnapshot ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                              <Eye aria-hidden="true" className="size-3.5" />
                              versão anterior continua pública
                            </span>
                          ) : null}
                        </div>
                        <h2 className="mt-3 text-lg font-bold tracking-[-0.02em]">{row.title}</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {establishment?.public_name || 'Unidade ' + row.establishmentId}
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

                    {row.description ? (
                      <p className="mt-4 whitespace-pre-line text-sm leading-6 text-muted-foreground">
                        {row.description}
                      </p>
                    ) : null}

                    {startsAt && endsAt ? (
                      <p className="mt-4 text-sm font-medium">
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

                    <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
                      <Button asChild variant="outline" size="sm">
                        <Link href={'/portal/establishments/' + row.establishmentId}>
                          <Store aria-hidden="true" className="size-3.5" />
                          Unidade
                        </Link>
                      </Button>

                      {canUpdate && row.status !== 'archived' ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => beginEdit(row)}
                          disabled={busy}
                        >
                          <Edit3 aria-hidden="true" className="size-3.5" />
                          Editar
                        </Button>
                      ) : null}

                      {canSubmit && row.status === 'draft' ? (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() =>
                            runAction('/portal/content/' + kind + '/' + row.id + '/submit', row.id)
                          }
                          disabled={busy}
                        >
                          {busy ? (
                            <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
                          ) : (
                            <Rocket aria-hidden="true" className="size-3.5" />
                          )}
                          Publicar
                        </Button>
                      ) : null}

                      {canArchive && row.status !== 'archived' ? (
                        <ConfirmDialog
                          title="Arquivar este conteúdo?"
                          description="Ele sairá da descoberta pública imediatamente, mas o histórico será preservado."
                          confirmLabel="Arquivar"
                          destructive
                          processing={busy}
                          onConfirm={() =>
                            runAction('/portal/content/' + kind + '/' + row.id + '/archive', row.id)
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
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <p className="text-xs leading-5 text-muted-foreground">
          A tela mostra até 100 itens de cada tipo neste corte do piloto. Conteúdo arquivado
          continua no histórico e não volta à descoberta automaticamente.
        </p>
      </div>
    </MainLayout>
  )
}
