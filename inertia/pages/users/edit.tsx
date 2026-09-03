import { Head, Link, useForm } from '@inertiajs/react'
import { ArrowLeft } from 'lucide-react'

import { Field } from '~/components/forms/field'
import { PageHeader } from '~/components/page_header'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '~/components/ui/card'
import { MainLayout } from '~/layouts'
import type { User } from '~/types'

interface EditUserPageProps {
  user: User
}

export default function EditUserPage({ user }: EditUserPageProps) {
  const { data, setData, put, processing, errors } = useForm({
    full_name: user.full_name || '',
  })

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    put(`/users/${user.id}`)
  }

  return (
    <MainLayout>
      <Head title={`Editar usuário: ${user.full_name}`} />

      <div className="space-y-6">
        <PageHeader
          title="Editar usuário"
          description="Atualize os dados editáveis desta conta."
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
                value={user.email}
                hint="O e-mail de acesso não pode ser alterado por esta tela."
                disabled
                readOnly
              />
            </CardContent>
            <CardFooter className="justify-end gap-2 border-t pt-5">
              <Button asChild variant="outline" type="button">
                <Link href="/users">Cancelar</Link>
              </Button>
              <Button variant="primary" type="submit" disabled={processing}>
                {processing ? 'Salvando…' : 'Salvar alterações'}
              </Button>
            </CardFooter>
          </Card>
        </form>
      </div>
    </MainLayout>
  )
}
