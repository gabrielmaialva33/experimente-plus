import { Head, Link, useForm } from '@inertiajs/react'
import { ArrowLeft } from 'lucide-react'

import { MainLayout } from '~/layouts'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Field } from '~/components/forms/field'
import { PageHeader } from '~/components/page_header'

export default function CreateUserPage() {
  const { data, setData, post, processing, errors } = useForm({
    full_name: '',
    email: '',
    password: '',
    password_confirmation: '',
  })

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    post('/users')
  }

  return (
    <MainLayout>
      <Head title="Adicionar usuário" />

      <div className="space-y-6">
        <PageHeader
          title="Adicionar usuário"
          description="Crie uma conta administrativa com os dados necessários."
          actions={
            <Button asChild variant="outline">
              <Link href="/users">
                <ArrowLeft className="size-4" />
                Voltar para usuários
              </Link>
            </Button>
          }
        />

        <form onSubmit={handleSubmit} aria-busy={processing}>
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle>Dados do usuário</CardTitle>
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
                label="Email"
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
            <CardFooter className="justify-end gap-2 border-t pt-5">
              <Button asChild variant="outline" type="button">
                <Link href="/users">Cancelar</Link>
              </Button>
              <Button variant="primary" type="submit" disabled={processing}>
                {processing ? 'Salvando…' : 'Salvar usuário'}
              </Button>
            </CardFooter>
          </Card>
        </form>
      </div>
    </MainLayout>
  )
}
