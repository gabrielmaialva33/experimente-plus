import { Head, Link, router, useForm } from '@inertiajs/react'
import { ArrowLeft, Building2, Loader2 } from 'lucide-react'
import { useState } from 'react'

import { Field } from '~/components/forms/field'
import { PageHeader } from '~/components/page_header'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '~/components/ui/card'
import { useUnsavedChangesGuard } from '~/hooks/use_unsaved_changes_guard'
import { MainLayout } from '~/layouts'
import type { User } from '~/types'

interface EditUserPageProps {
  user: User
  /** The operation in use and whether this account belongs to it. */
  operation?: { id: number; name: string; linked: boolean } | null
}

export default function EditUserPage({ user, operation = null }: EditUserPageProps) {
  const [linking, setLinking] = useState(false)

  const { data, setData, put, processing, errors, isDirty } = useForm({
    full_name: user.full_name || '',
  })

  const { allowNextVisit } = useUnsavedChangesGuard({ enabled: isDirty && !processing })

  function linkOperation() {
    if (linking) return
    setLinking(true)
    router.post(
      `/users/${user.id}/operation`,
      {},
      { preserveScroll: true, onFinish: () => setLinking(false) }
    )
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    allowNextVisit()
    put(`/users/${user.id}`)
  }

  return (
    <MainLayout>
      <Head title={`Editar usuário: ${user.full_name}`} />

      <div className="space-y-6">
        <PageHeader
          eyebrow="Pessoas e acesso"
          title="Editar usuário"
          description="Atualize os dados editáveis desta conta."
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
                value={user.email}
                hint="O e-mail de acesso não pode ser alterado por esta tela."
                // Read-only, not disabled: a disabled field fades to half opacity and fails
                // contrast; same treatment as "E-mail de acesso" in Conta e preferências.
                readOnly
                aria-readonly="true"
              />
            </CardContent>
            <CardFooter className="flex-wrap justify-end gap-2 border-t border-border-subtle pt-5">
              <Button asChild variant="ghost" size="xl" shape="pill">
                <Link href="/users">Cancelar</Link>
              </Button>
              <Button variant="primary" size="xl" shape="pill" type="submit" disabled={processing}>
                {processing ? 'Salvando…' : 'Salvar alterações'}
              </Button>
            </CardFooter>
          </Card>
        </form>

        {operation ? (
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg font-extrabold">
                <Building2 aria-hidden="true" className="size-4 text-primary" />
                Operação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {operation.linked ? (
                <p className="text-sm leading-6 text-muted-foreground">
                  Esta conta faz parte da operação{' '}
                  <span className="font-semibold text-foreground">{operation.name}</span>: tem
                  carteira e pode ser convidada para a equipe de uma organização.
                </p>
              ) : (
                <>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Esta conta ainda não faz parte da operação{' '}
                    <span className="font-semibold text-foreground">{operation.name}</span>. Sem o
                    vínculo, ela entra sem carteira e sem Portal. Vincular dá a ela o papel de
                    membro, o mesmo de quem se cadastra pelo site.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    shape="pill"
                    disabled={linking}
                    onClick={linkOperation}
                  >
                    {linking ? (
                      <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                    ) : null}
                    Vincular à operação {operation.name}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </MainLayout>
  )
}
