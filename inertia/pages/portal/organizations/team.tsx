import { Head, Link, router, useForm } from '@inertiajs/react'
import {
  ArrowLeft,
  Clock3,
  Loader2,
  Mail,
  MoreHorizontal,
  RotateCcw,
  Send,
  ShieldCheck,
  TriangleAlert,
  UserMinus,
  UserPlus,
  UserRoundCog,
  UserRoundX,
  UsersRound,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { ConfirmDialog } from '~/components/confirm_dialog'
import { EmptyState } from '~/components/empty_state'
import { Field } from '~/components/forms/field'
import { PageHeader } from '~/components/page_header'
import { OrganizationRolePicker } from '~/components/portal/organization_role_picker'
import { Alert, AlertContent, AlertDescription, AlertIcon, AlertTitle } from '~/components/ui/alert'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { MainLayout } from '~/layouts/main_layout'
import {
  formatDate,
  formatDateTime,
  ORGANIZATION_ROLE_DESCRIPTIONS,
  organizationMemberStatusLabel,
  organizationRoleLabel,
} from '~/lib/labels'
import { cn } from '~/lib/utils'

type Role = 'owner' | 'admin' | 'editor' | 'analyst'

interface TeamMember {
  id: number
  user: { id: number; full_name: string; email: string }
  role: Role
  status: 'active' | 'suspended'
  joined_at: string | null
  suspended_at: string | null
  is_self: boolean
  is_last_owner: boolean
  actions: {
    roles: Role[]
    suspend: boolean
    reactivate: boolean
    remove: boolean
  }
}

interface TeamInvitation {
  id: number
  email: string
  role: Role
  state: 'pending' | 'expired'
  expires_at: string
  created_at: string
  invited_by: string | null
  actions: { resend: boolean; cancel: boolean }
}

export interface OrganizationTeamPageProps {
  organization: {
    id: number
    trade_name: string
    status: string
    accepts_invitations: boolean
  }
  viewer: {
    source: 'membership' | 'platform_admin' | 'platform_moderator'
    role: Role | null
  }
  members: TeamMember[]
  invitations: TeamInvitation[]
  invite_roles: Role[]
}

type PendingConfirmation =
  | { kind: 'suspend'; member: TeamMember }
  | { kind: 'remove'; member: TeamMember }
  | { kind: 'cancel'; invitation: TeamInvitation }

const ROLE_ORDER: Role[] = ['owner', 'admin', 'editor', 'analyst']

function initialsOf(name: string): string {
  return (
    name
      .split(' ')
      .map((part) => part.charAt(0))
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  )
}

function viewerLabel(viewer: OrganizationTeamPageProps['viewer']): string {
  if (viewer.source === 'platform_admin') return 'Administração da plataforma'
  if (viewer.source === 'platform_moderator' && !viewer.role) return 'Moderação da plataforma'
  return organizationRoleLabel(viewer.role)
}

function hasMemberActions(member: TeamMember): boolean {
  return (
    member.actions.roles.length > 0 ||
    member.actions.suspend ||
    member.actions.reactivate ||
    member.actions.remove
  )
}

export default function OrganizationTeamPage({
  organization,
  viewer,
  members,
  invitations,
  invite_roles: inviteRoles,
}: OrganizationTeamPageProps) {
  const [inviteOpen, setInviteOpen] = useState(false)
  const [roleTarget, setRoleTarget] = useState<TeamMember | null>(null)
  const [nextRole, setNextRole] = useState<string>('')
  const [confirmation, setConfirmation] = useState<PendingConfirmation | null>(null)
  const [processing, setProcessing] = useState<string | null>(null)
  const invite = useForm({ email: '', role: inviteRoles.includes('editor') ? 'editor' : '' })

  const teamPath = `/portal/organizations/${organization.id}/team`
  const canInvite = inviteRoles.length > 0
  const activeCount = members.filter((member) => member.status === 'active').length
  const suspendedCount = members.length - activeCount
  const canManageAnyone = members.some(hasMemberActions)
  const busy = processing !== null

  function run(key: string, visit: (options: { onFinish: () => void }) => void) {
    if (processing) return
    setProcessing(key)
    visit({
      onFinish: () => {
        setProcessing(null)
        setConfirmation(null)
        setRoleTarget(null)
      },
    })
  }

  function openInvite() {
    invite.clearErrors()
    setInviteOpen(true)
  }

  function submitInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    invite.post(`${teamPath}/invitations`, {
      preserveScroll: true,
      onSuccess: () => {
        invite.reset()
        setInviteOpen(false)
      },
    })
  }

  function openRoleDialog(member: TeamMember) {
    setNextRole(member.actions.roles[0] ?? '')
    setRoleTarget(member)
  }

  function submitRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!roleTarget || !nextRole) return
    const target = roleTarget
    run(`role-${target.id}`, ({ onFinish }) =>
      router.patch(
        `${teamPath}/members/${target.id}`,
        { role: nextRole },
        { preserveScroll: true, onFinish }
      )
    )
  }

  function reactivate(member: TeamMember) {
    run(`reactivate-${member.id}`, ({ onFinish }) =>
      router.patch(
        `${teamPath}/members/${member.id}`,
        { status: 'active' },
        { preserveScroll: true, onFinish }
      )
    )
  }

  function resend(invitation: TeamInvitation) {
    run(`resend-${invitation.id}`, ({ onFinish }) =>
      router.post(
        `${teamPath}/invitations/${invitation.id}/resend`,
        {},
        { preserveScroll: true, onFinish }
      )
    )
  }

  function confirmPending() {
    if (!confirmation) return
    if (confirmation.kind === 'suspend') {
      const { member } = confirmation
      run(`suspend-${member.id}`, ({ onFinish }) =>
        router.patch(
          `${teamPath}/members/${member.id}`,
          { status: 'suspended' },
          { preserveScroll: true, onFinish }
        )
      )
    } else if (confirmation.kind === 'remove') {
      const { member } = confirmation
      run(`remove-${member.id}`, ({ onFinish }) =>
        router.delete(`${teamPath}/members/${member.id}`, { preserveScroll: true, onFinish })
      )
    } else {
      const { invitation } = confirmation
      run(`cancel-${invitation.id}`, ({ onFinish }) =>
        router.delete(`${teamPath}/invitations/${invitation.id}`, {
          preserveScroll: true,
          onFinish,
        })
      )
    }
  }

  const confirmationCopy = (() => {
    if (!confirmation) return null
    if (confirmation.kind === 'suspend') {
      const name = confirmation.member.user.full_name
      return {
        title: `Suspender o acesso de ${name}?`,
        description: `${name} deixa de entrar no Portal desta organização até ser reativado. O vínculo e o histórico continuam, e um proprietário ou administrador pode reativar o acesso quando quiser.`,
        confirmLabel: 'Suspender acesso',
      }
    }
    if (confirmation.kind === 'remove') {
      const name = confirmation.member.user.full_name
      return {
        title: `Remover ${name} da equipe?`,
        description: `${name} perde o acesso a ${organization.trade_name} imediatamente. Para voltar, será preciso um novo convite.`,
        confirmLabel: 'Remover da equipe',
      }
    }
    return {
      title: `Cancelar o convite para ${confirmation.invitation.email}?`,
      description:
        'O link enviado deixa de funcionar na hora. Você pode convidar a mesma pessoa de novo quando quiser.',
      confirmLabel: 'Cancelar convite',
    }
  })()

  return (
    <MainLayout>
      <Head title={`Equipe · ${organization.trade_name}`} />

      <div className="space-y-7">
        <PageHeader
          eyebrow={`${organization.trade_name} · ${viewerLabel(viewer)}`}
          title="Equipe"
          description="Quem tem acesso a esta organização no Portal, com que papel, e os convites que ainda não foram aceitos."
          meta={
            <>
              <Badge variant="success" appearance="light" shape="pill" size="lg">
                {activeCount === 1 ? '1 pessoa ativa' : `${activeCount} pessoas ativas`}
              </Badge>
              {suspendedCount > 0 ? (
                <Badge variant="warning" appearance="light" shape="pill" size="lg">
                  {suspendedCount === 1 ? '1 suspensa' : `${suspendedCount} suspensas`}
                </Badge>
              ) : null}
              {invitations.length > 0 ? (
                <Badge variant="info" appearance="light" shape="pill" size="lg">
                  {invitations.length === 1
                    ? '1 convite pendente'
                    : `${invitations.length} convites pendentes`}
                </Badge>
              ) : null}
            </>
          }
          actions={
            <>
              <Button asChild variant="ghost" size="lg" shape="pill">
                <Link href={`/portal/organizations/${organization.id}`}>
                  <ArrowLeft aria-hidden="true" className="size-4" />
                  Voltar à organização
                </Link>
              </Button>
              {canInvite ? (
                <Button type="button" size="xl" shape="pill" onClick={openInvite}>
                  <UserPlus aria-hidden="true" className="size-4" />
                  Convidar pessoa
                </Button>
              ) : null}
            </>
          }
        />

        {!organization.accepts_invitations ? (
          <Alert variant="warning" appearance="light" role="status">
            <AlertIcon>
              <TriangleAlert aria-hidden="true" />
            </AlertIcon>
            <AlertContent>
              <AlertTitle>Convites indisponíveis</AlertTitle>
              <AlertDescription>
                Organizações rejeitadas ou arquivadas não recebem convites. Quem já está na equipe
                continua listado abaixo.
              </AlertDescription>
            </AlertContent>
          </Alert>
        ) : null}

        {!canInvite && !canManageAnyone && organization.accepts_invitations ? (
          <Alert variant="info" appearance="light" role="status">
            <AlertIcon>
              <ShieldCheck aria-hidden="true" />
            </AlertIcon>
            <AlertContent>
              <AlertTitle>Você pode ver a equipe, mas não alterá-la</AlertTitle>
              <AlertDescription>
                Convites e mudanças de papel ficam com proprietários e administradores da
                organização.
              </AlertDescription>
            </AlertContent>
          </Alert>
        ) : null}

        <section aria-labelledby="team-members-title" className="space-y-3">
          <h2 id="team-members-title" className="font-display text-xl font-bold tracking-[-0.02em]">
            Pessoas
          </h2>

          <ul className="divide-y divide-border-subtle overflow-hidden rounded-card border border-border-subtle bg-card">
            {members.map((member) => (
              <li
                key={member.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span
                    aria-hidden="true"
                    className={cn(
                      'flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-extrabold',
                      member.status === 'active'
                        ? 'bg-primary-soft text-primary-accent'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {initialsOf(member.user.full_name)}
                  </span>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="truncate font-display font-bold">
                        {member.user.full_name}
                      </span>
                      {member.is_self ? (
                        <Badge variant="neutral" appearance="light" shape="pill" size="md">
                          Você
                        </Badge>
                      ) : null}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">{member.user.email}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {member.status === 'suspended' && member.suspended_at
                        ? `Suspenso em ${formatDate(member.suspended_at)}`
                        : member.joined_at
                          ? `Na equipe desde ${formatDate(member.joined_at)}`
                          : null}
                      {member.is_last_owner ? ' · Único proprietário ativo' : null}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 ps-[3.25rem] sm:ps-0">
                  <Badge
                    variant={member.role === 'owner' ? 'primary' : 'secondary'}
                    appearance="light"
                    shape="pill"
                    size="lg"
                  >
                    {organizationRoleLabel(member.role)}
                  </Badge>
                  {member.status === 'suspended' ? (
                    <Badge variant="warning" appearance="light" shape="pill" size="lg">
                      {organizationMemberStatusLabel(member.status)}
                    </Badge>
                  ) : null}

                  {member.actions.reactivate ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="md"
                      shape="pill"
                      disabled={busy}
                      aria-label={`Reativar o acesso de ${member.user.full_name}`}
                      onClick={() => reactivate(member)}
                    >
                      {processing === `reactivate-${member.id}` ? (
                        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                      ) : (
                        <RotateCcw aria-hidden="true" className="size-4" />
                      )}
                      Reativar
                    </Button>
                  ) : null}

                  {member.actions.roles.length > 0 ||
                  member.actions.suspend ||
                  member.actions.remove ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="md"
                          shape="pill"
                          disabled={busy}
                          aria-label={`Gerenciar ${member.user.full_name}`}
                        >
                          <MoreHorizontal aria-hidden="true" className="size-4" />
                          Gerenciar
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {member.actions.roles.length > 0 ? (
                          <DropdownMenuItem onSelect={() => openRoleDialog(member)}>
                            <UserRoundCog aria-hidden="true" className="size-4" />
                            Alterar papel
                          </DropdownMenuItem>
                        ) : null}
                        {member.actions.suspend ? (
                          <DropdownMenuItem
                            onSelect={() => setConfirmation({ kind: 'suspend', member })}
                          >
                            <UserRoundX aria-hidden="true" className="size-4" />
                            Suspender acesso
                          </DropdownMenuItem>
                        ) : null}
                        {member.actions.remove ? (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => setConfirmation({ kind: 'remove', member })}
                            >
                              <UserMinus aria-hidden="true" className="size-4" />
                              Remover da equipe
                            </DropdownMenuItem>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="team-invitations-title" className="space-y-3">
          <div>
            <h2
              id="team-invitations-title"
              className="font-display text-xl font-bold tracking-[-0.02em]"
            >
              Convites pendentes
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              O convite só pode ser aceito por uma conta com o mesmo e-mail. Reenviar gera um link
              novo e invalida o anterior.
            </p>
          </div>

          {invitations.length === 0 ? (
            <div className="rounded-card border border-dashed border-border bg-card">
              <EmptyState
                icon={Mail}
                headingLevel={3}
                title="Nenhum convite pendente"
                description={
                  canInvite
                    ? 'Convide alguém para dividir o trabalho: cada papel libera só o que a pessoa precisa.'
                    : 'Quando alguém for convidado, o convite aparece aqui até ser aceito.'
                }
              >
                {canInvite ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    shape="pill"
                    onClick={openInvite}
                  >
                    <UserPlus aria-hidden="true" className="size-4" />
                    Convidar pessoa
                  </Button>
                ) : null}
              </EmptyState>
            </div>
          ) : (
            <ul className="divide-y divide-border-subtle overflow-hidden rounded-card border border-border-subtle bg-card">
              {invitations.map((invitation) => (
                <li
                  key={invitation.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
                    >
                      <Mail className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-display font-bold">{invitation.email}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                        <Clock3 aria-hidden="true" className="size-3.5" />
                        {invitation.state === 'expired'
                          ? `Expirou em ${formatDateTime(invitation.expires_at)}`
                          : `Vale até ${formatDateTime(invitation.expires_at)}`}
                        {invitation.invited_by ? ` · Convidado por ${invitation.invited_by}` : null}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 ps-[3.25rem] sm:ps-0">
                    <Badge variant="secondary" appearance="light" shape="pill" size="lg">
                      {organizationRoleLabel(invitation.role)}
                    </Badge>
                    <Badge
                      variant={invitation.state === 'expired' ? 'warning' : 'info'}
                      appearance="light"
                      shape="pill"
                      size="lg"
                    >
                      {invitation.state === 'expired' ? 'Expirado' : 'Aguardando aceite'}
                    </Badge>
                    {invitation.actions.resend ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="md"
                        shape="pill"
                        disabled={busy}
                        aria-label={`Reenviar convite para ${invitation.email}`}
                        onClick={() => resend(invitation)}
                      >
                        {processing === `resend-${invitation.id}` ? (
                          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                        ) : (
                          <Send aria-hidden="true" className="size-4" />
                        )}
                        Reenviar
                      </Button>
                    ) : null}
                    {invitation.actions.cancel ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="md"
                        shape="pill"
                        disabled={busy}
                        aria-label={`Cancelar convite para ${invitation.email}`}
                        onClick={() => setConfirmation({ kind: 'cancel', invitation })}
                      >
                        Cancelar
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          aria-labelledby="team-roles-title"
          className="rounded-card border border-border-subtle bg-card p-5 sm:p-6"
        >
          <h2
            id="team-roles-title"
            className="flex items-center gap-2 font-display text-lg font-bold tracking-[-0.01em]"
          >
            <UsersRound aria-hidden="true" className="size-5 text-primary" />O que cada papel pode
            fazer
          </h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            {ROLE_ORDER.map((role) => (
              <div key={role}>
                <dt className="font-semibold">{organizationRoleLabel(role)}</dt>
                <dd className="mt-0.5 text-sm leading-6 text-muted-foreground">
                  {ORGANIZATION_ROLE_DESCRIPTIONS[role]}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm text-muted-foreground">
            Administradores convidam e gerenciam apenas editores e analistas. A organização sempre
            mantém pelo menos um proprietário ativo.
          </p>
        </section>
      </div>

      <Dialog
        open={inviteOpen}
        onOpenChange={(open) => {
          if (!invite.processing) setInviteOpen(open)
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="pe-10 leading-snug">
              Convidar para {organization.trade_name}
            </DialogTitle>
            <DialogDescription>
              Enviamos um link por e-mail, válido por alguns dias. A pessoa entra ou cria a conta
              com esse mesmo e-mail para aceitar.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={submitInvite}
            className="flex flex-col gap-5"
            aria-busy={invite.processing}
          >
            <Field
              label="E-mail"
              name="email"
              type="email"
              required
              autoComplete="off"
              maxLength={254}
              placeholder="pessoa@exemplo.com"
              value={invite.data.email}
              onChange={(event) => invite.setData('email', event.target.value)}
              error={invite.errors.email}
              disabled={invite.processing}
            />
            <OrganizationRolePicker
              legend="Papel na organização"
              roles={inviteRoles}
              value={invite.data.role}
              onChange={(role) => invite.setData('role', role)}
              disabled={invite.processing}
              error={invite.errors.role}
            />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                size="lg"
                shape="pill"
                disabled={invite.processing}
                onClick={() => setInviteOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="lg"
                shape="pill"
                disabled={invite.processing || !invite.data.email.trim() || !invite.data.role}
              >
                {invite.processing ? (
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                ) : (
                  <Send aria-hidden="true" className="size-4" />
                )}
                {invite.processing ? 'Enviando…' : 'Enviar convite'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={roleTarget !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setRoleTarget(null)
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
          {roleTarget ? (
            <>
              <DialogHeader>
                <DialogTitle className="pe-10 leading-snug">
                  Alterar o papel de {roleTarget.user.full_name}
                </DialogTitle>
                <DialogDescription>
                  Papel atual: {organizationRoleLabel(roleTarget.role)}. A mudança vale
                  imediatamente.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={submitRole} className="flex flex-col gap-5" aria-busy={busy}>
                <OrganizationRolePicker
                  legend="Novo papel"
                  roles={roleTarget.actions.roles}
                  value={nextRole}
                  onChange={setNextRole}
                  disabled={busy}
                />
                {nextRole === 'owner' ? (
                  <Alert variant="warning" appearance="light" role="status">
                    <AlertIcon>
                      <TriangleAlert aria-hidden="true" />
                    </AlertIcon>
                    <AlertDescription>
                      Proprietários têm controle total da organização, inclusive sobre outros
                      proprietários.
                    </AlertDescription>
                  </Alert>
                ) : null}
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="lg"
                    shape="pill"
                    disabled={busy}
                    onClick={() => setRoleTarget(null)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" size="lg" shape="pill" disabled={busy || !nextRole}>
                    {busy ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
                    Salvar papel
                  </Button>
                </div>
              </form>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {confirmationCopy ? (
        <ConfirmDialog
          open={confirmation !== null}
          onOpenChange={(open) => {
            if (!open && !busy) setConfirmation(null)
          }}
          title={confirmationCopy.title}
          description={confirmationCopy.description}
          confirmLabel={confirmationCopy.confirmLabel}
          cancelLabel="Voltar"
          destructive
          processing={busy}
          onConfirm={confirmPending}
        />
      ) : null}
    </MainLayout>
  )
}
