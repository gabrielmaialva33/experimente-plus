import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import UnauthorizedException from '#exceptions/unauthorized_exception'
import {
  PaymentPort,
  type PaymentObservation,
  type PaymentRequest,
} from '#modules/purchases/interfaces/payment_port'

type Json = Record<string, unknown>
const record = (value: unknown): Json =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : {}
const cents = (value: unknown): number => {
  if (typeof value !== 'string' || !/^\d+(\.\d{1,2})?$/.test(value))
    throw new Error('Invalid provider amount')
  const [whole, fraction = ''] = value.split('.')
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  if (!Number.isSafeInteger(result)) throw new Error('Invalid provider amount')
  return result
}
const money = (value: number) =>
  `${Math.floor(value / 100)}.${String(value % 100).padStart(2, '0')}`

/** Payments API: exposes authoritative approval time, collector and live_mode. */
export default class MercadoPagoAdapter extends PaymentPort {
  readonly name = 'mercado_pago'
  constructor(
    readonly account: string,
    readonly environment: 'test' | 'live',
    private token: string,
    private webhookSecret: string,
    private transport: typeof fetch = fetch
  ) {
    super()
  }
  private async request(path: string, method = 'GET', body?: unknown, key?: string): Promise<Json> {
    const response = await this.transport(`https://api.mercadopago.com${path}`, {
      method,
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...(key ? { 'X-Idempotency-Key': key } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    if (!response.ok) throw new Error(`Payment provider HTTP ${response.status}`)
    return record(await response.json())
  }
  async create(request: PaymentRequest): Promise<PaymentObservation> {
    const result = await this.request(
      '/v1/payments',
      'POST',
      {
        external_reference: request.id,
        transaction_amount: Number(money(request.amountCents)),
        description: 'Acesso à edição Experimente+',
        payment_method_id: request.method === 'pix' ? 'pix' : request.input.payment_method_id,
        ...(request.method === 'card'
          ? { token: request.input.card_token, installments: 1, capture: true }
          : { date_of_expiration: request.expiresAt }),
        payer: {
          email: request.input.email,
          ...(request.input.document_number
            ? {
                identification: {
                  type: request.input.document_type,
                  number: request.input.document_number,
                },
              }
            : {}),
        },
      },
      request.id
    )
    return this.normalize(result)
  }
  async find(reference: string): Promise<PaymentObservation | null> {
    const result = await this.request(
      '/v1/payments/search?external_reference=' + encodeURIComponent(reference)
    )
    if (
      !Array.isArray(result.results) ||
      Number(record(result.paging).total) > 1 ||
      result.results.length > 1
    )
      throw new Error('Ambiguous provider reference')
    return result.results.length ? this.normalize(record(result.results[0])) : null
  }
  async get(id: string) {
    return this.normalize(await this.request(`/v1/payments/${encodeURIComponent(id)}`))
  }
  async refund(id: string, amountCents: number, key: string) {
    await this.request(
      `/v1/payments/${encodeURIComponent(id)}/refunds`,
      'POST',
      { amount: Number(money(amountCents)) },
      key
    )
  }
  async cancel(id: string, key: string) {
    await this.request(
      `/v1/payments/${encodeURIComponent(id)}`,
      'PUT',
      { status: 'cancelled' },
      key
    )
  }
  /** Explicit authentication boundary: HMAC manifest per payment webhook documentation. */
  verifyWebhook(
    headers: Record<string, string | undefined>,
    body: unknown,
    query: Record<string, unknown>
  ) {
    const data = record(body)
    const resource = query['data.id']
    const requestId = headers['x-request-id']
    const fields = (headers['x-signature'] ?? '').split(',').map((v) => v.trim())
    const ts = fields.find((v) => v.startsWith('ts='))?.slice(3)
    const signature = fields.find((v) => v.startsWith('v1='))?.slice(3)
    if (
      typeof resource !== 'string' ||
      !/^\d{1,30}$/.test(resource) ||
      !requestId ||
      !/^[a-zA-Z0-9-]{1,150}$/.test(requestId) ||
      !ts ||
      !/^(\d{10}|\d{13})$/.test(ts) ||
      !signature ||
      !/^[a-f0-9]{64}$/.test(signature) ||
      String(record(data.data).id) !== resource ||
      data.type !== 'payment' ||
      fields.length !== 2
    )
      throw new UnauthorizedException('Invalid payment notification')
    const instant = Number(ts) * (ts.length === 10 ? 1000 : 1)
    if (Math.abs(Date.now() - instant) > 300000)
      throw new UnauthorizedException('Invalid payment notification')
    const manifest = `id:${resource.toLowerCase()};request-id:${requestId};ts:${ts};`
    const expected = createHmac('sha256', this.webhookSecret).update(manifest).digest()
    if (!timingSafeEqual(expected, Buffer.from(signature, 'hex')))
      throw new UnauthorizedException('Invalid payment notification')
    // Only signed inputs are trusted. Body status/account/event ID cannot authorize any effect.
    return { resourceId: resource, key: createHash('sha256').update(manifest).digest('hex') }
  }
  private normalize(payment: Json): PaymentObservation {
    if (
      !/^\d{1,30}$/.test(String(payment.id)) ||
      typeof payment.external_reference !== 'string' ||
      String(payment.collector_id) !== this.account ||
      payment.live_mode !== (this.environment === 'live') ||
      payment.currency_id !== 'BRL'
    )
      throw new Error('Invalid payment identity, account, environment or currency')
    const amount = cents(String(payment.transaction_amount))
    const refunded = cents(String(payment.transaction_amount_refunded ?? 0))
    const state =
      payment.status === 'refunded'
        ? 'refunded'
        : ['charged_back', 'in_mediation'].includes(String(payment.status))
          ? 'disputed'
          : payment.status === 'approved' &&
              payment.status_detail === 'accredited' &&
              payment.captured === true
            ? 'paid'
            : payment.status === 'rejected'
              ? 'failed'
              : payment.status === 'cancelled'
                ? 'cancelled'
                : 'pending'
    if (refunded > amount || (state === 'refunded' && refunded !== amount))
      throw new Error('Inconsistent refund amount')
    const method = record(record(payment.point_of_interaction).transaction_data)
    const ticket =
      typeof method.ticket_url === 'string' &&
      /^https:\/\/(www\.)?mercadopago\.com\.br\//.test(method.ticket_url)
        ? method.ticket_url
        : undefined
    return {
      providerStatus: /^[a-z_]{1,60}$/.test(String(payment.status))
        ? String(payment.status)
        : 'unknown',
      providerDetail: /^[a-z_]{1,60}$/.test(String(payment.status_detail))
        ? String(payment.status_detail)
        : 'unknown',
      refundReferences: Array.isArray(payment.refunds)
        ? payment.refunds.map((r) => String(record(r).id)).filter((id) => /^\d{1,30}$/.test(id))
        : [],
      id: String(payment.id),
      reference: payment.external_reference,
      account: String(payment.collector_id),
      environment: payment.live_mode ? 'live' : 'test',
      amountCents: amount,
      currency: payment.currency_id,
      state,
      paidAt: typeof payment.date_approved === 'string' ? payment.date_approved : null,
      refundedCents: refunded,
      instructions:
        typeof method.qr_code === 'string'
          ? { pix_code: method.qr_code, ...(ticket ? { pix_url: ticket } : {}) }
          : null,
    }
  }
}
