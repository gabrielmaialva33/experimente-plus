import { Head, Link } from '@inertiajs/react'
import { Compass, Store, Users } from 'lucide-react'

import { RegisterForm } from '~/components/auth'
import { useApp } from '~/hooks/use_app'
import { AuthSplitLayout } from '~/layouts/auth/auth_split_layout'

interface RegisterPageProps {
  errors?: Record<string, string>
}

export default function RegisterPage({ errors }: RegisterPageProps) {
  const application = useApp()

  return (
    <>
      <Head title="Criar conta">
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <AuthSplitLayout
        title="Criar conta"
        subtitle="Crie seu acesso pessoal. A organização e as unidades serão configuradas depois."
        formEyebrow="Comece pelo seu acesso"
        contentWidth="wide"
        panelTitle={`Faça parte do ${application.name}`}
        panelDescription="Divulgue seus estabelecimentos, receba retorno da moderação e acompanhe o interesse do público da sua região."
        features={[
          {
            title: 'Cadastro simples',
            description: 'Crie a organização e as unidades no seu ritmo',
            icon: Store,
          },
          {
            title: 'Feito para a região',
            description: 'Descoberta por cidade e categoria, sem intermediários',
            icon: Compass,
          },
          {
            title: 'Você no controle',
            description: 'Convide sua equipe e defina quem edita cada ficha',
            icon: Users,
          },
        ]}
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
