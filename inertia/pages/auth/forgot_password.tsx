import { Head, Link } from '@inertiajs/react'

import { ForgotPasswordForm } from '~/components/auth'
import { AuthSplitLayout } from '~/layouts/auth/auth_split_layout'

export default function ForgotPasswordPage() {
  return (
    <>
      <Head title="Recuperar senha">
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <AuthSplitLayout
        title="Esqueceu sua senha?"
        subtitle="Informe o e-mail da conta. A resposta preserva sua privacidade mesmo quando o cadastro não existe."
        contextTitle="Recuperação protegida"
        contextDescription="O link é temporário e de uso único. Uma nova solicitação invalida links anteriores."
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
