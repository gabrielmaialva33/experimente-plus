import { BaseMail } from '@adonisjs/mail'
import type { DateTime } from 'luxon'

import type User from '#modules/users/models/user'
import env from '#start/env'

export default class PasswordResetNotification extends BaseMail {
  subject = 'Redefina sua senha'

  constructor(
    private user: User,
    private token: string,
    private expiresAt: DateTime
  ) {
    super()
  }

  getResetToken() {
    return this.token
  }

  prepare() {
    const appName = env.get('MAIL_FROM_NAME', env.get('APP_NAME', 'Experimente+'))
    const resetUrl = `${env.get('APP_URL', 'http://localhost:3333')}/reset-password?token=${encodeURIComponent(this.token)}`
    const expiresInMinutes = Math.max(1, Math.ceil(this.expiresAt.diffNow('minutes').minutes))

    this.message.from(env.get('MAIL_FROM_ADDRESS', 'noreply@example.com'), appName)
    this.message.to(this.user.email, this.user.full_name)

    if (env.get('NODE_ENV') === 'test') {
      this.message.html(`
        <h1>Redefina sua senha</h1>
        <p>Olá, ${this.user.full_name}.</p>
        <p>Use o link abaixo para escolher uma nova senha:</p>
        <p><a href="${resetUrl}">Redefinir senha</a></p>
        <p>Este link expira em ${expiresInMinutes} minutos.</p>
      `)
    } else {
      this.message.htmlView('emails/password_reset_html', {
        user: this.user,
        resetUrl,
        appName,
        expiresInMinutes,
      })
    }

    this.message.text(`
      Redefina sua senha

      Olá, ${this.user.full_name}.

      Recebemos uma solicitação para redefinir a senha da sua conta no ${appName}.

      Abra o endereço abaixo para escolher uma nova senha:
      ${resetUrl}

      O link expira em ${expiresInMinutes} minutos e pode ser utilizado apenas uma vez.

      Se você não solicitou a alteração, ignore esta mensagem.

      Equipe ${appName}
    `)
  }
}
