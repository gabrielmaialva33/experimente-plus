import { Head, Link, router, usePage } from '@inertiajs/react'
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  LogIn,
  MailCheck,
  MailWarning,
  Send,
} from 'lucide-react'
import { useState } from 'react'

import { Alert, AlertContent, AlertDescription } from '~/components/ui/alert'
import { Button } from '~/components/ui/button'
import { AuthSplitLayout } from '~/layouts/auth/auth_split_layout'

const PAGE_PATH = '/verificar-email'

export interface EmailVerificationPageProps {
  outcome: 'confirmed' | 'already_confirmed' | 'expired' | 'invalid' | null
  viewer: { signed_in: boolean; email: string | null; email_verified: boolean | null }
}

type PageState =
  'confirmed' | 'already_confirmed' | 'expired' | 'invalid' | 'pending' | 'signed_out'

function resolveState({ outcome, viewer }: EmailVerificationPageProps): PageState {
  if (outcome) return outcome
  if (!viewer.signed_in) return 'signed_out'
  return viewer.email_verified ? 'already_confirmed' : 'pending'
}

const COPY: Record<PageState, { title: string; subtitle: string }> = {
  confirmed: {
    title: 'E-mail confirmado',
    subtitle: 'Tudo certo. Sua conta está confirmada e pronta para usar.',
  },
  already_confirmed: {
    title: 'E-mail já confirmado',
    subtitle: 'Este endereço já estava confirmado. Não é preciso fazer mais nada.',
  },
  expired: {
    title: 'Link expirado',
    subtitle: 'Os links de confirmação valem por 24 horas. Peça um novo para concluir.',
  },
  invalid: {
    title: 'Link inválido',
    subtitle:
      'Não reconhecemos este link de confirmação. Ele pode já ter sido usado ou substituído por um mais recente.',
  },
  pending: {
    title: 'Confirme seu e-mail',
    subtitle: 'Enviamos um link de confirmação quando você criou a conta. Ele vale por 24 horas.',
  },
  signed_out: {
    title: 'Confirme seu e-mail',
    subtitle: 'Abra o link que enviamos para o seu e-mail para confirmar o endereço.',
  },
}

export default function EmailVerificationPage(props: EmailVerificationPageProps) {
  const { viewer } = props
  const state = resolveState(props)
  const copy = COPY[state]
  const page = usePage().props as {
    flash?: { success?: string | null; error?: string | null }
    errors?: Record<string, string>
  }
  const [sending, setSending] = useState(false)
  const failure = page.flash?.error ?? page.errors?.general ?? null
  const done = state === 'confirmed' || state === 'already_confirmed'
  const canResend = viewer.signed_in && viewer.email_verified === false && !done

  function resend() {
    if (sending) return
    setSending(true)
    router.post(`${PAGE_PATH}/reenviar`, {}, { onFinish: () => setSending(false) })
  }

  const continueButton = viewer.signed_in ? (
    <Button asChild size="xl" shape="pill" className="w-full">
      <Link href="/wallet">
        Ir para a carteira
        <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
    </Button>
  ) : (
    <Button asChild size="xl" shape="pill" className="w-full">
      <Link href="/login">
        <LogIn aria-hidden="true" className="size-4" />
        Entrar
      </Link>
    </Button>
  )

  function body() {
    if (done) {
      return (
        <>
          {viewer.signed_in && viewer.email ? (
            <p className="text-sm leading-6 text-muted-foreground">
              Endereço confirmado:{' '}
              <span className="font-semibold text-foreground">{viewer.email}</span>
            </p>
          ) : null}
          {continueButton}
        </>
      )
    }

    if (canResend) {
      return (
        <>
          <p className="text-sm leading-6 text-muted-foreground">
            O novo link vai para{' '}
            <span className="font-semibold text-foreground">{viewer.email}</span> e substitui os
            anteriores. Confira também a caixa de spam.
          </p>
          <Button
            type="button"
            size="xl"
            shape="pill"
            className="w-full"
            disabled={sending}
            onClick={resend}
          >
            {sending ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Send aria-hidden="true" className="size-4" />
            )}
            {sending ? 'Enviando…' : 'Enviar novo link'}
          </Button>
        </>
      )
    }

    return (
      <>
        <p className="text-sm leading-6 text-muted-foreground">
          {state === 'invalid'
            ? 'Se você já confirmou o e-mail, é só entrar. Se não, entre na sua conta e peça um novo link aqui.'
            : 'Entre na sua conta para pedir um novo link de confirmação. Você volta para esta página.'}
        </p>
        <Button asChild size="xl" shape="pill" className="w-full">
          <Link href={`/login?next=${encodeURIComponent(PAGE_PATH)}`}>
            <LogIn aria-hidden="true" className="size-4" />
            Entrar
          </Link>
        </Button>
      </>
    )
  }

  const Icon = done
    ? CheckCircle2
    : state === 'expired' || state === 'invalid'
      ? MailWarning
      : MailCheck

  return (
    <>
      <Head title={copy.title}>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <AuthSplitLayout title={copy.title} subtitle={copy.subtitle}>
        <div className="flex flex-col gap-5">
          {page.flash?.success ? (
            <Alert variant="success" appearance="light" role="status">
              <AlertContent>
                <AlertDescription>{page.flash.success}</AlertDescription>
              </AlertContent>
            </Alert>
          ) : null}
          {failure ? (
            <Alert variant="destructive" appearance="light">
              <AlertContent>
                <AlertDescription>{failure}</AlertDescription>
              </AlertContent>
            </Alert>
          ) : null}

          <span
            aria-hidden="true"
            className={
              done
                ? 'flex size-12 items-center justify-center rounded-full bg-success-soft text-success-accent'
                : 'flex size-12 items-center justify-center rounded-full bg-content-absent text-content-absent-foreground'
            }
          >
            <Icon className="size-5" />
          </span>

          {body()}
        </div>
      </AuthSplitLayout>
    </>
  )
}
