import { Head, router, useForm, usePage } from '@inertiajs/react'
import { useTheme } from 'next-themes'
import {
  Building2,
  Check,
  Loader2,
  Monitor,
  Moon,
  ShieldAlert,
  Sun,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'

import { ConfirmDialog } from '~/components/confirm_dialog'
import { EmptyState } from '~/components/empty_state'
import { PageHeader } from '~/components/page_header'
import { EditorField } from '~/components/portal/establishment_editor/editor_field'
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardHeading, CardTitle } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { useAuth } from '~/hooks/use_auth'
import { MainLayout } from '~/layouts'
import { firstError } from '~/lib/form_errors'
import { operationRoleLabel } from '~/lib/labels'
import { cn } from '~/lib/utils'

interface SettingsProfile {
  id: number
  full_name: string
  email: string
  username: string | null
}

interface SettingsPageProps {
  profile: SettingsProfile
}

const THEMES: { value: string; label: string; description: string; icon: LucideIcon }[] = [
  { value: 'light', label: 'Claro', description: 'Sempre usar o tema claro.', icon: Sun },
  { value: 'dark', label: 'Escuro', description: 'Sempre usar o tema escuro.', icon: Moon },
  {
    value: 'system',
    label: 'Do dispositivo',
    description: 'Acompanhar a preferência do sistema.',
    icon: Monitor,
  },
]

function ProfileTab({ profile }: { profile: SettingsProfile }) {
  const form = useForm({ full_name: profile.full_name, username: profile.username ?? '' })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (form.processing) return
    form.post('/settings/profile', { preserveScroll: true })
  }

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardHeading>
          <CardTitle>Dados pessoais</CardTitle>
          <p className="text-sm text-muted-foreground">
            Atualize como seu nome aparece nas áreas autenticadas.
          </p>
        </CardHeading>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} aria-busy={form.processing} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <EditorField
              htmlFor="settings-full-name"
              label="Nome completo"
              required
              error={firstError(form.errors.full_name)}
            >
              <Input
                id="settings-full-name"
                name="full_name"
                required
                autoComplete="name"
                disabled={form.processing}
                value={form.data.full_name}
                onChange={(event) => form.setData('full_name', event.target.value)}
              />
            </EditorField>

            <EditorField
              htmlFor="settings-username"
              label="Nome de usuário"
              hint="Opcional. Usado apenas para identificar sua conta dentro da plataforma."
              error={firstError(form.errors.username)}
            >
              <Input
                id="settings-username"
                name="username"
                autoComplete="username"
                disabled={form.processing}
                value={form.data.username}
                onChange={(event) => form.setData('username', event.target.value)}
              />
            </EditorField>
          </div>

          <EditorField
            htmlFor="settings-email"
            label="E-mail de acesso"
            hint="Este e-mail é usado para entrar e ainda não pode ser alterado por esta tela."
          >
            <Input id="settings-email" value={profile.email} readOnly aria-readonly="true" />
          </EditorField>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <p role="status" aria-live="polite" className="me-auto text-sm text-success">
              {form.recentlySuccessful ? 'Dados pessoais atualizados.' : ''}
            </p>
            <Button type="submit" disabled={form.processing || !form.isDirty}>
              {form.processing ? (
                <>
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                  Salvando…
                </>
              ) : (
                'Salvar alterações'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function AppearanceTab() {
  const { theme, setTheme } = useTheme()

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardHeading>
          <CardTitle>Aparência</CardTitle>
          <p className="text-sm text-muted-foreground">
            Escolha um tema. A preferência fica salva neste navegador.
          </p>
        </CardHeading>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-3" role="group" aria-label="Tema da interface">
          {THEMES.map((option) => {
            const active = theme === option.value
            const Icon = option.icon

            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => setTheme(option.value)}
                className={cn(
                  'relative flex min-h-32 flex-col items-start gap-3 rounded-md border p-4 text-start outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  active
                    ? 'border-primary bg-primary-soft text-foreground'
                    : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <Icon aria-hidden="true" className="size-5" />
                  {active ? <Check aria-hidden="true" className="size-4 text-primary" /> : null}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-foreground">{option.label}</span>
                  <span className="mt-1 block text-xs leading-5">{option.description}</span>
                </span>
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function AccountTab() {
  const { errors: sharedErrors } = usePage().props as { errors?: Record<string, unknown> }
  const form = useForm({ current_password: '', confirmation: '' })
  const [dialogOpen, setDialogOpen] = useState(false)
  const generalError = firstError(sharedErrors?.general)

  function requestDeletion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (form.processing) return
    setDialogOpen(true)
  }

  function confirmDeletion() {
    if (form.processing) return
    form.delete('/settings/account', {
      preserveScroll: true,
      onFinish: () => setDialogOpen(false),
    })
  }

  const confirmationReady =
    Boolean(form.data.current_password) && form.data.confirmation.trim().toUpperCase() === 'DELETE'

  return (
    <Card className="max-w-3xl border-destructive/40">
      <CardHeader>
        <CardHeading>
          <CardTitle className="text-destructive">Segurança e exclusão</CardTitle>
          <p className="text-sm text-muted-foreground">
            A exclusão desativa a conta, revoga as credenciais e anonimiza seus dados pessoais.
            Referências históricas exigidas para auditoria permanecem sem identificar você.
          </p>
        </CardHeading>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={requestDeletion}
          aria-busy={form.processing}
          className="max-w-xl space-y-5"
        >
          {generalError ? (
            <Alert variant="destructive" role="alert">
              <AlertTitle>Não foi possível excluir a conta</AlertTitle>
              <AlertDescription>{generalError}</AlertDescription>
            </Alert>
          ) : null}

          <EditorField
            htmlFor="settings-current-password"
            label="Senha atual"
            required
            error={firstError(form.errors.current_password)}
          >
            <Input
              id="settings-current-password"
              name="current_password"
              type="password"
              required
              autoComplete="current-password"
              disabled={form.processing}
              value={form.data.current_password}
              onChange={(event) => form.setData('current_password', event.target.value)}
            />
          </EditorField>

          <EditorField
            htmlFor="settings-delete-confirmation"
            label={
              <>
                Digite <strong>DELETE</strong> para confirmar
              </>
            }
            required
            hint="A palavra de confirmação evita uma exclusão acidental."
            error={firstError(form.errors.confirmation)}
          >
            <Input
              id="settings-delete-confirmation"
              name="confirmation"
              required
              autoComplete="off"
              spellCheck={false}
              disabled={form.processing}
              value={form.data.confirmation}
              onChange={(event) => form.setData('confirmation', event.target.value)}
            />
          </EditorField>

          <Button
            type="submit"
            variant="destructive"
            disabled={form.processing || !confirmationReady}
          >
            <Trash2 aria-hidden="true" className="size-4" />
            Excluir minha conta
          </Button>
        </form>

        <ConfirmDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          title="Excluir sua conta permanentemente?"
          description="Você sairá do Experimente+ e perderá o acesso à carteira, ao Portal e às áreas administrativas. Esta ação não pode ser desfeita."
          confirmLabel="Confirmar exclusão"
          destructive
          processing={form.processing}
          disabled={!confirmationReady}
          onConfirm={confirmDeletion}
        />
      </CardContent>
    </Card>
  )
}

function OperationsTab() {
  const { tenants, activeTenantId, can } = useAuth()
  const form = useForm({ name: '' })
  const [switchingId, setSwitchingId] = useState<number | null>(null)
  const canCreateOperation = can('tenants.create')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (form.processing) return
    form.post('/settings/workspaces', {
      preserveScroll: true,
      onSuccess: () => form.reset(),
    })
  }

  function switchOperation(tenantId: number) {
    if (tenantId === activeTenantId || switchingId !== null) return
    setSwitchingId(tenantId)
    router.post(
      '/tenant/switch',
      { tenant_id: tenantId },
      {
        preserveScroll: true,
        onFinish: () => setSwitchingId(null),
      }
    )
  }

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardHeading>
          <CardTitle>Operações</CardTitle>
          <p className="text-sm text-muted-foreground">
            Operações isolam dados privados. Cidades e organizações continuam dentro da
            operação selecionada.
          </p>
        </CardHeading>
      </CardHeader>
      <CardContent className="space-y-5">
        {canCreateOperation ? (
          <form onSubmit={submit} aria-busy={form.processing} className="space-y-3 border-b pb-5">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <EditorField
                htmlFor="settings-operation-name"
                label="Nome da nova operação"
                required
                error={firstError(form.errors.name)}
              >
                <Input
                  id="settings-operation-name"
                  name="name"
                  required
                  disabled={form.processing}
                  value={form.data.name}
                  onChange={(event) => form.setData('name', event.target.value)}
                  placeholder="Nome da operação"
                />
              </EditorField>
              <Button type="submit" disabled={form.processing || !form.data.name.trim()}>
                {form.processing ? (
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                ) : null}
                {form.processing ? 'Criando…' : 'Criar operação'}
              </Button>
            </div>
          </form>
        ) : null}

        {tenants.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="Nenhuma operação disponível"
            description="Sua conta ainda não participa de uma operação ativa."
            className="py-8"
          />
        ) : (
          <ul className="divide-y divide-border" aria-busy={switchingId !== null}>
            {tenants.map((tenant) => {
              const active = tenant.id === activeTenantId
              const switching = switchingId === tenant.id

              return (
                <li
                  key={tenant.id}
                  className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary-accent">
                    <Building2 aria-hidden="true" className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{tenant.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {operationRoleLabel(tenant.role)}
                    </span>
                  </span>
                  {active ? (
                    <Badge variant="primary" appearance="light" size="sm">
                      Operação ativa
                    </Badge>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={switchingId !== null}
                      onClick={() => switchOperation(tenant.id)}
                    >
                      {switching ? (
                        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                      ) : null}
                      {switching ? 'Selecionando…' : 'Usar esta operação'}
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function labelWithStrong(prefix: string, value: string): ReactNode {
  return (
    <>
      {prefix} <strong>{value}</strong>
    </>
  )
}

export default function SettingsPage({ profile }: SettingsPageProps) {
  const { url } = usePage()
  const { tenants, can } = useAuth()
  const requestedTab = new URL(url, 'http://localhost').searchParams.get('tab')
  const showOperations = tenants.length > 0 || can('tenants.create')
  const allowedTabs = new Set(['profile', 'appearance', 'security'])
  if (showOperations) allowedTabs.add('operations')
  const normalizedRequestedTab = requestedTab === 'workspaces' ? 'operations' : requestedTab
  const defaultTab =
    normalizedRequestedTab && allowedTabs.has(normalizedRequestedTab)
      ? normalizedRequestedTab
      : 'profile'

  return (
    <MainLayout>
      <Head title="Conta e preferências" />

      <div className="space-y-6">
        <PageHeader
          icon={ShieldAlert}
          eyebrow="Minha conta"
          title="Conta e preferências"
          description="Gerencie seus dados pessoais, a aparência da interface e as opções de segurança realmente disponíveis."
        />

        <Tabs defaultValue={defaultTab} className="space-y-4">
          <TabsList variant="line" aria-label="Seções da conta">
            <TabsTrigger value="profile">Dados pessoais</TabsTrigger>
            <TabsTrigger value="appearance">Aparência</TabsTrigger>
            {showOperations ? <TabsTrigger value="operations">Operações</TabsTrigger> : null}
            <TabsTrigger value="security">Segurança</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <ProfileTab profile={profile} />
          </TabsContent>
          <TabsContent value="appearance">
            <AppearanceTab />
          </TabsContent>
          {showOperations ? (
            <TabsContent value="operations">
              <OperationsTab />
            </TabsContent>
          ) : null}
          <TabsContent value="security">
            <AccountTab />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  )
}
