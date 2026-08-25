import { Head, Link, useForm } from '@inertiajs/react'
import type { FormEvent } from 'react'
import { ArrowLeft } from 'lucide-react'

import { MainLayout } from '~/layouts/main_layout'

interface OrganizationFormData {
  legal_name: string
  trade_name: string
  slug: string
  tax_id: string
  email: string
  phone: string
  website: string
}

export default function NewOrganizationPage() {
  const form = useForm<OrganizationFormData>({
    legal_name: '',
    trade_name: '',
    slug: '',
    tax_id: '',
    email: '',
    phone: '',
    website: '',
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    form.post('/portal/organizations')
  }

  const field = (name: keyof OrganizationFormData, label: string, required = false) => (
    <label className="space-y-2 text-sm">
      <span className="font-medium">{label}</span>
      <input
        required={required}
        value={form.data[name]}
        onChange={(event) => form.setData(name, event.target.value)}
        className="w-full rounded-xl border border-input bg-background px-3 py-2"
      />
      {form.errors[name] ? (
        <span className="text-xs text-destructive">{form.errors[name]}</span>
      ) : null}
    </label>
  )

  return (
    <MainLayout>
      <Head title="Nova organização" />

      <div className="mx-auto max-w-3xl space-y-6">
        <Link
          href="/portal"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Voltar ao portal
        </Link>

        <header>
          <p className="text-sm font-semibold text-primary">Onboarding</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Cadastre a organização</h1>
          <p className="mt-2 text-muted-foreground">
            A organização representa a empresa ou identidade legal. Cada endereço público será uma
            unidade separada.
          </p>
        </header>

        <form onSubmit={submit} className="space-y-6 rounded-3xl border border-border bg-card p-6">
          <div className="grid gap-5 sm:grid-cols-2">
            {field('legal_name', 'Razão social', true)}
            {field('trade_name', 'Nome fantasia', true)}
            {field('slug', 'Slug público')}
            {field('tax_id', 'CNPJ', true)}
            {field('email', 'E-mail', true)}
            {field('phone', 'Telefone', true)}
          </div>

          {field('website', 'Website')}

          <div className="rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">
            O CNPJ será normalizado e validado no backend. Dados legais permanecem privados e a
            organização precisa ser aprovada antes da publicação das unidades.
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={form.processing}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {form.processing ? 'Criando…' : 'Criar organização'}
            </button>
          </div>
        </form>
      </div>
    </MainLayout>
  )
}
