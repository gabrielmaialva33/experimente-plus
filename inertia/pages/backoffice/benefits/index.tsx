import { Head, Link, router } from '@inertiajs/react'
import {
  Archive,
  CalendarDays,
  CirclePause,
  Edit3,
  Loader2,
  Plus,
  Rocket,
  TicketPercent,
  UsersRound,
  X,
} from 'lucide-react'
import { useMemo, useRef, useState, type FormEvent } from 'react'

import { ConfirmDialog } from '~/components/confirm_dialog'
import { EmptyState } from '~/components/empty_state'
import { PageHeader } from '~/components/page_header'
import {
  EditorField,
  editorSelectClassName,
} from '~/components/portal/establishment_editor/editor_field'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Textarea } from '~/components/ui/textarea'
import { useAuth } from '~/hooks/use_auth'
import { MainLayout } from '~/layouts/main_layout'
import { cn } from '~/lib/utils'

interface CityOption {
  id: number
  name: string
  state_code: string
}

interface EditionOffer {
  id: number
  status: string
}

interface EditionAccess {
  id: number
  status: string
}

interface BenefitEdition {
  id: number
  city_id: number
  name: string
  slug: string
  description: string | null
  price_cents: number
  currency: string
  sales_starts_at: string | null
  sales_ends_at: string | null
  usage_starts_at: string
  usage_ends_at: string
  status: string
  city: CityOption
  offers: EditionOffer[]
  accesses: EditionAccess[]
}

interface BenefitsBackofficeProps {
  editions: BenefitEdition[]
  cities: CityOption[]
  errors?: Record<string, string>
}

interface EditionFormState {
  city_id: string
  name: string
  description: string
  price_reais: string
  sales_starts_on: string
  sales_ends_on: string
  usage_starts_on: string
  usage_ends_on: string
}

const emptyForm: EditionFormState = {
  city_id: '',
  name: '',
  description: '',
  price_reais: '',
  sales_starts_on: '',
  sales_ends_on: '',
  usage_starts_on: '',
  usage_ends_on: '',
}

const statusMeta: Record<string, { label: string; className: string }> = {
  draft: {
    label: 'Rascunho',
    className: 'border-border bg-muted text-muted-foreground',
  },
  published: {
    label: 'Publicada',
    className: 'border-success/25 bg-success/10 text-success',
  },
  paused: {
    label: 'Pausada',
    className: 'border-warning/25 bg-warning/10 text-warning-foreground',
  },
  archived: {
    label: 'Arquivada',
    className: 'border-border bg-muted/60 text-muted-foreground',
  },
}

function dateOnly(value: string | null): string {
  if (!value) return ''
  return value.slice(0, 10)
}

function toIsoDate(value: string, endOfDay = false): string {
  return `${value}T${endOfDay ? '23:59:59' : '00:00:00'}-03:00`
}

function parsePriceToCents(value: string): number | null {
  const normalized = value.trim().replace(',', '.')
  if (!normalized) return 0
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return Math.round(parsed * 100)
}

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(cents / 100)
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(value))
}

export default function BenefitsBackofficePage({
  editions,
  cities,
  errors = {},
}: BenefitsBackofficeProps) {
  const { can } = useAuth()
  const canCreate = can('benefit_editions.create')
  const canUpdate = can('benefit_editions.update')
  const canArchive = can('benefit_editions.archive')
  const canListAccesses = can('benefit_accesses.list')
  const [form, setForm] = useState<EditionFormState>(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [processing, setProcessing] = useState(false)
  const [actionId, setActionId] = useState<number | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<BenefitEdition | null>(null)
  const archiveOperationRef = useRef(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const activeEditionCount = useMemo(
    () => editions.filter((edition) => edition.status === 'published').length,
    [editions]
  )
  const showEditionForm = canCreate || editingId !== null

  function updateField<Key extends keyof EditionFormState>(key: Key, value: EditionFormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function resetForm() {
    setForm(emptyForm)
    setEditingId(null)
    setLocalError(null)
  }

  function beginEdit(edition: BenefitEdition) {
    if (!canUpdate) return
    setEditingId(edition.id)
    setLocalError(null)
    setForm({
      city_id: String(edition.city_id),
      name: edition.name,
      description: edition.description ?? '',
      price_reais: (edition.price_cents / 100).toFixed(2).replace('.', ','),
      sales_starts_on: dateOnly(edition.sales_starts_at),
      sales_ends_on: dateOnly(edition.sales_ends_at),
      usage_starts_on: dateOnly(edition.usage_starts_at),
      usage_ends_on: dateOnly(edition.usage_ends_at),
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (editingId ? !canUpdate : !canCreate) return
    setLocalError(null)

    const priceCents = parsePriceToCents(form.price_reais)
    if (priceCents === null) {
      setLocalError('Informe um preço válido, usando somente números e vírgula ou ponto.')
      return
    }
    if (!form.city_id || !form.name.trim() || !form.usage_starts_on || !form.usage_ends_on) {
      setLocalError('Cidade, nome e período de utilização são obrigatórios.')
      return
    }
    if (Boolean(form.sales_starts_on) !== Boolean(form.sales_ends_on)) {
      setLocalError('Preencha as duas datas de venda ou deixe ambas vazias.')
      return
    }

    const payload = {
      city_id: Number(form.city_id),
      name: form.name.trim(),
      description: form.description.trim() || null,
      price_cents: priceCents,
      currency: 'BRL',
      sales_starts_at: form.sales_starts_on ? toIsoDate(form.sales_starts_on) : null,
      sales_ends_at: form.sales_ends_on ? toIsoDate(form.sales_ends_on, true) : null,
      usage_starts_at: toIsoDate(form.usage_starts_on),
      usage_ends_at: toIsoDate(form.usage_ends_on, true),
    }

    setProcessing(true)
    const options = {
      preserveScroll: true,
      onSuccess: resetForm,
      onFinish: () => setProcessing(false),
    }

    if (editingId) {
      router.put(`/backoffice/benefits/${editingId}`, payload, options)
    } else {
      router.post('/backoffice/benefits', payload, options)
    }
  }

  function runAction(path: string, editionId: number, method: 'post' | 'delete') {
    setActionId(editionId)
    const options = {
      preserveScroll: true,
      onFinish: () => setActionId(null),
    }

    if (method === 'delete') {
      router.delete(path, options)
      return
    }
    router.post(path, {}, options)
  }

  function archive() {
    if (!archiveTarget || !canArchive || archiveOperationRef.current) return

    const editionId = archiveTarget.id
    archiveOperationRef.current = true
    setActionId(editionId)
    router.delete(`/backoffice/benefits/${editionId}`, {
      preserveScroll: true,
      onSuccess: () => setArchiveTarget(null),
      onFinish: () => {
        archiveOperationRef.current = false
        setActionId(null)
      },
    })
  }

  return (
    <MainLayout>
      <Head title="Edições e benefícios" />

      <div className="space-y-7">
        <PageHeader
          eyebrow="Operação comercial"
          icon={TicketPercent}
          title="Edições e benefícios"
          description="Organize cada edição por cidade, validade e preço. A publicação só é liberada quando existe ao menos uma oferta ativa."
          meta={
            <>
              <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold">
                {editions.length} {editions.length === 1 ? 'edição' : 'edições'}
              </span>
              <span className="rounded-full border border-success/20 bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                {activeEditionCount} {activeEditionCount === 1 ? 'publicada' : 'publicadas'}
              </span>
            </>
          }
        />

        <div
          className={cn(
            'grid gap-6 xl:items-start',
            (canCreate || canUpdate) && 'xl:grid-cols-[minmax(19rem,0.8fr)_minmax(0,1.2fr)]'
          )}
        >
          {canCreate || canUpdate ? (
            <section className="rounded-lg border border-border bg-card p-5 sm:p-6 xl:sticky xl:top-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                    {editingId ? 'Editar edição' : canCreate ? 'Nova edição' : 'Edição existente'}
                  </p>
                  <h2 className="mt-1 text-xl font-bold tracking-[-0.025em]">
                    {editingId
                      ? 'Ajuste o período e a apresentação'
                      : canCreate
                        ? 'Prepare a próxima edição'
                        : 'Selecione uma edição para editar'}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {showEditionForm
                      ? 'Informe o valor de referência da edição. Acessos são administrados separadamente e não alteram a publicação das ofertas.'
                      : 'Use a ação Editar em uma edição disponível para carregar seus dados neste painel.'}
                  </p>
                </div>
                {editingId ? (
                  <Button type="button" variant="ghost" size="icon" onClick={resetForm}>
                    <X />
                    <span className="sr-only">Cancelar edição</span>
                  </Button>
                ) : null}
              </div>

              {showEditionForm ? (
                <form onSubmit={submit} aria-busy={processing} className="mt-6 grid gap-4">
                  <EditorField
                    htmlFor="edition-city"
                    label="Cidade"
                    hint="Praça atendida pela edição"
                  >
                    <select
                      id="edition-city"
                      required
                      value={form.city_id}
                      onChange={(event) => updateField('city_id', event.target.value)}
                      className={editorSelectClassName}
                      disabled={processing || cities.length === 0}
                    >
                      <option value="">Selecione uma cidade</option>
                      {cities.map((city) => (
                        <option key={city.id} value={city.id}>
                          {city.name} — {city.state_code}
                        </option>
                      ))}
                    </select>
                  </EditorField>

                  <EditorField htmlFor="edition-name" label="Nome da edição">
                    <Input
                      id="edition-name"
                      required
                      minLength={2}
                      maxLength={160}
                      value={form.name}
                      onChange={(event) => updateField('name', event.target.value)}
                      placeholder="Experimente Cornélio 2026/2027"
                      disabled={processing}
                    />
                  </EditorField>

                  <EditorField
                    htmlFor="edition-description"
                    label="Apresentação"
                    hint="Texto interno por enquanto; a vitrine pública virá no corte de acesso."
                  >
                    <Textarea
                      id="edition-description"
                      rows={4}
                      value={form.description}
                      onChange={(event) => updateField('description', event.target.value)}
                      placeholder="Uma seleção de benefícios para conhecer a cidade."
                      disabled={processing}
                    />
                  </EditorField>

                  <EditorField htmlFor="edition-price" label="Preço de referência">
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
                        R$
                      </span>
                      <Input
                        id="edition-price"
                        inputMode="decimal"
                        value={form.price_reais}
                        onChange={(event) => updateField('price_reais', event.target.value)}
                        placeholder="149,90"
                        className="pl-10"
                        disabled={processing}
                      />
                    </div>
                  </EditorField>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <EditorField htmlFor="edition-usage-start" label="Início de uso">
                      <Input
                        id="edition-usage-start"
                        type="date"
                        required
                        value={form.usage_starts_on}
                        onChange={(event) => updateField('usage_starts_on', event.target.value)}
                        disabled={processing}
                      />
                    </EditorField>
                    <EditorField htmlFor="edition-usage-end" label="Fim de uso">
                      <Input
                        id="edition-usage-end"
                        type="date"
                        required
                        value={form.usage_ends_on}
                        onChange={(event) => updateField('usage_ends_on', event.target.value)}
                        disabled={processing}
                      />
                    </EditorField>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <EditorField
                      htmlFor="edition-sales-start"
                      label="Início das vendas"
                      hint="Opcional"
                    >
                      <Input
                        id="edition-sales-start"
                        type="date"
                        value={form.sales_starts_on}
                        onChange={(event) => updateField('sales_starts_on', event.target.value)}
                        disabled={processing}
                      />
                    </EditorField>
                    <EditorField htmlFor="edition-sales-end" label="Fim das vendas" hint="Opcional">
                      <Input
                        id="edition-sales-end"
                        type="date"
                        value={form.sales_ends_on}
                        onChange={(event) => updateField('sales_ends_on', event.target.value)}
                        disabled={processing}
                      />
                    </EditorField>
                  </div>

                  {localError ? (
                    <p
                      role="alert"
                      className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
                    >
                      {localError}
                    </p>
                  ) : null}
                  {Object.keys(errors).length > 0 ? (
                    <p
                      role="alert"
                      className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
                    >
                      Revise os campos destacados pelo servidor e tente novamente.
                    </p>
                  ) : null}

                  <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                    {editingId ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        className="min-h-11"
                        onClick={resetForm}
                        disabled={processing}
                      >
                        Cancelar
                      </Button>
                    ) : null}
                    {editingId ? (
                      canUpdate ? (
                        <Button
                          type="submit"
                          size="lg"
                          className="min-h-11"
                          disabled={processing || cities.length === 0}
                        >
                          {processing ? (
                            <Loader2 aria-hidden="true" className="animate-spin" />
                          ) : (
                            <Edit3 aria-hidden="true" />
                          )}
                          {processing ? 'Salvando…' : 'Salvar alterações'}
                        </Button>
                      ) : null
                    ) : canCreate ? (
                      <Button
                        type="submit"
                        size="lg"
                        className="min-h-11"
                        disabled={processing || cities.length === 0}
                      >
                        {processing ? (
                          <Loader2 aria-hidden="true" className="animate-spin" />
                        ) : (
                          <Plus aria-hidden="true" />
                        )}
                        {processing ? 'Salvando…' : 'Criar edição'}
                      </Button>
                    ) : null}
                  </div>
                </form>
              ) : (
                <EmptyState
                  icon={Edit3}
                  headingLevel={3}
                  title="Nenhuma edição selecionada"
                  description="Escolha uma edição na lista para consultar e alterar seus dados."
                  className="mt-6 border border-dashed border-border py-8"
                />
              )}
            </section>
          ) : null}

          <section aria-label="Edições cadastradas" className="space-y-4">
            {editions.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                headingLevel={2}
                title="Nenhuma edição criada"
                description={
                  canCreate
                    ? 'Cadastre a primeira edição. Depois, cada parceiro poderá vincular uma oferta à sua unidade publicada.'
                    : 'Ainda não existem edições cadastradas nesta operação.'
                }
                className="rounded-lg border border-dashed border-border bg-card"
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                {editions.map((edition) => {
                  const meta = statusMeta[edition.status] ?? statusMeta.draft
                  const activeOffers = edition.offers.filter(
                    (offer) => offer.status === 'active'
                  ).length
                  const activeAccesses = edition.accesses.filter(
                    (access) => access.status === 'active'
                  ).length
                  const busy = actionId === edition.id
                  const editable = edition.status === 'draft' || edition.status === 'paused'

                  return (
                    <article
                      key={edition.id}
                      className={cn(
                        'flex min-h-full flex-col rounded-lg border border-border bg-card p-5 sm:p-6',
                        edition.status === 'archived' && 'opacity-70'
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                            {edition.city.name} · {edition.city.state_code}
                          </p>
                          <h2 className="mt-1 truncate text-lg font-bold tracking-[-0.02em]">
                            {edition.name}
                          </h2>
                        </div>
                        <span
                          className={cn(
                            'shrink-0 rounded-full border px-2.5 py-1 text-[0.7rem] font-semibold',
                            meta.className
                          )}
                        >
                          {meta.label}
                        </span>
                      </div>

                      {edition.description ? (
                        <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">
                          {edition.description}
                        </p>
                      ) : null}

                      <dl className="mt-5 grid grid-cols-2 gap-3 rounded-md border border-border bg-muted/40 p-4 text-sm">
                        <div>
                          <dt className="text-xs text-muted-foreground">Utilização</dt>
                          <dd className="mt-1 font-semibold">
                            {formatDate(edition.usage_starts_at)}
                            <span className="block text-xs font-normal text-muted-foreground">
                              até {formatDate(edition.usage_ends_at)}
                            </span>
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Preço</dt>
                          <dd className="mt-1 font-semibold">
                            {formatMoney(edition.price_cents, edition.currency)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Ofertas ativas</dt>
                          <dd className="mt-1 font-semibold">
                            {activeOffers} de {edition.offers.length}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Acessos ativos</dt>
                          <dd className="mt-1 font-semibold">{activeAccesses}</dd>
                        </div>
                        <div className="col-span-2">
                          <dt className="text-xs text-muted-foreground">Endereço da página</dt>
                          <dd className="mt-1 truncate text-xs">/{edition.slug}</dd>
                        </div>
                      </dl>

                      <div className="mt-auto flex flex-col gap-2 pt-5 sm:flex-row sm:flex-wrap">
                        {canListAccesses ? (
                          <Button asChild variant="outline" size="sm" className="min-h-10 flex-1">
                            <Link href="/backoffice/accesses">
                              <UsersRound aria-hidden="true" />
                              Acessos
                            </Link>
                          </Button>
                        ) : null}
                        {editable && canUpdate ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="min-h-10 flex-1"
                            onClick={() => beginEdit(edition)}
                            disabled={busy}
                          >
                            <Edit3 aria-hidden="true" />
                            Editar
                          </Button>
                        ) : null}
                        {canUpdate &&
                        (edition.status === 'draft' || edition.status === 'paused') ? (
                          <Button
                            type="button"
                            size="sm"
                            className="min-h-10 flex-1"
                            onClick={() =>
                              runAction(
                                `/backoffice/benefits/${edition.id}/publish`,
                                edition.id,
                                'post'
                              )
                            }
                            disabled={busy || activeOffers === 0}
                            title={
                              activeOffers === 0
                                ? 'Ative ao menos uma oferta antes de publicar.'
                                : undefined
                            }
                          >
                            {busy ? (
                              <Loader2 aria-hidden="true" className="animate-spin" />
                            ) : (
                              <Rocket aria-hidden="true" />
                            )}
                            Publicar
                          </Button>
                        ) : null}
                        {canUpdate && edition.status === 'published' ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="min-h-10 flex-1"
                            onClick={() =>
                              runAction(
                                `/backoffice/benefits/${edition.id}/pause`,
                                edition.id,
                                'post'
                              )
                            }
                            disabled={busy}
                          >
                            {busy ? (
                              <Loader2 aria-hidden="true" className="animate-spin" />
                            ) : (
                              <CirclePause aria-hidden="true" />
                            )}
                            Pausar
                          </Button>
                        ) : null}
                        {canArchive && edition.status !== 'archived' ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="min-h-10"
                            onClick={() => setArchiveTarget(edition)}
                            disabled={busy}
                          >
                            <Archive aria-hidden="true" />
                            Arquivar
                          </Button>
                        ) : null}
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        <ConfirmDialog
          open={archiveTarget !== null}
          onOpenChange={(open) => {
            if (!open && archiveOperationRef.current) return
            if (!open) setArchiveTarget(null)
          }}
          title="Arquivar esta edição?"
          description={`A edição “${archiveTarget?.name ?? ''}” e suas ofertas ficarão indisponíveis imediatamente. O histórico será preservado, mas não há restauração após o arquivamento.`}
          confirmLabel="Arquivar edição"
          destructive
          processing={archiveTarget !== null && actionId === archiveTarget.id}
          onConfirm={archive}
        />
      </div>
    </MainLayout>
  )
}
