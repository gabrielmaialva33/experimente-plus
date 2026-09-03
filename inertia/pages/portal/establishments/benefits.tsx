import { Head, Link, router } from '@inertiajs/react'
import {
  Archive,
  ArrowLeft,
  CirclePause,
  Edit3,
  Gift,
  Loader2,
  Plus,
  Rocket,
  Store,
  TicketPercent,
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
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Textarea } from '~/components/ui/textarea'
import { useAuth } from '~/hooks/use_auth'
import { MainLayout } from '~/layouts/main_layout'
import { cn } from '~/lib/utils'

interface EditionCity {
  id: number
  name: string
  state_code: string
}

interface BenefitEdition {
  id: number
  name: string
  status: string
  currency: string
  usage_starts_at: string
  usage_ends_at: string
  city: EditionCity
}

interface BenefitOffer {
  id: number
  edition_id: number
  title: string
  description: string
  benefit_type: BenefitType
  discount_percentage: number | null
  discount_amount_cents: number | null
  terms: string | null
  available_weekdays_mask: number
  daily_start_time: string | null
  daily_end_time: string | null
  reservation_required: boolean
  on_premise_only: boolean
  minimum_party_size: number
  max_redemptions_per_access: number
  status: string
  edition: BenefitEdition
}

type BenefitType =
  'buy_one_get_one' | 'percentage' | 'fixed_amount' | 'complimentary_item' | 'custom'

interface EstablishmentSummary {
  id: number
  organization_id: number
  public_name: string
  city_id: number | null
  published: boolean
}

interface EstablishmentBenefitsProps {
  establishment: EstablishmentSummary
  editions: BenefitEdition[]
  offers: BenefitOffer[]
  errors?: Record<string, string>
}

interface OfferFormState {
  edition_id: string
  title: string
  description: string
  benefit_type: BenefitType
  discount_value: string
  terms: string
  available_weekdays_mask: number
  daily_start_time: string
  daily_end_time: string
  reservation_required: boolean
  on_premise_only: boolean
  minimum_party_size: string
  max_redemptions_per_access: string
}

const benefitTypeLabels: Record<BenefitType, string> = {
  buy_one_get_one: 'Compre um e ganhe outro',
  percentage: 'Desconto percentual',
  fixed_amount: 'Desconto em reais',
  complimentary_item: 'Item cortesia',
  custom: 'Benefício personalizado',
}

const statusMeta: Record<string, { label: string; className: string }> = {
  draft: {
    label: 'Rascunho',
    className: 'border-border bg-muted text-muted-foreground',
  },
  active: {
    label: 'Ativa',
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

const weekdays = [
  { bit: 2, short: 'Seg', long: 'segunda-feira' },
  { bit: 4, short: 'Ter', long: 'terça-feira' },
  { bit: 8, short: 'Qua', long: 'quarta-feira' },
  { bit: 16, short: 'Qui', long: 'quinta-feira' },
  { bit: 32, short: 'Sex', long: 'sexta-feira' },
  { bit: 64, short: 'Sáb', long: 'sábado' },
  { bit: 1, short: 'Dom', long: 'domingo' },
]

const emptyForm: OfferFormState = {
  edition_id: '',
  title: '',
  description: '',
  benefit_type: 'buy_one_get_one',
  discount_value: '',
  terms: '',
  available_weekdays_mask: 127,
  daily_start_time: '',
  daily_end_time: '',
  reservation_required: false,
  on_premise_only: true,
  minimum_party_size: '1',
  max_redemptions_per_access: '1',
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(value))
}

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(cents / 100)
}

function parseMoneyToCents(value: string): number | null {
  const parsed = Number(value.trim().replace(',', '.'))
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Math.round(parsed * 100)
}

function describeDays(mask: number): string {
  if (mask === 127) return 'Todos os dias'
  return weekdays
    .filter((weekday) => (mask & weekday.bit) !== 0)
    .map((weekday) => weekday.short)
    .join(', ')
}

function describeBenefit(offer: BenefitOffer): string {
  if (offer.benefit_type === 'percentage' && offer.discount_percentage) {
    return `${offer.discount_percentage}% de desconto`
  }
  if (offer.benefit_type === 'fixed_amount' && offer.discount_amount_cents) {
    return `${formatMoney(offer.discount_amount_cents, offer.edition.currency)} de desconto`
  }
  return benefitTypeLabels[offer.benefit_type]
}

export default function EstablishmentBenefitsPage({
  establishment,
  editions,
  offers,
  errors = {},
}: EstablishmentBenefitsProps) {
  const { can } = useAuth()
  const canCreate = can('benefit_offers.create')
  const canUpdate = can('benefit_offers.update')
  const canArchive = can('benefit_offers.archive')
  const canReadRedemptions = can('benefit_offers.read')
  const canManageOffers = canCreate || canUpdate
  const [form, setForm] = useState<OfferFormState>(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [processing, setProcessing] = useState(false)
  const [actionId, setActionId] = useState<number | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  const usedEditionIds = useMemo(() => new Set(offers.map((offer) => offer.edition_id)), [offers])
  const editionsForCreation = editions.filter((edition) => !usedEditionIds.has(edition.id))
  const canShowForm =
    establishment.published &&
    ((editingId !== null && canUpdate) ||
      (editingId === null && canCreate && editionsForCreation.length > 0))

  function updateField<Key extends keyof OfferFormState>(key: Key, value: OfferFormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function resetForm() {
    setForm(emptyForm)
    setEditingId(null)
    setLocalError(null)
  }

  function beginEdit(offer: BenefitOffer) {
    const discountValue =
      offer.benefit_type === 'percentage'
        ? String(offer.discount_percentage ?? '')
        : offer.benefit_type === 'fixed_amount'
          ? ((offer.discount_amount_cents ?? 0) / 100).toFixed(2).replace('.', ',')
          : ''

    setEditingId(offer.id)
    setLocalError(null)
    setForm({
      edition_id: String(offer.edition_id),
      title: offer.title,
      description: offer.description,
      benefit_type: offer.benefit_type,
      discount_value: discountValue,
      terms: offer.terms ?? '',
      available_weekdays_mask: offer.available_weekdays_mask,
      daily_start_time: offer.daily_start_time ?? '',
      daily_end_time: offer.daily_end_time ?? '',
      reservation_required: offer.reservation_required,
      on_premise_only: offer.on_premise_only,
      minimum_party_size: String(offer.minimum_party_size),
      max_redemptions_per_access: String(offer.max_redemptions_per_access),
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function toggleWeekday(bit: number) {
    setForm((current) => ({
      ...current,
      available_weekdays_mask: current.available_weekdays_mask ^ bit,
    }))
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLocalError(null)

    if (!form.edition_id || !form.title.trim() || !form.description.trim()) {
      setLocalError('Selecione a edição e informe título e descrição do benefício.')
      return
    }
    if (form.available_weekdays_mask === 0) {
      setLocalError('Selecione ao menos um dia disponível.')
      return
    }
    if (Boolean(form.daily_start_time) !== Boolean(form.daily_end_time)) {
      setLocalError('Informe o início e o fim do horário ou deixe os dois campos vazios.')
      return
    }

    let discountPercentage: number | null = null
    let discountAmountCents: number | null = null
    if (form.benefit_type === 'percentage') {
      const percentage = Number(form.discount_value)
      if (!Number.isInteger(percentage) || percentage < 1 || percentage > 100) {
        setLocalError('O desconto percentual deve ser um número inteiro entre 1 e 100.')
        return
      }
      discountPercentage = percentage
    }
    if (form.benefit_type === 'fixed_amount') {
      discountAmountCents = parseMoneyToCents(form.discount_value)
      if (discountAmountCents === null) {
        setLocalError('Informe um desconto em reais maior que zero.')
        return
      }
    }

    const payload = {
      ...(editingId ? {} : { edition_id: Number(form.edition_id) }),
      title: form.title.trim(),
      description: form.description.trim(),
      benefit_type: form.benefit_type,
      discount_percentage: discountPercentage,
      discount_amount_cents: discountAmountCents,
      terms: form.terms.trim() || null,
      available_weekdays_mask: form.available_weekdays_mask,
      daily_start_time: form.daily_start_time || null,
      daily_end_time: form.daily_end_time || null,
      reservation_required: form.reservation_required,
      on_premise_only: form.on_premise_only,
      minimum_party_size: Number(form.minimum_party_size),
      max_redemptions_per_access: Number(form.max_redemptions_per_access),
    }

    setProcessing(true)
    const options = {
      preserveScroll: true,
      onSuccess: resetForm,
      onFinish: () => setProcessing(false),
    }

    if (editingId) {
      router.put(`/portal/benefit-offers/${editingId}`, payload, options)
    } else {
      router.post(`/portal/establishments/${establishment.id}/benefits`, payload, options)
    }
  }

  function runAction(path: string, offerId: number, method: 'post' | 'delete') {
    setActionId(offerId)
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

  function archive(offer: BenefitOffer) {
    if (!canArchive) return
    runAction(`/portal/benefit-offers/${offer.id}`, offer.id, 'delete')
  }

  return (
    <MainLayout>
      <Head title="Benefícios da unidade" />

      <div className="space-y-7">
        <PageHeader
          eyebrow="Portal do parceiro"
          icon={TicketPercent}
          title="Benefícios da unidade"
          description={`${establishment.public_name} · defina uma oferta clara para cada edição. Termos ativos só podem ser alterados depois que a oferta for pausada.`}
          actions={
            <Button asChild variant="outline" size="lg" className="min-h-11">
              <Link href={`/portal/establishments/${establishment.id}`}>
                <ArrowLeft />
                Voltar à unidade
              </Link>
            </Button>
          }
          meta={
            <>
              <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold">
                {offers.length} {offers.length === 1 ? 'oferta' : 'ofertas'}
              </span>
              <span className="rounded-full border border-success/20 bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                {offers.filter((offer) => offer.status === 'active').length} ativas
              </span>
            </>
          }
        />

        {canUpdate || canReadRedemptions ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            {canUpdate ? (
              <Button asChild variant="outline" size="lg" className="min-h-11">
                <Link href="/portal/redemptions/validate">Validar benefício</Link>
              </Button>
            ) : null}
            {canReadRedemptions ? (
              <Button asChild variant="outline" size="lg" className="min-h-11">
                <Link href="/portal/redemptions">Utilizações</Link>
              </Button>
            ) : null}
          </div>
        ) : null}

        {!establishment.published ? (
          <section className="rounded-lg border border-warning/30 bg-warning/10 p-6">
            <div className="flex items-start gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-md border border-warning/20 bg-background text-warning-foreground">
                <Store className="size-5" />
              </span>
              <div>
                <h2 className="font-bold">Publique a unidade antes de criar benefícios</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  A oferta precisa apontar para dados públicos já aprovados, incluindo a cidade.
                  Isso evita divulgar um benefício para uma unidade incompleta ou na praça errada.
                </p>
              </div>
            </div>
          </section>
        ) : null}

        <div
          className={cn(
            'grid gap-6 xl:items-start',
            canManageOffers && 'xl:grid-cols-[minmax(20rem,0.85fr)_minmax(0,1.15fr)]'
          )}
        >
          {canManageOffers ? (
            <section className="rounded-lg border border-border bg-card p-5 sm:p-6 xl:sticky xl:top-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                    {editingId ? 'Editar oferta' : 'Nova oferta'}
                  </p>
                  <h2 className="mt-1 text-xl font-bold tracking-[-0.025em]">
                    {editingId ? 'Revise os termos pausados' : 'Configure o benefício do parceiro'}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Uma unidade pode participar uma vez em cada edição. Seja objetivo sobre
                    restrições e dias de uso.
                  </p>
                </div>
                {editingId ? (
                  <Button type="button" variant="ghost" size="icon" onClick={resetForm}>
                    <X />
                    <span className="sr-only">Cancelar edição</span>
                  </Button>
                ) : null}
              </div>

              {!canShowForm ? (
                <div className="mt-6 rounded-md border border-dashed border-border bg-muted/35 p-5 text-sm leading-6 text-muted-foreground">
                  {!establishment.published
                    ? 'O formulário será liberado após a publicação da unidade.'
                    : !canCreate
                      ? 'Selecione uma oferta editável para revisar seus dados.'
                      : editions.length === 0
                        ? 'Ainda não há edição disponível para esta cidade. A operação precisa criar uma edição primeiro.'
                        : 'Esta unidade já possui uma oferta em todas as edições disponíveis.'}
                </div>
              ) : (
                <form onSubmit={submit} className="mt-6 grid gap-4" aria-busy={processing}>
                  <EditorField htmlFor="offer-edition" label="Edição">
                    <select
                      id="offer-edition"
                      required
                      value={form.edition_id}
                      onChange={(event) => updateField('edition_id', event.target.value)}
                      className={editorSelectClassName}
                      disabled={processing || editingId !== null}
                    >
                      <option value="">Selecione uma edição</option>
                      {(editingId ? editions : editionsForCreation).map((edition) => (
                        <option key={edition.id} value={edition.id}>
                          {edition.name} — {edition.city.name}
                        </option>
                      ))}
                    </select>
                  </EditorField>

                  <EditorField htmlFor="offer-type" label="Modalidade">
                    <select
                      id="offer-type"
                      value={form.benefit_type}
                      onChange={(event) => {
                        updateField('benefit_type', event.target.value as BenefitType)
                        updateField('discount_value', '')
                      }}
                      className={editorSelectClassName}
                      disabled={processing}
                    >
                      {Object.entries(benefitTypeLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </EditorField>

                  {form.benefit_type === 'percentage' ? (
                    <EditorField htmlFor="offer-percentage" label="Percentual">
                      <div className="relative">
                        <Input
                          id="offer-percentage"
                          type="number"
                          min={1}
                          max={100}
                          inputMode="numeric"
                          value={form.discount_value}
                          onChange={(event) => updateField('discount_value', event.target.value)}
                          className="pr-10"
                          disabled={processing}
                        />
                        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                          %
                        </span>
                      </div>
                    </EditorField>
                  ) : null}

                  {form.benefit_type === 'fixed_amount' ? (
                    <EditorField htmlFor="offer-amount" label="Valor do desconto">
                      <div className="relative">
                        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
                          R$
                        </span>
                        <Input
                          id="offer-amount"
                          inputMode="decimal"
                          value={form.discount_value}
                          onChange={(event) => updateField('discount_value', event.target.value)}
                          placeholder="20,00"
                          className="pl-10"
                          disabled={processing}
                        />
                      </div>
                    </EditorField>
                  ) : null}

                  <EditorField htmlFor="offer-title" label="Título">
                    <Input
                      id="offer-title"
                      required
                      minLength={2}
                      maxLength={180}
                      value={form.title}
                      onChange={(event) => updateField('title', event.target.value)}
                      placeholder="Peça um prato e ganhe outro"
                      disabled={processing}
                    />
                  </EditorField>

                  <EditorField
                    htmlFor="offer-description"
                    label="Como funciona"
                    hint="Explique o benefício em linguagem direta para o consumidor."
                  >
                    <Textarea
                      id="offer-description"
                      required
                      rows={4}
                      value={form.description}
                      onChange={(event) => updateField('description', event.target.value)}
                      placeholder="O segundo item deve ter valor igual ou menor ao primeiro."
                      disabled={processing}
                    />
                  </EditorField>

                  <EditorField htmlFor="offer-terms" label="Regras e exceções" hint="Opcional">
                    <Textarea
                      id="offer-terms"
                      rows={3}
                      value={form.terms}
                      onChange={(event) => updateField('terms', event.target.value)}
                      placeholder="Não cumulativo. Exceto feriados e datas comemorativas."
                      disabled={processing}
                    />
                  </EditorField>

                  <fieldset className="space-y-2">
                    <legend className="text-sm font-semibold">Dias disponíveis</legend>
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                      {weekdays.map((weekday) => {
                        const selected = (form.available_weekdays_mask & weekday.bit) !== 0
                        return (
                          <button
                            key={weekday.bit}
                            type="button"
                            aria-pressed={selected}
                            aria-label={weekday.long}
                            onClick={() => toggleWeekday(weekday.bit)}
                            disabled={processing}
                            className={cn(
                              'min-h-11 rounded-md border px-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                              selected
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-border bg-background text-muted-foreground hover:bg-muted'
                            )}
                          >
                            {weekday.short}
                          </button>
                        )
                      })}
                    </div>
                  </fieldset>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <EditorField htmlFor="offer-time-start" label="A partir de" hint="Opcional">
                      <Input
                        id="offer-time-start"
                        type="time"
                        value={form.daily_start_time}
                        onChange={(event) => updateField('daily_start_time', event.target.value)}
                        disabled={processing}
                      />
                    </EditorField>
                    <EditorField htmlFor="offer-time-end" label="Até" hint="Opcional">
                      <Input
                        id="offer-time-end"
                        type="time"
                        value={form.daily_end_time}
                        onChange={(event) => updateField('daily_end_time', event.target.value)}
                        disabled={processing}
                      />
                    </EditorField>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <EditorField htmlFor="offer-party-size" label="Mínimo de pessoas">
                      <Input
                        id="offer-party-size"
                        type="number"
                        min={1}
                        max={100}
                        inputMode="numeric"
                        value={form.minimum_party_size}
                        onChange={(event) => updateField('minimum_party_size', event.target.value)}
                        disabled={processing}
                      />
                    </EditorField>
                    <EditorField htmlFor="offer-redemption-limit" label="Usos por acesso">
                      <Input
                        id="offer-redemption-limit"
                        type="number"
                        min={1}
                        max={100}
                        inputMode="numeric"
                        value={form.max_redemptions_per_access}
                        onChange={(event) =>
                          updateField('max_redemptions_per_access', event.target.value)
                        }
                        disabled={processing}
                      />
                    </EditorField>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.reservation_required}
                        onChange={(event) =>
                          updateField('reservation_required', event.target.checked)
                        }
                        className="size-4 accent-primary"
                        disabled={processing}
                      />
                      Exige reserva
                    </label>
                    <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.on_premise_only}
                        onChange={(event) => updateField('on_premise_only', event.target.checked)}
                        className="size-4 accent-primary"
                        disabled={processing}
                      />
                      Somente no local
                    </label>
                  </div>

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
                    <Button
                      type="submit"
                      size="lg"
                      className="min-h-11"
                      disabled={processing}
                      aria-busy={processing}
                    >
                      {processing ? (
                        <Loader2 className="animate-spin" />
                      ) : editingId ? (
                        <Edit3 />
                      ) : (
                        <Plus />
                      )}
                      {processing ? 'Salvando…' : editingId ? 'Salvar oferta' : 'Criar oferta'}
                    </Button>
                  </div>
                </form>
              )}
            </section>
          ) : null}

          <section aria-label="Ofertas da unidade" className="space-y-4">
            {offers.length === 0 ? (
              <EmptyState
                className="rounded-lg border border-dashed border-border bg-card"
                headingLevel={2}
                icon={Gift}
                title="Nenhum benefício configurado"
                description={
                  canCreate
                    ? 'Crie a primeira oferta desta unidade. Ela começa em rascunho e só conta para a publicação da edição depois de ativada.'
                    : 'Ainda não há oferta vinculada a esta unidade.'
                }
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                {offers.map((offer) => {
                  const meta = statusMeta[offer.status] ?? statusMeta.draft
                  const busy = actionId === offer.id
                  const editable = offer.status === 'draft' || offer.status === 'paused'

                  return (
                    <article
                      key={offer.id}
                      aria-busy={busy}
                      className={cn(
                        'flex min-h-full flex-col rounded-lg border border-border bg-card p-5 sm:p-6',
                        offer.status === 'archived' && 'opacity-70'
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                            {offer.edition.name}
                          </p>
                          <h2 className="mt-1 text-lg font-bold tracking-[-0.02em]">
                            {offer.title}
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

                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        {offer.description}
                      </p>

                      <dl className="mt-5 grid grid-cols-2 gap-3 rounded-md border border-border bg-muted/45 p-4 text-sm">
                        <div className="col-span-2">
                          <dt className="text-xs text-muted-foreground">Benefício</dt>
                          <dd className="mt-1 font-semibold">{describeBenefit(offer)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Dias</dt>
                          <dd className="mt-1 font-semibold">
                            {describeDays(offer.available_weekdays_mask)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Horário</dt>
                          <dd className="mt-1 font-semibold">
                            {offer.daily_start_time && offer.daily_end_time
                              ? `${offer.daily_start_time}–${offer.daily_end_time}`
                              : 'Sem restrição'}
                          </dd>
                        </div>
                        <div className="col-span-2">
                          <dt className="text-xs text-muted-foreground">Validade da edição</dt>
                          <dd className="mt-1 font-semibold">
                            {formatDate(offer.edition.usage_starts_at)} até{' '}
                            {formatDate(offer.edition.usage_ends_at)}
                          </dd>
                        </div>
                      </dl>

                      {offer.terms ? (
                        <div className="mt-4 rounded-md border border-border p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                            Regras
                          </p>
                          <p className="mt-2 text-sm leading-6">{offer.terms}</p>
                        </div>
                      ) : null}

                      <div className="mt-auto flex flex-col gap-2 pt-5 sm:flex-row sm:flex-wrap">
                        {editable && canUpdate ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="min-h-10 flex-1"
                            onClick={() => beginEdit(offer)}
                            disabled={busy}
                          >
                            <Edit3 />
                            Editar
                          </Button>
                        ) : null}
                        {editable && canUpdate ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="min-h-10 flex-1"
                            onClick={() =>
                              runAction(
                                `/portal/benefit-offers/${offer.id}/activate`,
                                offer.id,
                                'post'
                              )
                            }
                            disabled={busy}
                          >
                            {busy ? <Loader2 className="animate-spin" /> : <Rocket />}
                            Ativar
                          </Button>
                        ) : null}
                        {offer.status === 'active' && canUpdate ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="min-h-10 flex-1"
                            onClick={() =>
                              runAction(
                                `/portal/benefit-offers/${offer.id}/pause`,
                                offer.id,
                                'post'
                              )
                            }
                            disabled={busy}
                          >
                            {busy ? <Loader2 className="animate-spin" /> : <CirclePause />}
                            Pausar
                          </Button>
                        ) : null}
                        {editable && canArchive ? (
                          <ConfirmDialog
                            title="Arquivar oferta?"
                            description={`A oferta “${offer.title}” deixará de ficar disponível. O histórico será preservado.`}
                            confirmLabel="Arquivar oferta"
                            destructive
                            processing={busy}
                            onConfirm={() => archive(offer)}
                            trigger={
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="min-h-10"
                                disabled={busy}
                              >
                                <Archive />
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
        </div>
      </div>
    </MainLayout>
  )
}
