import { Head, Link } from '@inertiajs/react'
import { KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react'

import { ForgotPasswordForm } from '~/components/auth'
import { useApp } from '~/hooks/use_app'
import { AuthSplitLayout } from '~/layouts/auth/auth_split_layout'

export default function ForgotPasswordPage() {
  const application = useApp()

  return (
    <>
      <Head title="Recuperar senha">
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <AuthSplitLayout
        title="Esqueceu sua senha?"
        subtitle="Informe o e-mail da conta. A resposta preserva sua privacidade mesmo quando o cadastro não existe."
        formEyebrow="Recuperação de acesso"
        panelTitle={`Recupere o acesso ao ${application.name}`}
        panelDescription="O link de redefinição é temporário e de uso único. Sua conta permanece protegida durante todo o processo."
        features={[
          {
            title: 'Privacidade preservada',
            description: 'A resposta não revela se o e-mail está cadastrado',
            icon: ShieldCheck,
          },
          {
            title: 'Link de uso único',
            description: 'Cada nova solicitação invalida os links anteriores',
            icon: KeyRound,
          },
          {
            title: 'Sessões protegidas',
            description: 'Após redefinir a senha, os acessos antigos são revogados',
            icon: LockKeyhole,
          },
        ]}
        footer={
          <Link href="/login" className="font-medium text-primary hover:underline">
            Voltar para o login
          </Link>
        }
      >
        <ForgotPasswordForm />
      </AuthSplitLayout>
    </>
  )
}
