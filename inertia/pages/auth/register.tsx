import { Head, Link } from '@inertiajs/react'

import { RegisterForm } from '~/components/auth'
import { AuthSplitLayout } from '~/layouts/auth/auth_split_layout'

interface RegisterPageProps {
  errors?: Record<string, string>
  next?: string | null
  /** The invitation opened in this browser, while it can still be accepted. */
  invitation?: { email: string; organization_name: string } | null
}

export default function RegisterPage({
  errors,
  next = null,
  invitation = null,
}: RegisterPageProps) {
  const returnQuery = next ? `?next=${encodeURIComponent(next)}` : ''

  return (
    <>
      <Head title="Criar conta">
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <AuthSplitLayout
        title="Criar conta"
        subtitle={
          invitation
            ? `Crie sua conta para entrar na equipe de ${invitation.organization_name}. Depois você volta para aceitar o convite.`
            : 'Crie seu acesso pessoal. Organizações e unidades são configuradas separadamente depois.'
        }
        contentWidth="wide"
        contextTitle="Uma conta, usos diferentes"
        contextDescription="A conta começa como acesso pessoal. O Portal do parceiro aparece quando você cadastra uma organização ou é convidado por uma — não é preciso escolher um perfil agora."
        footer={
          <>
            <span className="text-muted-foreground">Já tem uma conta? </span>
            <Link
              href={`/login${returnQuery}`}
              className="inline-flex min-h-11 items-center font-medium text-primary hover:underline"
            >
              Entrar
            </Link>
          </>
        }
      >
        <RegisterForm errors={errors} next={next} invitedEmail={invitation?.email ?? null} />
      </AuthSplitLayout>
    </>
  )
}
