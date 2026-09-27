import { Link, useForm } from '@inertiajs/react'
import { Loader2, Mail } from 'lucide-react'
import type { FormEvent } from 'react'

import { PasswordField } from '~/components/auth/password_field'
import { Field } from '~/components/forms/field'
import { Alert, AlertContent, AlertDescription } from '~/components/ui/alert'
import { Button } from '~/components/ui/button'

interface LoginFormProps {
  errors?: Record<string, string>
}

export function LoginForm({ errors: serverErrors }: LoginFormProps = {}) {
  const { data, setData, post, processing, errors, reset } = useForm({
    uid: '',
    password: '',
  })

  const generalError = serverErrors?.general

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    // W44: a failed attempt never leaves the password behind in the field. The
    // identifier stays, so the next try is only the part that was wrong.
    post('/login', { onError: () => reset('password') })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-label="Entrar" aria-busy={processing}>
      {generalError ? (
        <Alert variant="destructive" appearance="light">
          <AlertContent>
            <AlertDescription>{generalError}</AlertDescription>
          </AlertContent>
        </Alert>
      ) : null}

      <Field
        label="E-mail ou usuário"
        id="uid"
        type="text"
        name="uid"
        value={data.uid}
        onChange={(event) => setData('uid', event.target.value)}
        error={errors.uid}
        placeholder="voce@exemplo.com"
        required
        autoComplete="username"
        leftIcon={<Mail className="size-4" />}
      />

      <PasswordField
        label="Senha"
        id="password"
        name="password"
        value={data.password}
        onChange={(event) => setData('password', event.target.value)}
        error={errors.password}
        labelAction={
          <Link
            href="/forgot-password"
            className="-my-3 inline-flex min-h-11 items-center rounded-full text-[0.8125rem] font-semibold text-primary-accent underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            Esqueceu a senha?
          </Link>
        }
        required
        autoComplete="current-password"
      />

      <Button
        type="submit"
        variant="primary"
        size="xl"
        shape="pill"
        disabled={processing}
        className="w-full"
      >
        {processing ? <Loader2 className="size-4 animate-spin" /> : null}
        <span aria-live="polite">{processing ? 'Entrando...' : 'Entrar'}</span>
      </Button>
    </form>
  )
}

export default LoginForm
