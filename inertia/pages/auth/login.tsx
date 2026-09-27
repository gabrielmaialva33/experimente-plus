import { Head, Link } from '@inertiajs/react'

import { LoginForm } from '~/components/auth'
import { AuthSplitLayout } from '~/layouts/auth/auth_split_layout'

const DEFAULT_SUBTITLE =
  'Acesse sua carteira e, quando tiver uma organização, o Portal do parceiro.'

/** Why the person is signing in, for each page that sends them here and back. */
const RETURN_SUBTITLES: Record<string, string> = {
  '/organization-invitations/accept':
    'Entre com o e-mail que recebeu o convite. Depois você volta para aceitá-lo.',
  '/verificar-email':
    'Entre para confirmar seu e-mail ou pedir um novo link. Depois você volta para a confirmação.',
}

interface LoginPageProps {
  errors?: Record<string, string>
  next?: string | null
}

export default function LoginPage({ errors, next = null }: LoginPageProps) {
  const returnQuery = next ? `?next=${encodeURIComponent(next)}` : ''

  return (
    <>
      <Head title="Entrar">
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <AuthSplitLayout
        title="Entrar"
        subtitle={RETURN_SUBTITLES[next ?? ''] ?? DEFAULT_SUBTITLE}
        contextTitle="O catálogo não exige login"
        contextDescription="Você pode explorar cidades, categorias e lugares antes de criar uma conta."
        footer={
          <>
            <span className="text-muted-foreground">Ainda não tem conta? </span>
            <Link
              href={`/register${returnQuery}`}
              className="inline-flex min-h-11 items-center font-medium text-primary hover:underline"
            >
              Criar conta
            </Link>
          </>
        }
      >
        <LoginForm errors={errors} next={next} />
      </AuthSplitLayout>
    </>
  )
}
