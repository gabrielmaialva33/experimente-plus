import { Head, Link } from '@inertiajs/react'

import { LoginForm } from '~/components/auth'
import { AuthSplitLayout } from '~/layouts/auth/auth_split_layout'

interface LoginPageProps {
  errors?: Record<string, string>
}

export default function LoginPage({ errors }: LoginPageProps) {
  return (
    <>
      <Head title="Entrar">
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <AuthSplitLayout
        title="Entrar"
        subtitle="Acesse sua carteira e, quando tiver uma organização, o Portal do parceiro."
        contextTitle="O catálogo não exige login"
        contextDescription="Você pode explorar cidades, categorias e estabelecimentos antes de criar uma conta."
        footer={
          <>
            <span className="text-muted-foreground">Ainda não tem conta? </span>
            <Link href="/register" className="font-medium text-primary hover:underline">
              Criar conta
            </Link>
          </>
        }
      >
        <LoginForm errors={errors} />
      </AuthSplitLayout>
    </>
  )
}
