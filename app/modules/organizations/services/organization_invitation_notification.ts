import { BaseMail } from '@adonisjs/mail'
import type { DateTime } from 'luxon'

import type IOrganization from '#modules/organizations/interfaces/organization_interface'
import env from '#start/env'

export default class OrganizationInvitationNotification extends BaseMail {
  subject: string

  constructor(
    private recipientEmail: string,
    private organizationName: string,
    private inviterName: string,
    private role: IOrganization.Role,
    private token: string,
    private expiresAt: DateTime
  ) {
    super()
    this.subject = `Convite para participar de ${organizationName}`
  }

  getInvitationToken(): string {
    return this.token
  }

  prepare() {
    const appName = env.get('MAIL_FROM_NAME', env.get('APP_NAME', 'Experimente+'))
    const invitationUrl = `${env.get('APP_URL', 'http://localhost:3333')}/organization-invitations/accept?token=${encodeURIComponent(this.token)}`
    const expiration = this.expiresAt.toLocaleString({ dateStyle: 'long', timeStyle: 'short' })

    this.message.from(env.get('MAIL_FROM_ADDRESS', 'noreply@example.com'), appName)
    this.message.to(this.recipientEmail)

    if (env.get('NODE_ENV') === 'test') {
      this.message.html(`
        <h1>Convite para ${this.organizationName}</h1>
        <p>${this.inviterName} convidou você como ${this.role}.</p>
        <p><a href="${invitationUrl}">Aceitar convite</a></p>
        <p>${invitationUrl}</p>
        <p>Expira em ${expiration}.</p>
      `)
    } else {
      this.message.html(`
        <h1>Convite para ${this.organizationName}</h1>
        <p>${this.inviterName} convidou você para participar da organização como <strong>${this.role}</strong>.</p>
        <p><a href="${invitationUrl}">Aceitar convite</a></p>
        <p>Este convite expira em ${expiration}.</p>
      `)
    }

    this.message.text(`
      Convite para ${this.organizationName}

      ${this.inviterName} convidou você para participar da organização como ${this.role}.

      Aceite o convite em:
      ${invitationUrl}

      O convite expira em ${expiration}.

      Equipe ${appName}
    `)
  }
}
