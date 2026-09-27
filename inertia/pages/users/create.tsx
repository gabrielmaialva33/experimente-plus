import { Head, Link, useForm } from '@inertiajs/react'
import { ArrowLeft } from 'lucide-react'

import { useUnsavedChangesGuard } from '~/hooks/use_unsaved_changes_guard'
import { MainLayout } from '~/layouts'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Field } from '~/components/forms/field'
import { PageHeader } from '~/components/page_header'

interface CreateUserPageProps {
  /** The operation in use, which the new account joins as member. */
  operation?: { id: number; name: string } | null
}

export default function CreateUserPage({ operation = null }: CreateUserPageProps) {
  const { data, setData, post, processing, errors, isDirty } = useForm({
    full_name: '',
    email: '',
    password: '',
    password_confirmation: '',
  })

  const { allowNextVisit } = useUnsavedChangesGuard({ enabled: isDirty && !processing })

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    allowNextVisit()
    post('/users')
  }

  return (
    <MainLayout>
      <Head title="Adicionar usuário" />

      <div className="space-y-6">
        <PageHeader
          eyebrow="Pessoas e acesso"
          title="Adicionar usuário"
          description={
            operation
              ? `A conta entra na operação ${operation.name} como membro: ganha carteira e pode ser convidada para a equipe de uma organização.`
              : 'Nenhuma operação ativa: a conta será criada sem carteira. Escolha uma operação antes para vinculá-la.'
          }
          actions={
            <Button asChild variant="outline" size="lg" shape="pill">
              <Link href="/users">
                <ArrowLeft aria-hidden="true" className="size-4" />
                Voltar para usuários
              </Link>
            </Button>
          }
        />

        <form onSubmit={handleSubmit} aria-busy={processing}>
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle className="font-display text-lg font-extrabold">
                Dados do usuário
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <Field
                label="Nome completo"
                name="full_name"
                value={data.full_name}
                onChange={(event) => setData('full_name', event.target.value)}
                error={errors.full_name}
                autoComplete="name"
                required
              />
              <Field
                label="E-mail"
                name="email"
                type="email"
                value={data.email}
                onChange={(event) => setData('email', event.target.value)}
                error={errors.email}
                autoComplete="email"
                required
              />
              <Field
                label="Senha"
                name="password"
                type="password"
                value={data.password}
                onChange={(event) => setData('password', event.target.value)}
                error={errors.password}
                hint="Use pelo menos 8 caracteres."
                autoComplete="new-password"
                required
              />
              <Field
                label="Confirmar senha"
                name="password_confirmation"
                type="password"
                value={data.password_confirmation}
                onChange={(event) => setData('password_confirmation', event.target.value)}
                error={errors.password_confirmation}
                autoComplete="new-password"
                required
              />
            </CardContent>
            <CardFooter className="flex-wrap justify-end gap-2 border-t border-border-subtle pt-5">
              <Button asChild variant="ghost" size="xl" shape="pill">
                <Link href="/users">Cancelar</Link>
              </Button>
              <Button variant="primary" size="xl" shape="pill" type="submit" disabled={processing}>
                {processing ? 'Salvando…' : 'Salvar usuário'}
              </Button>
            </CardFooter>
          </Card>
        </form>
      </div>
    </MainLayout>
  )
}
