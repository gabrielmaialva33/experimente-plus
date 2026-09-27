import { Head, Link, router, usePage } from '@inertiajs/react'
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Loader2,
  LogIn,
  LogOut,
  MailQuestion,
  UserPlus,
} from 'lucide-react'
import { useState } from 'react'

import { Alert, AlertContent, AlertDescription } from '~/components/ui/alert'
import { Button } from '~/components/ui/button'
import { AuthSplitLayout } from '~/layouts/auth/auth_split_layout'
import { formatDateTime, organizationRoleDescription, organizationRoleLabel } from '~/lib/labels'

const ACCEPT_PATH = '/organization-invitations/accept'
const RETURN_QUERY = `?next=${encodeURIComponent(ACCEPT_PATH)}`

export interface OrganizationInvitationAcceptPageProps {
  state: 'missing' | 'invalid' | 'accepted' | 'revoked' | 'unavailable' | 'expired' | 'open'
  invitation: {
    organization_name: string
    role: string
    inviter_name: string | null
    expires_at: string
    email_hint: string
  } | null
  viewer: {
    signed_in: boolean
    email: string | null
    matches: boolean
    membership: 'active' | 'suspended' | null
    accepted: boolean
  }
  portal_path: string | null
}

interface StateCopy {
  title: string
  subtitle: string
}

function stateCopy({ state, invitation }: OrganizationInvitationAcceptPageProps): StateCopy {
  const organization = invitation?.organization_name ?? 'a organização'
  const inviter = invitation?.inviter_name ?? 'quem convidou você'

  switch (state) {
    case 'open':
      return {
        title: `Convite para ${organization}`,
        subtitle: invitation?.inviter_name
          ? `${invitation.inviter_name} convidou você para a equipe como ${organizationRoleLabel(invitation.role)}.`
          : `Você foi convidado para a equipe como ${organizationRoleLabel(invitation?.role)}.`,
      }
    case 'accepted':
      return {
        title: 'Convite já aceito',
        subtitle: `Este convite para ${organization} já foi usado.`,
      }
    case 'revoked':
      return {
        title: 'Convite cancelado',
        subtitle: `O convite para ${organization} foi cancelado ou substituído por um mais recente.`,
      }
    case 'expired':
      return {
        title: 'Convite expirado',
        subtitle: `Os convites valem por tempo limitado. Peça a ${inviter} para reenviar o convite para ${organization}.`,
      }
    case 'unavailable':
      return {
        title: 'Convite indisponível',
        subtitle: `${organization} não está recebendo novas pessoas na equipe no momento.`,
      }
    case 'invalid':
      return {
        title: 'Link de convite inválido',
        subtitle:
          'Não reconhecemos este link. Ele pode ter sido substituído por um convite mais recente.',
      }
    default:
      return {
        title: 'Nenhum convite aberto',
        subtitle: 'Abra o link do convite que você recebeu por e-mail para continuar.',
      }
  }
}

export default function OrganizationInvitationAcceptPage(
  props: OrganizationInvitationAcceptPageProps
) {
  const { state, invitation, viewer, portal_path: portalPath } = props
  const { flash } = usePage().props as { flash?: { error?: string | null } }
  const [processing, setProcessing] = useState<'accept' | 'switch' | null>(null)
  const copy = stateCopy(props)

  function accept() {
    if (processing) return
    setProcessing('accept')
    router.post(ACCEPT_PATH, {}, { onFinish: () => setProcessing(null) })
  }

  function switchAccount() {
    if (processing) return
    setProcessing('switch')
    router.post('/logout', { next: ACCEPT_PATH }, { onFinish: () => setProcessing(null) })
  }

  const portalLink = portalPath ? (
    <Button asChild size="xl" shape="pill" className="w-full">
      <Link href={portalPath}>
        Ir para a organização
        <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
    </Button>
  ) : null

  function body() {
    if (state === 'open' && invitation) {
      if (!viewer.signed_in) {
        return (
          <>
            <p className="text-sm leading-6 text-muted-foreground">
              Para aceitar, entre ou crie uma conta com o e-mail convidado,{' '}
              <span className="font-semibold text-foreground">{invitation.email_hint}</span>. Depois
              você volta direto para esta página.
            </p>
            <div className="flex flex-col gap-2">
              <Button asChild size="xl" shape="pill" className="w-full">
                <Link href={`/login${RETURN_QUERY}`}>
                  <LogIn aria-hidden="true" className="size-4" />
                  Entrar para aceitar
                </Link>
              </Button>
              <Button asChild variant="outline" size="xl" shape="pill" className="w-full">
                <Link href={`/register${RETURN_QUERY}`}>
                  <UserPlus aria-hidden="true" className="size-4" />
                  Criar conta
                </Link>
              </Button>
            </div>
          </>
        )
      }

      if (!viewer.matches) {
        return (
          <>
            <p className="text-sm leading-6 text-muted-foreground">
              Este convite foi enviado para{' '}
              <span className="font-semibold text-foreground">{invitation.email_hint}</span>, mas
              você entrou como <span className="font-semibold text-foreground">{viewer.email}</span>
              . Entre com o e-mail convidado para aceitar; se ele ainda não tem conta, crie uma.
            </p>
            <Button
              type="button"
              size="xl"
              shape="pill"
              className="w-full"
              disabled={processing !== null}
              onClick={switchAccount}
            >
              {processing === 'switch' ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <LogOut aria-hidden="true" className="size-4" />
              )}
              Sair e entrar com outra conta
            </Button>
          </>
        )
      }

      if (viewer.membership === 'active') {
        return (
          <>
            <p className="text-sm leading-6 text-muted-foreground">
              Você já faz parte desta equipe. Para mudar de papel, fale com um proprietário ou
              administrador da organização.
            </p>
            {portalLink}
          </>
        )
      }

      if (viewer.membership === 'suspended') {
        return (
          <p className="text-sm leading-6 text-muted-foreground">
            Seu acesso a esta organização está suspenso, e um convite não o reativa. Peça a um
            proprietário ou administrador para reativar seu acesso na página Equipe.
          </p>
        )
      }

      return (
        <>
          <p className="text-sm leading-6 text-muted-foreground">
            Você entrou como <span className="font-semibold text-foreground">{viewer.email}</span>.
            Ao aceitar, a organização aparece no seu Portal do parceiro.
          </p>
          <Button
            type="button"
            size="xl"
            shape="pill"
            className="w-full"
            disabled={processing !== null}
            onClick={accept}
          >
            {processing === 'accept' ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <CheckCircle2 aria-hidden="true" className="size-4" />
            )}
            {processing === 'accept' ? 'Aceitando…' : 'Aceitar convite'}
          </Button>
        </>
      )
    }

    if (state === 'accepted' && portalPath) {
      return (
        <>
          <p className="text-sm leading-6 text-muted-foreground">
            {viewer.accepted
              ? 'Você aceitou este convite e já faz parte da equipe.'
              : 'Você já faz parte desta equipe.'}
          </p>
          {portalLink}
        </>
      )
    }

    if (state === 'accepted' && !viewer.signed_in) {
      return (
        <>
          <p className="text-sm leading-6 text-muted-foreground">
            Se foi você quem aceitou, entre com o e-mail convidado para continuar no Portal do
            parceiro.
          </p>
          <Button asChild size="xl" shape="pill" className="w-full">
            <Link href="/login">
              <LogIn aria-hidden="true" className="size-4" />
              Entrar
            </Link>
          </Button>
        </>
      )
    }

    const guidance =
      state === 'missing'
        ? 'O link fica no e-mail “Convite para participar de…”. Se ele não chegou, confira o spam ou peça um novo convite.'
        : state === 'accepted'
          ? 'Este convite foi aceito por outra conta. Se você também precisa de acesso, peça um novo convite a quem administra a equipe.'
          : 'Peça um novo convite a quem administra a equipe da organização. O link novo chega por e-mail e substitui os anteriores.'

    return (
      <>
        <p className="text-sm leading-6 text-muted-foreground">{guidance}</p>
        <Button asChild variant="outline" size="xl" shape="pill" className="w-full">
          <Link href={viewer.signed_in ? '/' : '/cidades'}>
            {viewer.signed_in ? 'Voltar ao início' : 'Explorar o catálogo'}
          </Link>
        </Button>
      </>
    )
  }

  return (
    <>
      <Head title={copy.title}>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <AuthSplitLayout
        title={copy.title}
        subtitle={copy.subtitle}
        contextTitle={state === 'open' ? 'Um convite, um e-mail' : undefined}
        contextDescription={
          state === 'open'
            ? 'O convite só pode ser aceito pela conta com o e-mail convidado. O papel define o que você poderá fazer no Portal, e pode ser alterado depois pela organização.'
            : undefined
        }
      >
        <div className="flex flex-col gap-5">
          {flash?.error ? (
            <Alert variant="destructive" appearance="light">
              <AlertContent>
                <AlertDescription>{flash.error}</AlertDescription>
              </AlertContent>
            </Alert>
          ) : null}

          {invitation && state === 'open' ? (
            <div className="rounded-2xl border border-border-subtle bg-background p-4">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
                Seu papel
              </p>
              <p className="mt-1 font-display text-lg font-extrabold">
                {organizationRoleLabel(invitation.role)}
              </p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {organizationRoleDescription(invitation.role)}
              </p>
              <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock3 aria-hidden="true" className="size-3.5 shrink-0" />
                Vale até {formatDateTime(invitation.expires_at)}
              </p>
            </div>
          ) : null}

          {state === 'accepted' && portalPath ? (
            <span
              aria-hidden="true"
              className="flex size-12 items-center justify-center rounded-full bg-success-soft text-success-accent"
            >
              <CheckCircle2 className="size-5" />
            </span>
          ) : state !== 'open' ? (
            <span
              aria-hidden="true"
              className="flex size-12 items-center justify-center rounded-full bg-content-absent text-content-absent-foreground"
            >
              <MailQuestion className="size-5" />
            </span>
          ) : null}

          {body()}
        </div>
      </AuthSplitLayout>
    </>
  )
}
