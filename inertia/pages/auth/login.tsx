import { Head, Link } from '@inertiajs/react'
import { ClipboardCheck, MapPin, Store } from 'lucide-react'

import { LoginForm } from '~/components/auth'
import { useApp } from '~/hooks/use_app'
import { AuthSplitLayout } from '~/layouts/auth/auth_split_layout'

interface LoginPageProps {
  errors?: Record<string, string>
}

export default function LoginPage({ errors }: LoginPageProps) {
  const application = useApp()

  return (
    <>
      <Head title="Entrar">
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <AuthSplitLayout
        title="Entrar"
        subtitle="Acesse o Portal para gerenciar organizações, unidades e publicações."
        formEyebrow="Portal do parceiro"
        panelTitle={`Bem-vindo de volta ao ${application.name}`}
        panelDescription="Gerencie suas organizações e unidades, acompanhe a moderação e mantenha sua presença no catálogo sempre atualizada."
        features={[
          {
            title: 'Portal do parceiro',
            description: 'Organize empresas e unidades em um só lugar',
            icon: Store,
          },
          {
            title: 'Fichas com qualidade',
            description: 'Acompanhe a completude e envie para moderação',
            icon: ClipboardCheck,
          },
          {
            title: 'Presença regional',
            description: 'Apareça para quem explora a sua cidade',
            icon: MapPin,
          },
        ]}
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
