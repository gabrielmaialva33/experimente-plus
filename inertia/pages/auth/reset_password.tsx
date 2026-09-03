import { Head, Link } from '@inertiajs/react'

import { ResetPasswordForm } from '~/components/auth'
import { AuthSplitLayout } from '~/layouts/auth/auth_split_layout'

interface ResetPasswordPageProps {
  token: string
}

export default function ResetPasswordPage({ token }: ResetPasswordPageProps) {
  return (
    <>
      <Head title="Redefinir senha">
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <AuthSplitLayout
        title="Escolha uma nova senha"
        subtitle="Defina uma senha com pelo menos 8 caracteres e confirme o mesmo valor."
        contextTitle="Depois da redefinição"
        contextDescription="O link deixa de funcionar e as sessões que poderiam ser renovadas são encerradas. Acessos já emitidos ainda podem funcionar por um curto período, até expirarem."
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
