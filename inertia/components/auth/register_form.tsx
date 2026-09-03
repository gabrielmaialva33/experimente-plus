import { Link, useForm } from '@inertiajs/react'
import { AtSign, Loader2, Mail, UserRound } from 'lucide-react'
import type { FormEvent } from 'react'

import { PasswordField } from '~/components/auth/password_field'
import { PasswordRequirements } from '~/components/auth/password_requirements'
import { Field } from '~/components/forms/field'
import { Alert, AlertContent, AlertDescription } from '~/components/ui/alert'
import { Button } from '~/components/ui/button'
import { Checkbox } from '~/components/ui/checkbox'

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
    terms_accepted: false,
  })

  const generalError = serverErrors?.general

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    post('/register')
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4"
      aria-label="Criar conta"
      aria-busy={processing}
    >
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

      <div className="space-y-2" data-invalid={errors.terms_accepted ? 'true' : undefined}>
        <div className="flex items-start gap-3 rounded-md border bg-muted/35 p-3">
          <Checkbox
            id="terms_accepted"
            name="terms_accepted"
            required
            aria-required="true"
            checked={data.terms_accepted}
            onCheckedChange={(checked) => setData('terms_accepted', checked === true)}
            aria-labelledby="terms-accepted-label"
            aria-describedby={
              errors.terms_accepted ? 'terms-accepted-error' : 'terms-accepted-help'
            }
            aria-invalid={!!errors.terms_accepted}
          />
          <div className="min-w-0">
            <label
              id="terms-accepted-label"
              htmlFor="terms_accepted"
              className="cursor-pointer text-sm font-medium leading-5"
            >
              Li e aceito os documentos obrigatórios
            </label>
            <p id="terms-accepted-help" className="mt-1 text-xs leading-5 text-muted-foreground">
              Confira os{' '}
              <Link href="/termos" className="font-medium text-primary hover:underline">
                Termos de Uso
              </Link>{' '}
              e a{' '}
              <Link href="/privacidade" className="font-medium text-primary hover:underline">
                Política de Privacidade
              </Link>
              .
            </p>
          </div>
        </div>
        {errors.terms_accepted ? (
          <p id="terms-accepted-error" role="alert" className="text-xs text-destructive">
            {errors.terms_accepted}
          </p>
        ) : null}
      </div>

      <Button
        type="submit"
        variant="primary"
        disabled={processing || !data.terms_accepted}
        className="w-full"
        size="lg"
      >
        {processing ? <Loader2 className="size-4 animate-spin" /> : null}
        <span aria-live="polite">{processing ? 'Criando conta...' : 'Criar conta'}</span>
      </Button>
    </form>
  )
}

export default RegisterForm
