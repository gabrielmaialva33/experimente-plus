import { Head, Link, useForm } from '@inertiajs/react'
import { ArrowLeft, Building2, Loader2 } from 'lucide-react'
import { useRef, type FormEvent } from 'react'

import { PageHeader } from '~/components/page_header'
import { EditorField } from '~/components/portal/establishment_editor/editor_field'
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { MainLayout } from '~/layouts/main_layout'
import { firstError } from '~/lib/form_errors'

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
  const submittingRef = useRef(false)
  const form = useForm<OrganizationFormData>({
    legal_name: '',
    trade_name: '',
    slug: '',
    tax_id: '',
    email: '',
    phone: '',
    website: '',
  })
  const errors = form.errors as Record<string, unknown>
  const generalError = firstError(errors.general ?? errors.organization ?? errors.form)

  function fieldError(field: keyof OrganizationFormData) {
    return firstError(errors[field])
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submittingRef.current) return

    submittingRef.current = true
    form.post('/portal/organizations', {
      onFinish: () => {
        submittingRef.current = false
      },
    })
  }

  return (
    <MainLayout>
      <Head title="Nova organização" />

      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          eyebrow="Portal do parceiro"
          icon={Building2}
          title="Cadastre a organização"
          description="A organização representa a empresa ou identidade legal. Cada endereço público será uma unidade separada."
          actions={
            <Button asChild variant="outline">
              <Link href="/portal">
                <ArrowLeft aria-hidden="true" className="size-4" />
                Voltar ao portal
              </Link>
            </Button>
          }
        />

        <form
          onSubmit={submit}
          className="space-y-6 rounded-lg border border-border bg-card p-5 sm:p-6"
          aria-busy={form.processing}
        >
          {generalError ? (
            <Alert variant="destructive" role="alert">
              <AlertTitle>Não foi possível criar a organização</AlertTitle>
              <AlertDescription>{generalError}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-5 sm:grid-cols-2">
            <EditorField
              htmlFor="organization-legal-name"
              label="Razão social"
              required
              error={fieldError('legal_name')}
            >
              <Input
                id="organization-legal-name"
                name="legal_name"
                required
                maxLength={180}
                autoComplete="organization"
                disabled={form.processing}
                value={form.data.legal_name}
                onChange={(event) => form.setData('legal_name', event.target.value)}
              />
            </EditorField>

            <EditorField
              htmlFor="organization-trade-name"
              label="Nome fantasia"
              required
              error={fieldError('trade_name')}
            >
              <Input
                id="organization-trade-name"
                name="trade_name"
                required
                maxLength={160}
                autoComplete="organization"
                disabled={form.processing}
                value={form.data.trade_name}
                onChange={(event) => form.setData('trade_name', event.target.value)}
              />
            </EditorField>

            <EditorField
              htmlFor="organization-slug"
              label="Endereço da página"
              hint="Opcional. Quando vazio, a plataforma cria o endereço a partir do nome fantasia."
              error={fieldError('slug')}
            >
              <Input
                id="organization-slug"
                name="slug"
                maxLength={180}
                autoComplete="off"
                spellCheck={false}
                placeholder="nome-da-organizacao"
                disabled={form.processing}
                value={form.data.slug}
                onChange={(event) => form.setData('slug', event.target.value)}
              />
            </EditorField>

            <EditorField
              htmlFor="organization-tax-id"
              label="CNPJ"
              hint="Digite somente os 14 números ou use a formatação habitual. A validação final é feita pelo servidor."
              required
              error={fieldError('tax_id')}
            >
              <Input
                id="organization-tax-id"
                name="tax_id"
                required
                maxLength={18}
                inputMode="numeric"
                autoComplete="off"
                disabled={form.processing}
                value={form.data.tax_id}
                onChange={(event) => form.setData('tax_id', event.target.value)}
              />
            </EditorField>

            <EditorField
              htmlFor="organization-email"
              label="E-mail"
              required
              error={fieldError('email')}
            >
              <Input
                id="organization-email"
                name="email"
                type="email"
                required
                maxLength={254}
                autoComplete="email"
                disabled={form.processing}
                value={form.data.email}
                onChange={(event) => form.setData('email', event.target.value)}
              />
            </EditorField>

            <EditorField
              htmlFor="organization-phone"
              label="Telefone"
              required
              error={fieldError('phone')}
            >
              <Input
                id="organization-phone"
                name="phone"
                type="tel"
                required
                minLength={10}
                maxLength={20}
                inputMode="tel"
                autoComplete="tel"
                disabled={form.processing}
                value={form.data.phone}
                onChange={(event) => form.setData('phone', event.target.value)}
              />
            </EditorField>
          </div>

          <EditorField
            htmlFor="organization-website"
            label="Website"
            hint="Opcional. Informe a URL completa, incluindo https://."
            error={fieldError('website')}
          >
            <Input
              id="organization-website"
              name="website"
              type="url"
              maxLength={2048}
              autoComplete="url"
              placeholder="https://exemplo.com.br"
              disabled={form.processing}
              value={form.data.website}
              onChange={(event) => form.setData('website', event.target.value)}
            />
          </EditorField>

          <Alert>
            <AlertTitle>Como esses dados serão usados</AlertTitle>
            <AlertDescription>
              O CNPJ será normalizado e validado no backend. Os dados legais permanecem privados e a
              organização precisa ser aprovada antes da publicação das unidades.
            </AlertDescription>
          </Alert>

          <div className="flex justify-end">
            <Button type="submit" disabled={form.processing} aria-busy={form.processing}>
              {form.processing ? (
                <>
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                  Criando…
                </>
              ) : (
                'Criar organização'
              )}
            </Button>
          </div>
        </form>
      </div>
    </MainLayout>
  )
}
