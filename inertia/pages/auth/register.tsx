import { Head, Link } from '@inertiajs/react'

import { RegisterForm } from '~/components/auth'
import { AuthSplitLayout } from '~/layouts/auth/auth_split_layout'

interface RegisterPageProps {
  errors?: Record<string, string>
}

export default function RegisterPage({ errors }: RegisterPageProps) {
  return (
    <>
      <Head title="Criar conta">
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <AuthSplitLayout
        title="Criar conta"
        subtitle="Crie seu acesso pessoal. Organizações e unidades são configuradas separadamente depois."
        contentWidth="wide"
        contextTitle="Uma conta, usos diferentes"
        contextDescription="A conta começa como acesso pessoal. O Portal é liberado pelas relações reais com organizações, sem escolher um papel global no cadastro."
        footer={
          <>
            <span className="text-muted-foreground">Já tem uma conta? </span>
            <Link href="/login" className="font-medium text-primary hover:underline">
              Entrar
            </Link>
          </>
        }
      >
        <RegisterForm errors={errors} />
      </AuthSplitLayout>
    </>
  )
}
