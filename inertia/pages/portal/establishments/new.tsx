import { Head, Link, useForm } from '@inertiajs/react'
import { ArrowLeft, Loader2, MapPinOff } from 'lucide-react'
import { useRef, type FormEvent } from 'react'

import { PageHeader } from '~/components/page_header'
import {
  EditorField,
  editorSelectClassName,
} from '~/components/portal/establishment_editor/editor_field'
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Textarea } from '~/components/ui/textarea'
import { MainLayout } from '~/layouts/main_layout'
import { formatPhoneBR } from '~/lib/br_format'
import { firstError } from '~/lib/form_errors'
import { availabilityTypeLabel } from '~/lib/labels'

interface OrganizationSummary {
  id: number
  trade_name: string
}

interface OptionRecord {
  id: number
  name: string
  slug?: string
}

interface NewEstablishmentProps {
  organization: OrganizationSummary
  cities: OptionRecord[]
  categories: OptionRecord[]
}

interface EstablishmentFormData {
  public_name: string
  city_id: number | null
  short_description: string
  public_phone: string
  whatsapp: string
  availability_type: 'regular_hours' | 'always_open' | 'appointment_only'
}

export default function NewEstablishmentPage({
  organization,
  cities,
  categories,
}: NewEstablishmentProps) {
  const submittingRef = useRef(false)
  const form = useForm<EstablishmentFormData>({
    public_name: '',
    city_id: cities[0]?.id ?? null,
    short_description: '',
    public_phone: '',
    whatsapp: '',
    availability_type: 'regular_hours',
  })
  const errors = form.errors as Record<string, unknown>
  const generalError = firstError(errors.general ?? errors.establishment ?? errors.form)
  const hasCities = cities.length > 0

  function fieldError(field: keyof EstablishmentFormData) {
    return firstError(errors[field])
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submittingRef.current || !hasCities) return

    submittingRef.current = true
    form.post(`/portal/organizations/${organization.id}/establishments`, {
      onFinish: () => {
        submittingRef.current = false
      },
    })
  }

  return (
    <MainLayout>
      <Head title="Novo lugar" />

      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          eyebrow={organization.trade_name}
          title="Novo lugar"
          description="Comece pelo nome, cidade e contato. Endereço, categorias, horários e fotos você completa em seguida, nos dados do lugar."
          actions={
            <Button asChild variant="ghost" size="lg" shape="pill">
              <Link href={`/portal/organizations/${organization.id}`}>
                <ArrowLeft aria-hidden="true" className="size-4" />
                Voltar para {organization.trade_name}
              </Link>
            </Button>
          }
        />

        {!hasCities ? (
          <Alert variant="destructive" role="alert">
            <MapPinOff aria-hidden="true" className="size-4" />
            <AlertTitle>Nenhuma cidade está disponível</AlertTitle>
            <AlertDescription>
              Ainda não é possível cadastrar lugares: nenhuma cidade foi liberada para esta
              operação. Fale com a equipe do Experimente+ antes de continuar.
            </AlertDescription>
          </Alert>
        ) : null}

        <form
          onSubmit={submit}
          className="space-y-5 rounded-card border border-border-subtle bg-card p-5 sm:p-6"
          aria-busy={form.processing}
        >
          {generalError ? (
            <Alert variant="destructive" role="alert">
              <AlertTitle>Não foi possível criar o lugar</AlertTitle>
              <AlertDescription>{generalError}</AlertDescription>
            </Alert>
          ) : null}

          <EditorField
            htmlFor="establishment-public-name"
            label="Nome público"
            required
            error={fieldError('public_name')}
          >
            <Input
              id="establishment-public-name"
              name="public_name"
              required
              minLength={2}
              maxLength={160}
              autoComplete="organization"
              disabled={form.processing || !hasCities}
              value={form.data.public_name}
              onChange={(event) => form.setData('public_name', event.target.value)}
            />
          </EditorField>

          <EditorField
            htmlFor="establishment-city"
            label="Cidade"
            hint="Onde o lugar aparece na busca do app e do site."
            required
            error={fieldError('city_id')}
          >
            <select
              id="establishment-city"
              name="city_id"
              required
              disabled={form.processing || !hasCities}
              value={form.data.city_id ?? ''}
              onChange={(event) =>
                form.setData('city_id', event.target.value ? Number(event.target.value) : null)
              }
              className={editorSelectClassName}
            >
              {!hasCities ? <option value="">Nenhuma cidade disponível</option> : null}
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
          </EditorField>

          <EditorField
            htmlFor="establishment-short-description"
            label="Descrição curta"
            required
            error={fieldError('short_description')}
          >
            <Textarea
              id="establishment-short-description"
              name="short_description"
              required
              maxLength={280}
              rows={4}
              disabled={form.processing || !hasCities}
              aria-describedby="establishment-short-description-count"
              value={form.data.short_description}
              onChange={(event) => form.setData('short_description', event.target.value)}
            />
          </EditorField>
          <p
            id="establishment-short-description-count"
            aria-live="polite"
            className="-mt-3 text-end text-xs text-muted-foreground"
          >
            {form.data.short_description.length.toLocaleString('pt-BR')} de 280 caracteres
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <EditorField
              htmlFor="establishment-public-phone"
              label="Telefone público"
              error={fieldError('public_phone')}
            >
              <Input
                id="establishment-public-phone"
                name="public_phone"
                type="tel"
                maxLength={32}
                inputMode="tel"
                autoComplete="tel"
                disabled={form.processing || !hasCities}
                value={form.data.public_phone}
                onChange={(event) => form.setData('public_phone', event.target.value)}
                onBlur={(event) => form.setData('public_phone', formatPhoneBR(event.target.value))}
              />
            </EditorField>

            <EditorField
              htmlFor="establishment-whatsapp"
              label="WhatsApp"
              hint="Informe um número que possa receber mensagens dos visitantes."
              error={fieldError('whatsapp')}
            >
              <Input
                id="establishment-whatsapp"
                name="whatsapp"
                type="tel"
                maxLength={32}
                inputMode="tel"
                autoComplete="tel"
                disabled={form.processing || !hasCities}
                value={form.data.whatsapp}
                onChange={(event) => form.setData('whatsapp', event.target.value)}
                onBlur={(event) => form.setData('whatsapp', formatPhoneBR(event.target.value))}
              />
            </EditorField>
          </div>

          <EditorField
            htmlFor="establishment-availability"
            label="Forma de atendimento"
            error={fieldError('availability_type')}
          >
            <select
              id="establishment-availability"
              name="availability_type"
              disabled={form.processing || !hasCities}
              value={form.data.availability_type}
              onChange={(event) =>
                form.setData(
                  'availability_type',
                  event.target.value as EstablishmentFormData['availability_type']
                )
              }
              className={editorSelectClassName}
            >
              {(['regular_hours', 'always_open', 'appointment_only'] as const).map((value) => (
                <option key={value} value={value}>
                  {availabilityTypeLabel(value)}
                </option>
              ))}
            </select>
          </EditorField>

          <div className="rounded-2xl border border-info/25 bg-info-soft px-4 py-3">
            <p className="text-sm font-bold">Depois de criar</p>
            <p className="mt-1 text-sm leading-6 text-foreground">
              Você escolhe a categoria principal entre {categories.length.toLocaleString('pt-BR')}{' '}
              opções e completa as características nos dados do lugar.
            </p>
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              size="xl"
              shape="pill"
              disabled={form.processing || !hasCities}
              aria-busy={form.processing}
            >
              {form.processing ? (
                <>
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                  Criando…
                </>
              ) : (
                'Criar e continuar'
              )}
            </Button>
          </div>
        </form>
      </div>
    </MainLayout>
  )
}
