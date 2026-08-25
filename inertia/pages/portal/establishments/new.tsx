import { Head, Link, useForm } from '@inertiajs/react'
import type { FormEvent } from 'react'
import { ArrowLeft } from 'lucide-react'

import { MainLayout } from '~/layouts/main_layout'

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
  const form = useForm<EstablishmentFormData>({
    public_name: '',
    city_id: cities[0]?.id ?? null,
    short_description: '',
    public_phone: '',
    whatsapp: '',
    availability_type: 'regular_hours',
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    form.post(`/portal/organizations/${organization.id}/establishments`)
  }

  return (
    <MainLayout>
      <Head title="Nova unidade" />

      <div className="mx-auto max-w-3xl space-y-6">
        <Link
          href={`/portal/organizations/${organization.id}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Voltar para {organization.trade_name}
        </Link>

        <header>
          <p className="text-sm font-semibold text-primary">Nova unidade</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Crie a ficha operacional</h1>
          <p className="mt-2 text-muted-foreground">
            Comece pela identidade pública. Endereço, categorias, horários e mídia serão preenchidos
            no editor.
          </p>
        </header>

        <form onSubmit={submit} className="space-y-5 rounded-3xl border border-border bg-card p-6">
          <label className="block space-y-2 text-sm">
            <span className="font-medium">Nome público</span>
            <input
              required
              value={form.data.public_name}
              onChange={(event) => form.setData('public_name', event.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2"
            />
            {form.errors.public_name ? (
              <span className="text-xs text-destructive">{form.errors.public_name}</span>
            ) : null}
          </label>

          <label className="block space-y-2 text-sm">
            <span className="font-medium">Cidade</span>
            <select
              required
              value={form.data.city_id ?? ''}
              onChange={(event) => form.setData('city_id', Number(event.target.value))}
              className="w-full rounded-xl border border-input bg-background px-3 py-2"
            >
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2 text-sm">
            <span className="font-medium">Descrição curta</span>
            <textarea
              required
              rows={4}
              maxLength={280}
              value={form.data.short_description}
              onChange={(event) => form.setData('short_description', event.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="font-medium">Telefone público</span>
              <input
                value={form.data.public_phone}
                onChange={(event) => form.setData('public_phone', event.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium">WhatsApp</span>
              <input
                value={form.data.whatsapp}
                onChange={(event) => form.setData('whatsapp', event.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2"
              />
            </label>
          </div>

          <label className="block space-y-2 text-sm">
            <span className="font-medium">Disponibilidade</span>
            <select
              value={form.data.availability_type}
              onChange={(event) =>
                form.setData(
                  'availability_type',
                  event.target.value as EstablishmentFormData['availability_type']
                )
              }
              className="w-full rounded-xl border border-input bg-background px-3 py-2"
            >
              <option value="regular_hours">Horários regulares</option>
              <option value="always_open">Sempre aberto</option>
              <option value="appointment_only">Somente com agendamento</option>
            </select>
          </label>

          <div className="rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">
            Existem {categories.length} categorias ativas disponíveis. A categoria principal será
            definida no próximo passo.
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={form.processing}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {form.processing ? 'Criando…' : 'Criar e continuar'}
            </button>
          </div>
        </form>
      </div>
    </MainLayout>
  )
}
