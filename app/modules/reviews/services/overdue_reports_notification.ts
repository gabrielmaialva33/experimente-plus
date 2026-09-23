import { BaseMail } from '@adonisjs/mail'

import type { OverdueReport } from '#modules/reviews/repositories/content_report_deadline_repository'
import env from '#start/env'

const TARGET_LABELS: Record<string, string> = {
  review: 'Avaliação',
  reply: 'Resposta do parceiro',
  establishment: 'Unidade',
  experience: 'Experiência',
  event: 'Evento',
  showcase_item: 'Item de vitrine',
}

const REASON_LABELS: Record<string, string> = {
  spam: 'Spam',
  offensive: 'Conteúdo ofensivo',
  inappropriate: 'Conteúdo inapropriado',
  false_information: 'Informação falsa',
  conflict_of_interest: 'Conflito de interesse',
  harassment: 'Assédio',
  other: 'Outro motivo',
}

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

/** "3 dias", "5 horas", "menos de uma hora" — how late, not a timestamp to decode. */
export function lateness(dueAt: Date, now: Date): string {
  const hours = Math.floor((now.getTime() - dueAt.getTime()) / 3_600_000)
  if (hours >= 48) return `${Math.floor(hours / 24)} dias`
  if (hours >= 24) return '1 dia'
  if (hours >= 2) return `${hours} horas`
  if (hours === 1) return '1 hora'
  return 'menos de uma hora'
}

/**
 * The notice that a report of the operation passed its deadline — ADR-0027.
 *
 * It names cases by protocol, type, reason and lateness, and nothing else. The
 * reporter's identity never appears, and neither does the reported text: an
 * email leaves the platform, can be forwarded, and would carry what the queue
 * shows only to people who are signed in and authorised.
 *
 * Staff are addressed in blind copy. They receive one message, and none of
 * them learns the others' addresses from it.
 */
export default class OverdueReportsNotification extends BaseMail {
  subject: string

  constructor(
    private recipients: string[],
    private operationName: string,
    private reports: OverdueReport[],
    private now: Date
  ) {
    super()
    const count = reports.length
    this.subject =
      count === 1
        ? `1 denúncia com prazo vencido — ${operationName}`
        : `${count} denúncias com prazo vencido — ${operationName}`
  }

  prepare() {
    const from = env.get('MAIL_FROM_ADDRESS', 'noreply@example.com')
    const appName = env.get('MAIL_FROM_NAME', env.get('APP_NAME', 'Experimente+'))
    const queueUrl = `${env.get('APP_URL', 'http://localhost:3333')}/backoffice/reports`
    const format = new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'America/Sao_Paulo',
    })

    this.message.from(from, appName)
    this.message.to(from)
    for (const recipient of this.recipients) this.message.bcc(recipient)

    const lines = this.reports.map((report) => ({
      protocol: report.protocol_number,
      target: TARGET_LABELS[report.target_type] ?? report.target_type,
      reason: REASON_LABELS[report.reason] ?? report.reason,
      due: format.format(report.due_at),
      late: lateness(report.due_at, this.now),
    }))

    const operation = escapeHtml(this.operationName)
    this.message.html(`
      <h1>Denúncias com prazo vencido</h1>
      <p>Na operação <strong>${operation}</strong>, estas denúncias passaram do prazo de moderação sem decisão:</p>
      <ul>
        ${lines
          .map(
            (line) =>
              `<li><strong>${escapeHtml(line.protocol)}</strong> — ${escapeHtml(line.target)}, ${escapeHtml(line.reason)}. Venceu em ${escapeHtml(line.due)}, atraso de ${escapeHtml(line.late)}.</li>`
          )
          .join('\n')}
      </ul>
      <p><a href="${escapeHtml(queueUrl)}">Abrir a fila de denúncias</a></p>
      <p>Cada denúncia gera este aviso uma única vez.</p>
    `)

    this.message.text(
      [
        'Denúncias com prazo vencido',
        '',
        `Na operação ${this.operationName}, estas denúncias passaram do prazo de moderação sem decisão:`,
        '',
        ...lines.map(
          (line) =>
            `- ${line.protocol} — ${line.target}, ${line.reason}. Venceu em ${line.due}, atraso de ${line.late}.`
        ),
        '',
        `Fila de denúncias: ${queueUrl}`,
        '',
        'Cada denúncia gera este aviso uma única vez.',
      ].join('\n')
    )
  }
}
