import { useForm, usePage } from '@inertiajs/react'
import { Loader2 } from 'lucide-react'
import type { FormEvent } from 'react'

import { PasswordField } from '~/components/auth/password_field'
import { PasswordRequirements } from '~/components/auth/password_requirements'
import { Alert, AlertContent, AlertDescription } from '~/components/ui/alert'
import { Button } from '~/components/ui/button'

interface ResetPasswordFormProps {
  token: string
}

interface SharedErrors {
  errors?: Record<string, string>
}

export default function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const { errors: sharedErrors } = usePage().props as SharedErrors
  const { data, setData, post, processing, errors } = useForm({
    token,
    password: '',
    password_confirmation: '',
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    post('/reset-password')
  }

  if (!token) {
    return (
      <Alert variant="destructive" appearance="light">
        <AlertContent>
          <AlertDescription>
            O link de redefinição está incompleto. Solicite um novo link.
          </AlertDescription>
        </AlertContent>
      </Alert>
    )
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-4"
      aria-label="Redefinir senha"
      aria-busy={processing}
    >
      {sharedErrors?.general ? (
        <Alert variant="destructive" appearance="light">
          <AlertContent>
            <AlertDescription>{sharedErrors.general}</AlertDescription>
          </AlertContent>
        </Alert>
      ) : null}

      <PasswordField
        label="Nova senha"
        id="password"
        name="password"
        value={data.password}
        onChange={(event) => setData('password', event.target.value)}
        error={errors.password}
        required
        autoComplete="new-password"
      />

      <PasswordField
        label="Confirmar nova senha"
        id="password_confirmation"
        name="password_confirmation"
        value={data.password_confirmation}
        onChange={(event) => setData('password_confirmation', event.target.value)}
        error={errors.password_confirmation}
        required
        autoComplete="new-password"
      />

      <PasswordRequirements password={data.password} confirmation={data.password_confirmation} />

      <Button type="submit" variant="primary" disabled={processing} className="w-full" size="lg">
        {processing ? <Loader2 className="size-4 animate-spin" /> : null}
        <span aria-live="polite">{processing ? 'Redefinindo...' : 'Redefinir senha'}</span>
      </Button>
    </form>
  )
}
