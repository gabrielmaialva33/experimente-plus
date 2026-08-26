import { useForm } from '@inertiajs/react'
import { AtSign, Loader2, Mail, UserRound } from 'lucide-react'
import type { FormEvent } from 'react'

import { PasswordField } from '~/components/auth/password_field'
import { PasswordRequirements } from '~/components/auth/password_requirements'
import { Field } from '~/components/forms/field'
import { Alert, AlertContent, AlertDescription } from '~/components/ui/alert'
import { Button } from '~/components/ui/button'

interface RegisterFormProps {
  errors?: Record<string, string>
}

export function RegisterForm({ errors: serverErrors }: RegisterFormProps = {}) {
  const { data, setData, post, processing, errors } = useForm({
    full_name: '',
    email: '',
    username: '',
    password: '',
    password_confirmation: '',
  })

  const generalError = serverErrors?.general

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    post('/register')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {generalError ? (
        <Alert variant="destructive" appearance="light">
          <AlertContent>
            <AlertDescription>{generalError}</AlertDescription>
          </AlertContent>
        </Alert>
      ) : null}

      <Field
        label="Nome completo"
        id="full_name"
        type="text"
        name="full_name"
        value={data.full_name}
        onChange={(event) => setData('full_name', event.target.value)}
        error={errors.full_name}
        placeholder="Maria da Silva"
        required
        autoFocus
        autoComplete="name"
        leftIcon={<UserRound className="size-4" />}
      />

      <Field
        label="E-mail"
        id="email"
        type="email"
        name="email"
        value={data.email}
        onChange={(event) => setData('email', event.target.value)}
        error={errors.email}
        placeholder="voce@exemplo.com"
        required
        autoComplete="email"
        leftIcon={<Mail className="size-4" />}
      />

      <Field
        label="Usuário"
        id="username"
        type="text"
        name="username"
        value={data.username}
        onChange={(event) => setData('username', event.target.value)}
        error={errors.username}
        placeholder="maria.silva"
        hint="Opcional. Você também poderá entrar usando o e-mail."
        autoComplete="username"
        leftIcon={<AtSign className="size-4" />}
      />

      <PasswordField
        label="Senha"
        id="password"
        name="password"
        value={data.password}
        onChange={(event) => setData('password', event.target.value)}
        error={errors.password}
        required
        autoComplete="new-password"
      />

      <PasswordField
        label="Confirmar senha"
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
        {processing ? 'Criando conta...' : 'Criar conta'}
      </Button>
    </form>
  )
}

export default RegisterForm
