import { Head, Link } from '@inertiajs/react'
import { KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react'

import { ResetPasswordForm } from '~/components/auth'
import { useApp } from '~/hooks/use_app'
import { AuthSplitLayout } from '~/layouts/auth/auth_split_layout'

interface ResetPasswordPageProps {
  token: string
}

export default function ResetPasswordPage({ token }: ResetPasswordPageProps) {
  const application = useApp()

  return (
    <>
      <Head title="Redefinir senha">
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <AuthSplitLayout
        title="Escolha uma nova senha"
        subtitle="Defina uma senha com pelo menos 8 caracteres e confirme o mesmo valor."
        formEyebrow="Segurança da conta"
        panelTitle={`Proteja sua conta no ${application.name}`}
        panelDescription="Depois da redefinição, o link deixa de funcionar e os dispositivos conectados precisam entrar novamente."
        features={[
          {
            title: 'Link de uso único',
            description: 'Este link não pode ser reutilizado após a troca',
            icon: KeyRound,
          },
          {
            title: 'Sessões encerradas',
            description: 'Os acessos ativos são desconectados automaticamente',
            icon: LockKeyhole,
          },
          {
            title: 'Senha protegida',
            description: 'Sua senha é armazenada de forma criptografada',
            icon: ShieldCheck,
          },
        ]}
        footer={
          <Link href="/login" className="font-medium text-primary hover:underline">
            Voltar para o login
          </Link>
        }
      >
        <ResetPasswordForm token={token} />
      </AuthSplitLayout>
    </>
  )
}
