import { Head, Link, useForm } from '@inertiajs/react'
import { ArrowLeft, Loader2, MapPinOff } from 'lucide-react'
import { useRef, type FormEvent } from 'react'

import {
  EditorField,
  editorSelectClassName,
} from '~/components/portal/establishment_editor/editor_field'
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Textarea } from '~/components/ui/textarea'
import { MainLayout } from '~/layouts/main_layout'
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
      <Head title="Nova unidade" />

      <div className="mx-auto max-w-3xl space-y-6">
        <Button asChild variant="ghost" size="sm" className="-ms-3">
          <Link href={`/portal/organizations/${organization.id}`}>
            <ArrowLeft aria-hidden="true" className="size-4" />
            Voltar para {organization.trade_name}
          </Link>
        </Button>

        <header>
          <p className="text-sm font-semibold text-primary">Nova unidade</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Crie a ficha operacional</h1>
          <p className="mt-2 text-muted-foreground">
            Comece pela identidade pública. Endereço, categorias, horários e mídia serão preenchidos
            no editor.
          </p>
        </header>

        {!hasCities ? (
          <Alert variant="destructive" role="alert">
            <MapPinOff aria-hidden="true" className="size-4" />
            <AlertTitle>Nenhuma cidade está disponível</AlertTitle>
            <AlertDescription>
              O cadastro da unidade está bloqueado até que a operação habilite ao menos uma cidade
              para este tenant. Procure a equipe da plataforma antes de continuar.
            </AlertDescription>
          </Alert>
        ) : null}

        <form
          onSubmit={submit}
          className="space-y-5 rounded-3xl border border-border bg-card p-6"
          aria-busy={form.processing}
        >
          {generalError ? (
            <Alert variant="destructive" role="alert">
              <AlertTitle>Não foi possível criar a unidade</AlertTitle>
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
            hint="A cidade organiza a descoberta pública da unidade."
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
              />
            </EditorField>
          </div>

          <EditorField
            htmlFor="establishment-availability"
            label="Disponibilidade"
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

          <Alert>
            <AlertTitle>Próxima etapa</AlertTitle>
            <AlertDescription>
              Existem {categories.length.toLocaleString('pt-BR')} categorias ativas disponíveis. A
              categoria principal e os atributos serão definidos no editor após a criação.
            </AlertDescription>
          </Alert>

          <div className="flex justify-end">
            <Button type="submit" disabled={form.processing || !hasCities}>
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
