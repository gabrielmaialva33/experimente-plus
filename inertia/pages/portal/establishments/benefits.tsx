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
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Textarea } from '~/components/ui/textarea'
import { useUnsavedChangesGuard } from '~/hooks/use_unsaved_changes_guard'
import { MainLayout } from '~/layouts/main_layout'
import { cn } from '~/lib/utils'
import type { OrganizationAllowedActions } from '~/types'
import { scrollBehavior } from '~/lib/motion'

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
  allowed_actions: OrganizationAllowedActions
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
    className: 'border-success/25 bg-success-soft text-success-accent',
  },
  paused: {
    label: 'Pausada',
    className: 'border-warning/30 bg-warning-soft text-warning-accent',
  },
  archived: {
    label: 'Arquivada',
    className: 'border-border bg-muted/60 text-muted-foreground',
  },
}

const unavailableEditionMeta = {
  label: 'Indisponível',
  className: 'border-border bg-muted/60 text-muted-foreground',
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
  allowed_actions: allowedActions,
  errors = {},
}: EstablishmentBenefitsProps) {
  const canCreate = allowedActions.benefit_offers.create
  const canUpdate = allowedActions.benefit_offers.update
  const canActivate = allowedActions.benefit_offers.activate
  const canPause = allowedActions.benefit_offers.pause
  const canArchive = allowedActions.benefit_offers.archive
  const canReadRedemptions = allowedActions.redemptions.read
  const canValidateRedemptions = allowedActions.redemptions.validate
  const canManageOffers = canCreate || canUpdate
  const [form, setForm] = useState<OfferFormState>(emptyForm)
  // The form as last emptied or loaded: any difference is typing a visit would lose.
  const [savedForm, setSavedForm] = useState<OfferFormState>(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [processing, setProcessing] = useState(false)
  const { allowNextVisit, confirmDiscard } = useUnsavedChangesGuard({
    enabled: !processing && JSON.stringify(form) !== JSON.stringify(savedForm),
  })
  const [actionId, setActionId] = useState<number | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  const usedEditionIds = useMemo(() => new Set(offers.map((offer) => offer.edition_id)), [offers])
  const editionsForCreation = editions.filter((edition) => !usedEditionIds.has(edition.id))
  const activeOfferCount = offers.filter(
    (offer) => offer.status === 'active' && offer.edition.status !== 'archived'
  ).length
  const canShowForm =
    establishment.published &&
    ((editingId !== null && canUpdate) ||
      (editingId === null && canCreate && editionsForCreation.length > 0))
  // Why no form is offered, when that is not already explained on the page (web audit W80:
  // no empty "Nova oferta" card).
  const formUnavailableReason =
    !canManageOffers || canShowForm || !establishment.published
      ? null
      : !canCreate
        ? 'Para mudar os termos, use “Editar” em uma oferta em rascunho ou pausada.'
        : editions.length === 0
          ? 'Ainda não há edição aberta nesta cidade. Quando a equipe do Experimente+ abrir uma, você cria a oferta aqui.'
          : 'Este lugar já tem uma oferta em cada edição disponível.'

  function updateField<Key extends keyof OfferFormState>(key: Key, value: OfferFormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

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

  function beginEdit(offer: BenefitOffer) {
    if (!confirmDiscard()) return
    const discountValue =
      offer.benefit_type === 'percentage'
        ? String(offer.discount_percentage ?? '')
        : offer.benefit_type === 'fixed_amount'
          ? ((offer.discount_amount_cents ?? 0) / 100).toFixed(2).replace('.', ',')
          : ''

    setEditingId(offer.id)
    setLocalError(null)
    const loaded: OfferFormState = {
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
    }
    setForm(loaded)
    setSavedForm(loaded)
    window.scrollTo({ top: 0, behavior: scrollBehavior() })
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

    allowNextVisit()
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
      <Head title="Benefícios do lugar" />

      <div className="space-y-7">
        <PageHeader
          eyebrow={establishment.public_name}
          title="Benefícios do lugar"
          description="Uma oferta clara por edição. Para mudar os termos de uma oferta ativa, pause-a antes."
          actions={
            <>
              <Button asChild variant="ghost" size="lg" shape="pill">
                <Link href={`/portal/establishments/${establishment.id}`}>
                  <ArrowLeft />
                  Voltar ao lugar
                </Link>
              </Button>
              {canReadRedemptions ? (
                <Button asChild variant="ghost" size="lg" shape="pill">
                  <Link href="/portal/redemptions">Utilizações</Link>
                </Button>
              ) : null}
              {canValidateRedemptions ? (
                <Button asChild variant="outline" size="lg" shape="pill">
                  <Link href="/portal/redemptions/validate">Validar benefício</Link>
                </Button>
              ) : null}
            </>
          }
          meta={
            <>
              <Badge variant="neutral" appearance="light" shape="pill" size="lg">
                {offers.length === 0
                  ? 'Nenhuma oferta'
                  : `${offers.length} ${offers.length === 1 ? 'oferta' : 'ofertas'}`}
              </Badge>
              {/* Without offers there is nothing to count as active; with offers, none active is
                  neutral, not green. */}
              {offers.length > 0 ? (
                <Badge
                  variant={activeOfferCount > 0 ? 'success' : 'neutral'}
                  appearance="light"
                  shape="pill"
                  size="lg"
                >
                  {activeOfferCount === 0
                    ? 'Nenhuma ativa'
                    : `${activeOfferCount} ${activeOfferCount === 1 ? 'ativa' : 'ativas'}`}
                </Badge>
              ) : null}
            </>
          }
        />

        {!establishment.published ? (
          <section className="rounded-card border border-warning/30 bg-warning-soft p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-background/80 text-warning-accent">
                <Store className="size-5" />
              </span>
              <div>
                <h2 className="font-display text-lg font-bold">
                  Publique o lugar antes de criar benefícios
                </h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-foreground">
                  A oferta usa os dados públicos já aprovados, incluindo a cidade. Assim nenhum
                  benefício é divulgado para um lugar incompleto ou na cidade errada.
                </p>
              </div>
            </div>
          </section>
        ) : null}

        <div
          className={cn(
            'grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6 xl:items-start',
            canShowForm && 'xl:grid-cols-[minmax(20rem,0.85fr)_minmax(0,1.15fr)]'
          )}
        >
          {canManageOffers && canShowForm ? (
            // Sticky below the 72 px header, and never taller than the screen: a long offer form
            // kept its submit button out of reach on a 768 px tall laptop.
            <section className="rounded-card border border-border-subtle bg-card p-5 sm:p-6 xl:sticky xl:top-24 xl:max-h-[calc(100dvh-7.5rem)] xl:overflow-y-auto xl:overscroll-contain">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-xl font-bold tracking-[-0.02em]">
                    {editingId ? 'Editar oferta' : 'Nova oferta'}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {editingId
                      ? 'A oferta está pausada; os novos termos valem quando você reativar.'
                      : 'Cada lugar participa uma vez por edição. Seja claro sobre restrições e dias de uso.'}
                  </p>
                </div>
                {editingId ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    shape="circle"
                    onClick={cancelEdit}
                  >
                    <X />
                    <span className="sr-only">Cancelar edição</span>
                  </Button>
                ) : null}
              </div>

              <form onSubmit={submit} className="mt-6 grid gap-4" aria-busy={processing}>
                <EditorField required htmlFor="offer-edition" label="Edição">
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

                <EditorField required htmlFor="offer-title" label="Título">
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
                  required
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
                  <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-border bg-background px-3 py-2 text-sm">
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
                  <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-border bg-background px-3 py-2 text-sm">
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
                    Revise os campos destacados e tente novamente.
                  </p>
                ) : null}

                <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                  {editingId ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      shape="pill"
                      onClick={cancelEdit}
                      disabled={processing}
                    >
                      Cancelar
                    </Button>
                  ) : null}
                  <Button
                    type="submit"
                    size="xl"
                    shape="pill"
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
            </section>
          ) : null}

          <section aria-label="Ofertas do lugar" className="space-y-4">
            {formUnavailableReason ? (
              <p className="rounded-2xl border border-border-subtle bg-card px-4 py-3 text-sm leading-6 text-muted-foreground">
                {formUnavailableReason}
              </p>
            ) : null}
            {offers.length === 0 ? (
              <EmptyState
                className="rounded-card border border-dashed border-border bg-card"
                headingLevel={2}
                icon={Gift}
                title="Nenhum benefício configurado"
                description={
                  canCreate
                    ? 'Crie a primeira oferta deste lugar. Ela começa em rascunho e só vale na edição depois de ativada.'
                    : 'Ainda não há oferta para este lugar.'
                }
              />
            ) : (
              <div
                className={cn(
                  'grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4',
                  offers.length > 1 && 'md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2'
                )}
              >
                {offers.map((offer) => {
                  const busy = actionId === offer.id
                  const mutableStatus = offer.status === 'draft' || offer.status === 'paused'
                  const editionArchived = offer.edition.status === 'archived'
                  const editable = mutableStatus && !editionArchived
                  const meta =
                    editionArchived && offer.status !== 'archived'
                      ? unavailableEditionMeta
                      : (statusMeta[offer.status] ?? statusMeta.draft)

                  return (
                    <article
                      key={offer.id}
                      aria-busy={busy}
                      className={cn(
                        'flex min-h-full flex-col rounded-card border border-border-subtle bg-card p-5 sm:p-6',
                        offer.status === 'archived' && 'opacity-70'
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase leading-5 tracking-[0.12em] text-primary">
                            {offer.edition.name}
                          </p>
                          <h2 className="mt-1 font-display text-lg font-bold tracking-[-0.02em]">
                            {offer.title}
                          </h2>
                        </div>
                        <span
                          className={cn(
                            'inline-flex h-6 shrink-0 items-center rounded-full border px-2.5 text-xs font-bold',
                            meta.className
                          )}
                        >
                          {meta.label}
                        </span>
                      </div>

                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        {offer.description}
                      </p>

                      <dl className="mt-5 grid grid-cols-2 gap-3 rounded-2xl bg-background p-4 text-sm">
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
                        <div className="mt-4 rounded-2xl border border-border-subtle p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                            Regras
                          </p>
                          <p className="mt-2 text-sm leading-6">{offer.terms}</p>
                        </div>
                      ) : null}

                      {editionArchived ? (
                        <p className="mt-4 rounded-xl bg-background px-3 py-2 text-xs leading-5 text-muted-foreground">
                          {offer.status === 'active'
                            ? 'Esta edição foi arquivada e a oferta não está mais disponível. Pause a oferta antes de arquivar seu histórico.'
                            : offer.status === 'archived'
                              ? 'Esta edição foi arquivada. A oferta permanece somente no histórico.'
                              : 'Esta edição foi arquivada. A oferta não está disponível e só pode ser arquivada.'}
                        </p>
                      ) : null}

                      <div className="mt-auto flex flex-col gap-2 pt-5 sm:flex-row sm:flex-wrap">
                        {editable && canUpdate ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="md"
                            shape="pill"
                            className="sm:flex-none"
                            onClick={() => beginEdit(offer)}
                            disabled={busy}
                          >
                            <Edit3 />
                            Editar
                          </Button>
                        ) : null}
                        {editable && canActivate ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="md"
                            shape="pill"
                            className="sm:flex-none"
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
                        {offer.status === 'active' && canPause ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="md"
                            shape="pill"
                            className="sm:flex-none"
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
                        {mutableStatus && canArchive ? (
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
                                size="md"
                                shape="pill"
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
