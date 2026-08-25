import { Head, Link, router, useForm } from '@inertiajs/react'
import type { FormEvent } from 'react'
import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  ImagePlus,
  Plus,
  Send,
  Trash2,
} from 'lucide-react'

import PilotFeedbackForm from '~/components/portal/pilot_feedback_form'
import { MainLayout } from '~/layouts/main_layout'

type JsonRecord = Record<string, unknown>

interface CompletenessIssue {
  code: string
  field: string
  message: string
  severity: string
}

interface Completeness {
  eligible: boolean
  score: number
  blocking_issues: CompletenessIssue[]
  warnings: CompletenessIssue[]
}

interface FeedbackTarget {
  id: number
  label: string
  organization_id?: number
}

interface EstablishmentEditorProps {
  tenant_id: number
  establishment: JsonRecord
  completeness: Completeness
  cities: JsonRecord[]
  categories: JsonRecord[]
  feedback_targets: {
    organizations: FeedbackTarget[]
    establishments: FeedbackTarget[]
  }
}

interface HourInput {
  weekday: number
  opens_at: string
  closes_at: string
  spans_next_day: boolean
  sort_order: number
}

const dayLabels = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : null
}

function asArray(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonRecord => asRecord(item) !== null)
    : []
}

function stringValue(record: JsonRecord | null, key: string, fallback = ''): string {
  const value = record?.[key]
  return typeof value === 'string' ? value : fallback
}

function numberValue(record: JsonRecord | null, key: string): number | null {
  const value = record?.[key]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value)))
    return Number(value)
  return null
}

function booleanValue(record: JsonRecord | null, key: string): boolean {
  return record?.[key] === true
}

function relationId(record: JsonRecord, directKey: string, relationKey: string): number | null {
  const direct = numberValue(record, directKey)
  if (direct !== null) return direct
  return numberValue(asRecord(record[relationKey]), 'id')
}

export default function EstablishmentEditorPage({
  tenant_id,
  establishment,
  completeness,
  cities,
  categories,
  feedback_targets,
}: EstablishmentEditorProps) {
  const revision = asRecord(establishment.revision)
  const address = asRecord(revision?.address)
  const establishmentId = Number(establishment.id)
  const organizationId = Number(establishment.organization_id)
  const revisionStatus = stringValue(revision, 'status', 'draft')
  const editable = ['draft', 'changes_requested'].includes(revisionStatus)

  const identityForm = useForm({
    public_name: stringValue(revision, 'public_name'),
    city_id: numberValue(revision, 'city_id'),
    short_description: stringValue(revision, 'short_description'),
    description: stringValue(revision, 'description'),
    public_email: stringValue(revision, 'public_email'),
    public_phone: stringValue(revision, 'public_phone'),
    whatsapp: stringValue(revision, 'whatsapp'),
    website: stringValue(revision, 'website'),
    instagram: stringValue(revision, 'instagram'),
    booking_url: stringValue(revision, 'booking_url'),
    availability_type: stringValue(revision, 'availability_type', 'regular_hours'),
  })

  const addressForm = useForm({
    postal_code: stringValue(address, 'postal_code'),
    street: stringValue(address, 'street'),
    number: stringValue(address, 'number'),
    without_number: booleanValue(address, 'without_number'),
    complement: stringValue(address, 'complement'),
    district: stringValue(address, 'district'),
    state_code: stringValue(address, 'state_code', 'PR'),
    latitude: numberValue(address, 'latitude'),
    longitude: numberValue(address, 'longitude'),
    coordinate_source: stringValue(address, 'coordinate_source', 'manual'),
  })

  const currentCategories = asArray(revision?.categories)
  const categoriesForm = useForm({
    categories: currentCategories.map((item, index) => ({
      category_id: relationId(item, 'category_id', 'category') ?? 0,
      is_primary: booleanValue(item, 'is_primary'),
      sort_order: numberValue(item, 'sort_order') ?? index,
    })),
  })

  const storedHours = asArray(revision?.weekly_hours ?? revision?.hours)
  const hoursForm = useForm<{ hours: HourInput[] }>({
    hours:
      storedHours.length > 0
        ? storedHours.map((item, index) => ({
            weekday: numberValue(item, 'weekday') ?? 1,
            opens_at: stringValue(item, 'opens_at', '08:00').slice(0, 5),
            closes_at: stringValue(item, 'closes_at', '18:00').slice(0, 5),
            spans_next_day: booleanValue(item, 'spans_next_day'),
            sort_order: numberValue(item, 'sort_order') ?? index,
          }))
        : [
            {
              weekday: 1,
              opens_at: '08:00',
              closes_at: '18:00',
              spans_next_day: false,
              sort_order: 0,
            },
          ],
  })

  const media = asArray(revision?.media)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const selectedCategoryIds = useMemo(
    () => new Set(categoriesForm.data.categories.map((item) => item.category_id)),
    [categoriesForm.data.categories]
  )

  function saveIdentity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    identityForm.put(`/portal/establishments/${establishmentId}/identity`, {
      preserveScroll: true,
    })
  }

  function saveAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    addressForm.put(`/portal/establishments/${establishmentId}/address`, {
      preserveScroll: true,
    })
  }

  function saveCategories(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    categoriesForm.put(`/portal/establishments/${establishmentId}/categories`, {
      preserveScroll: true,
    })
  }

  function saveHours(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    hoursForm.setData(
      'hours',
      hoursForm.data.hours.map((hour, index) => ({ ...hour, sort_order: index }))
    )
    hoursForm.put(`/portal/establishments/${establishmentId}/hours`, {
      preserveScroll: true,
    })
  }

  function toggleCategory(categoryId: number) {
    if (selectedCategoryIds.has(categoryId)) {
      const next = categoriesForm.data.categories.filter((item) => item.category_id !== categoryId)
      if (next.length > 0 && !next.some((item) => item.is_primary)) next[0].is_primary = true
      categoriesForm.setData(
        'categories',
        next.map((item, index) => ({ ...item, sort_order: index }))
      )
      return
    }

    categoriesForm.setData('categories', [
      ...categoriesForm.data.categories,
      {
        category_id: categoryId,
        is_primary: categoriesForm.data.categories.length === 0,
        sort_order: categoriesForm.data.categories.length,
      },
    ])
  }

  async function uploadMedia(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    const formData = new FormData(formElement)
    setUploading(true)
    setUploadError(null)

    try {
      const response = await fetch(`/api/v1/establishments/${establishmentId}/media`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Accept': 'application/json',
          'x-tenant-id': String(tenant_id),
        },
        body: formData,
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as JsonRecord | null
        throw new Error(stringValue(payload, 'message', 'Não foi possível enviar a imagem.'))
      }

      formElement.reset()
      router.reload({ only: ['establishment', 'completeness'] })
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Falha ao enviar a imagem.')
    } finally {
      setUploading(false)
    }
  }

  function submitForReview() {
    router.post(`/portal/establishments/${establishmentId}/submit`, {}, { preserveScroll: true })
  }

  return (
    <MainLayout>
      <Head title={stringValue(revision, 'public_name', 'Editar unidade')} />

      <div className="space-y-8">
        <Link
          href={`/portal/organizations/${organizationId}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Voltar à organização
        </Link>

        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-primary">Editor da unidade</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              {stringValue(revision, 'public_name', 'Unidade sem nome')}
            </h1>
            <p className="mt-2 text-muted-foreground">
              Revisão {revisionStatus} · completude {completeness.score}%
            </p>
          </div>
          <button
            type="button"
            onClick={submitForReview}
            disabled={!editable || !completeness.eligible}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="size-4" /> Enviar para moderação
          </button>
        </header>

        <section className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Checklist de publicação</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                O mesmo gate é recalculado no servidor durante submissão e publicação.
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold">{completeness.score}%</p>
              <p className="text-xs text-muted-foreground">
                {completeness.eligible ? 'Pronta para submissão' : 'Ainda incompleta'}
              </p>
            </div>
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${completeness.score}%` }}
            />
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {completeness.blocking_issues.map((issue) => (
              <div
                key={`${issue.code}-${issue.field}`}
                className="flex gap-3 rounded-2xl bg-muted/60 p-4"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div>
                  <p className="text-sm font-medium">{issue.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{issue.field}</p>
                </div>
              </div>
            ))}
            {completeness.blocking_issues.length === 0 ? (
              <div className="flex gap-3 rounded-2xl bg-muted/60 p-4 md:col-span-2">
                <CheckCircle2 className="mt-0.5 size-5 text-primary" />
                <p className="text-sm font-medium">
                  Todos os requisitos de submissão foram atendidos.
                </p>
              </div>
            ) : null}
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          <form
            onSubmit={saveIdentity}
            className="space-y-5 rounded-3xl border border-border bg-card p-6"
          >
            <div>
              <h2 className="text-xl font-semibold">Identidade e contato</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Informações exibidas na ficha pública.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm sm:col-span-2">
                <span className="font-medium">Nome público</span>
                <input
                  disabled={!editable}
                  value={identityForm.data.public_name}
                  onChange={(event) => identityForm.setData('public_name', event.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 disabled:opacity-60"
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Cidade</span>
                <select
                  disabled={!editable}
                  value={identityForm.data.city_id ?? ''}
                  onChange={(event) => identityForm.setData('city_id', Number(event.target.value))}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 disabled:opacity-60"
                >
                  {cities.map((city) => (
                    <option key={Number(city.id)} value={Number(city.id)}>
                      {stringValue(city, 'name')}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Disponibilidade</span>
                <select
                  disabled={!editable}
                  value={identityForm.data.availability_type}
                  onChange={(event) =>
                    identityForm.setData('availability_type', event.target.value)
                  }
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 disabled:opacity-60"
                >
                  <option value="regular_hours">Horários regulares</option>
                  <option value="always_open">Sempre aberto</option>
                  <option value="appointment_only">Somente com agendamento</option>
                </select>
              </label>
            </div>
            <label className="block space-y-2 text-sm">
              <span className="font-medium">Descrição curta</span>
              <textarea
                disabled={!editable}
                rows={3}
                value={identityForm.data.short_description}
                onChange={(event) => identityForm.setData('short_description', event.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 disabled:opacity-60"
              />
            </label>
            <label className="block space-y-2 text-sm">
              <span className="font-medium">Descrição completa</span>
              <textarea
                disabled={!editable}
                rows={5}
                value={identityForm.data.description}
                onChange={(event) => identityForm.setData('description', event.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 disabled:opacity-60"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ['public_email', 'E-mail público'],
                  ['public_phone', 'Telefone público'],
                  ['whatsapp', 'WhatsApp'],
                  ['website', 'Website'],
                  ['instagram', 'Instagram'],
                  ['booking_url', 'Link de agendamento'],
                ] as const
              ).map(([name, label]) => (
                <label key={name} className="space-y-2 text-sm">
                  <span className="font-medium">{label}</span>
                  <input
                    disabled={!editable}
                    value={identityForm.data[name]}
                    onChange={(event) => identityForm.setData(name, event.target.value)}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 disabled:opacity-60"
                  />
                </label>
              ))}
            </div>
            {editable ? (
              <button className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                Salvar identidade
              </button>
            ) : null}
          </form>

          <form
            onSubmit={saveAddress}
            className="space-y-5 rounded-3xl border border-border bg-card p-6"
          >
            <div>
              <h2 className="text-xl font-semibold">Endereço</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Coordenadas válidas serão exigidas pelo gate de publicação.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ['postal_code', 'CEP'],
                  ['street', 'Logradouro'],
                  ['number', 'Número'],
                  ['complement', 'Complemento'],
                  ['district', 'Bairro'],
                  ['state_code', 'UF'],
                ] as const
              ).map(([name, label]) => (
                <label key={name} className="space-y-2 text-sm">
                  <span className="font-medium">{label}</span>
                  <input
                    disabled={!editable}
                    value={addressForm.data[name] as string}
                    onChange={(event) => addressForm.setData(name, event.target.value)}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 disabled:opacity-60"
                  />
                </label>
              ))}
              <label className="space-y-2 text-sm">
                <span className="font-medium">Latitude</span>
                <input
                  type="number"
                  step="any"
                  disabled={!editable}
                  value={addressForm.data.latitude ?? ''}
                  onChange={(event) =>
                    addressForm.setData(
                      'latitude',
                      event.target.value ? Number(event.target.value) : null
                    )
                  }
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 disabled:opacity-60"
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Longitude</span>
                <input
                  type="number"
                  step="any"
                  disabled={!editable}
                  value={addressForm.data.longitude ?? ''}
                  onChange={(event) =>
                    addressForm.setData(
                      'longitude',
                      event.target.value ? Number(event.target.value) : null
                    )
                  }
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 disabled:opacity-60"
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                disabled={!editable}
                checked={addressForm.data.without_number}
                onChange={(event) => addressForm.setData('without_number', event.target.checked)}
              />
              Endereço sem número
            </label>
            {editable ? (
              <button className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                Salvar endereço
              </button>
            ) : null}
          </form>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <form
            onSubmit={saveCategories}
            className="space-y-5 rounded-3xl border border-border bg-card p-6"
          >
            <div>
              <h2 className="text-xl font-semibold">Categorias</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Marque as categorias e escolha uma principal.
              </p>
            </div>
            <div className="grid max-h-96 gap-2 overflow-y-auto pr-2 sm:grid-cols-2">
              {categories.map((category) => {
                const id = Number(category.id)
                const selected = selectedCategoryIds.has(id)
                const primary = categoriesForm.data.categories.find(
                  (item) => item.category_id === id
                )?.is_primary

                return (
                  <div key={id} className="rounded-xl border border-border p-3">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        disabled={!editable}
                        checked={selected}
                        onChange={() => toggleCategory(id)}
                      />
                      {stringValue(category, 'name')}
                    </label>
                    {selected ? (
                      <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <input
                          type="radio"
                          name="primary-category"
                          disabled={!editable}
                          checked={primary === true}
                          onChange={() =>
                            categoriesForm.setData(
                              'categories',
                              categoriesForm.data.categories.map((item) => ({
                                ...item,
                                is_primary: item.category_id === id,
                              }))
                            )
                          }
                        />
                        Categoria principal
                      </label>
                    ) : null}
                  </div>
                )
              })}
            </div>
            {editable ? (
              <button className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                Salvar categorias
              </button>
            ) : null}
          </form>

          <form
            onSubmit={saveHours}
            className="space-y-5 rounded-3xl border border-border bg-card p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Horários semanais</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Você pode adicionar vários intervalos no mesmo dia.
                </p>
              </div>
              {editable ? (
                <button
                  type="button"
                  onClick={() =>
                    hoursForm.setData('hours', [
                      ...hoursForm.data.hours,
                      {
                        weekday: 1,
                        opens_at: '08:00',
                        closes_at: '18:00',
                        spans_next_day: false,
                        sort_order: hoursForm.data.hours.length,
                      },
                    ])
                  }
                  className="rounded-lg border border-border p-2"
                  aria-label="Adicionar intervalo"
                >
                  <Plus className="size-4" />
                </button>
              ) : null}
            </div>
            <div className="space-y-3">
              {hoursForm.data.hours.map((hour, index) => (
                <div
                  key={`${hour.weekday}-${index}`}
                  className="grid gap-3 rounded-2xl bg-muted/50 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
                >
                  <select
                    disabled={!editable}
                    value={hour.weekday}
                    onChange={(event) =>
                      hoursForm.setData(
                        'hours',
                        hoursForm.data.hours.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, weekday: Number(event.target.value) }
                            : item
                        )
                      )
                    }
                    className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
                  >
                    {dayLabels.map((label, weekday) => (
                      <option key={label} value={weekday}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="time"
                    disabled={!editable}
                    value={hour.opens_at}
                    onChange={(event) =>
                      hoursForm.setData(
                        'hours',
                        hoursForm.data.hours.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, opens_at: event.target.value } : item
                        )
                      )
                    }
                    className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
                  />
                  <input
                    type="time"
                    disabled={!editable}
                    value={hour.closes_at}
                    onChange={(event) =>
                      hoursForm.setData(
                        'hours',
                        hoursForm.data.hours.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, closes_at: event.target.value } : item
                        )
                      )
                    }
                    className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
                  />
                  {editable ? (
                    <button
                      type="button"
                      onClick={() =>
                        hoursForm.setData(
                          'hours',
                          hoursForm.data.hours.filter((_, itemIndex) => itemIndex !== index)
                        )
                      }
                      className="rounded-lg p-2 text-destructive"
                      aria-label="Remover intervalo"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
            {editable ? (
              <button className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                <Clock3 className="size-4" /> Salvar horários
              </button>
            ) : null}
          </form>
        </div>

        <section className="space-y-5 rounded-3xl border border-border bg-card p-6">
          <div>
            <h2 className="text-xl font-semibold">Mídia da unidade</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              JPEG, PNG ou WebP. Toda imagem começa pendente de moderação.
            </p>
          </div>
          {editable ? (
            <form
              onSubmit={uploadMedia}
              className="grid gap-4 rounded-2xl bg-muted/50 p-4 sm:grid-cols-2"
            >
              <label className="space-y-2 text-sm">
                <span className="font-medium">Imagem</span>
                <input required type="file" name="file" accept="image/jpeg,image/png,image/webp" />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Texto alternativo</span>
                <input
                  required
                  name="alt_text"
                  maxLength={180}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2"
                />
              </label>
              <input type="hidden" name="purpose" value="gallery" />
              <button
                type="submit"
                disabled={uploading}
                className="inline-flex w-fit items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                <ImagePlus className="size-4" /> {uploading ? 'Enviando…' : 'Adicionar imagem'}
              </button>
              {uploadError ? <p className="text-sm text-destructive">{uploadError}</p> : null}
            </form>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {media.map((item) => {
              const asset = asRecord(item.asset)
              const file = asRecord(asset?.file)
              const url = stringValue(file, 'url') || stringValue(asset, 'url')
              return (
                <article
                  key={Number(item.id)}
                  className="overflow-hidden rounded-2xl border border-border"
                >
                  {url ? (
                    <img
                      src={url}
                      alt={stringValue(item, 'alt_text')}
                      className="aspect-video w-full object-cover"
                    />
                  ) : null}
                  <div className="flex items-center justify-between gap-3 p-3 text-sm">
                    <span>{stringValue(item, 'moderation_status', 'pending')}</span>
                    {booleanValue(item, 'is_cover') ? (
                      <span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">
                        Capa
                      </span>
                    ) : null}
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <PilotFeedbackForm
          targets={feedback_targets}
          context="establishment"
          organizationId={organizationId}
          establishmentId={establishmentId}
        />
      </div>
    </MainLayout>
  )
}
