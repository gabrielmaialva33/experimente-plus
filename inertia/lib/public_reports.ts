/**
 * Reporting from the public web page — W10 of the web audit, ADR-0027
 * scenarios 13 and 14.
 *
 * A visitor reports without an account through the same public route the app
 * uses, `POST /api/v1/catalog/content-reports`: the operation comes from the
 * hostname and the answer is only a protocol. The optional token is opaque,
 * kept in this browser so a repeat is recognised, and grants nothing.
 */

export type PublicReportTarget = 'establishment' | 'review' | 'reply'

export type PublicReportReason =
  | 'offensive'
  | 'harassment'
  | 'inappropriate'
  | 'false_information'
  | 'spam'
  | 'conflict_of_interest'
  | 'other'

/** The same labels and order as the app's report screen. */
export const PUBLIC_REPORT_REASONS: { value: PublicReportReason; label: string }[] = [
  { value: 'offensive', label: 'Ofensivo ou discriminatório' },
  { value: 'harassment', label: 'Assédio' },
  { value: 'inappropriate', label: 'Conteúdo inadequado' },
  { value: 'false_information', label: 'Informação falsa' },
  { value: 'spam', label: 'Spam ou propaganda' },
  { value: 'conflict_of_interest', label: 'Conflito de interesse' },
  { value: 'other', label: 'Outro motivo' },
]

export const PUBLIC_REPORT_TITLES: Record<PublicReportTarget, string> = {
  establishment: 'Denunciar este lugar',
  review: 'Denunciar avaliação',
  reply: 'Denunciar resposta',
}

const TOKEN_KEY = 'ep.anonymous_report_token'

function anonymousToken(): string | null {
  try {
    const stored = window.localStorage.getItem(TOKEN_KEY)
    if (stored && /^[A-Za-z0-9-]{16,128}$/.test(stored)) return stored
    const created = window.crypto?.randomUUID?.()
    if (!created) return null
    window.localStorage.setItem(TOKEN_KEY, created)
    return created
  } catch {
    // Private windows and blocked storage still report; the token is optional.
    return null
  }
}

export type PublicReportResult = { ok: true; protocol: string } | { ok: false; message: string }

export async function submitPublicReport(input: {
  targetType: PublicReportTarget
  targetId: number
  reason: PublicReportReason
  details: string
}): Promise<PublicReportResult> {
  const details = input.details.trim()

  let response: Response
  try {
    response = await fetch('/api/v1/catalog/content-reports', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target_type: input.targetType,
        target_id: input.targetId,
        reason: input.reason,
        details: details || null,
        anonymous_token: anonymousToken(),
      }),
    })
  } catch {
    return { ok: false, message: 'Sem conexão. Confira a internet e tente de novo.' }
  }

  if (response.ok) {
    const body = (await response.json().catch(() => null)) as { protocol_number?: unknown } | null
    const protocol = typeof body?.protocol_number === 'string' ? body.protocol_number : ''
    return { ok: true, protocol }
  }
  if (response.status === 404) {
    return { ok: false, message: 'Este conteúdo não está mais disponível.' }
  }
  if (response.status === 409) {
    return { ok: false, message: 'Você já denunciou este conteúdo. A moderação está analisando.' }
  }
  if (response.status === 429) {
    return { ok: false, message: 'Muitas denúncias em pouco tempo. Tente de novo mais tarde.' }
  }
  return { ok: false, message: 'Não foi possível enviar a denúncia agora. Tente de novo.' }
}
