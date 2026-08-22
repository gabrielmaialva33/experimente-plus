import { BaseMail } from '@adonisjs/mail'

import type User from '#modules/users/models/user'
import env from '#start/env'

export default class VerifyEmailNotification extends BaseMail {
  subject = 'Confirme seu endereço de e-mail'

  constructor(
    private user: User,
    private token: string
  ) {
    super()
  }

  getVerificationToken() {
    return this.token
  }

  prepare() {
    const appName = env.get('MAIL_FROM_NAME', env.get('APP_NAME', 'Experimente+'))
    const verificationUrl = `${env.get('APP_URL', 'http://localhost:3333')}/api/v1/verify-email?token=${this.token}`

    this.message.from(env.get('MAIL_FROM_ADDRESS', 'noreply@example.com'), appName)
    this.message.to(this.user.email, this.user.full_name)

    if (env.get('NODE_ENV') === 'test') {
      this.message.html(`
        <h1>Bem-vindo ao ${appName}!</h1>
        <p>Olá, ${this.user.full_name}.</p>
        <p>Confirme seu endereço de e-mail usando o link abaixo:</p>
        <p><a href="${verificationUrl}">Confirmar e-mail</a></p>
        <p>${verificationUrl}</p>
      `)
    } else {
      this.message.htmlView('emails/verify_email_html', {
        user: this.user,
        verificationUrl,
        appName,
      })
    }

    this.message.text(`
      Bem-vindo ao ${appName}!

      Olá, ${this.user.full_name}.

      Confirme seu endereço de e-mail para concluir a criação da sua conta:
      ${verificationUrl}

      O link expira em 24 horas.

      Se você não criou esta conta, ignore esta mensagem.

      Equipe ${appName}
    `)
  }
}
