import Stripe from 'stripe'
import { PaymentPort } from '#modules/purchases/interfaces/payment_port'
import type {
  PaymentObservation,
  PaymentRequest,
  VerifiedPaymentEvent,
} from '#modules/purchases/interfaces/payment_port'
import {
  PaymentUnavailableException,
  PaymentConfigurationException,
  InvalidPaymentWebhookException,
} from '#modules/purchases/exceptions'

/** Only authenticated PaymentIntent/Charge/Refund reads constitute payment evidence. */
export default class StripeAdapter extends PaymentPort {
  readonly name = 'stripe'
  private client: Stripe

  constructor(
    readonly account: string,
    readonly environment: 'test' | 'live',
    token: string,
    private webhookSecret?: string,
    client?: Stripe
  ) {
    super()
    this.client = client ?? new Stripe(token, { maxNetworkRetries: 2, timeout: 20000 })
  }

  private async request<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation()
    } catch {
      // Never expose SDK error payloads, headers, client secrets or customer data.
      throw new PaymentUnavailableException(
        'Stripe request or payment evidence could not be verified'
      )
    }
  }

  private async verifyAccount() {
    const account = await this.client.accounts.retrieve(null)
    if (account.id !== this.account) throw new Error('Stripe account mismatch')
  }

  async create(request: PaymentRequest): Promise<PaymentObservation> {
    return this.request(async () => {
      await this.verifyAccount()
      const params: Stripe.PaymentIntentCreateParams = {
        amount: request.amountCents,
        currency: request.currency.toLowerCase(),
        metadata: { purchase_id: request.id },
        payment_method_types: [request.method],
        capture_method: 'automatic',
        confirm: true,
      }
      if (request.method === 'card') {
        if (
          !request.input.card_token?.startsWith('pm_') ||
          request.input.payment_method_id !== 'card'
        )
          throw new Error('Stripe requires a tokenized card PaymentMethod')
        params.payment_method = request.input.card_token
        // Current checkout contract cannot complete a next_action for 3DS. Fail safely, never grant.
        params.error_on_requires_action = true
      } else {
        if (!request.input.name) throw new Error('Pix requires payer name')
        params.payment_method_data = {
          type: 'pix',
          billing_details: {
            name: request.input.name,
            email: request.input.email,
            ...(request.input.document_number ? { tax_id: request.input.document_number } : {}),
          },
        }
        // An absolute expiry keeps retry parameters identical and respects the local quote.
        params.payment_method_options = {
          pix: { expires_at: Math.floor(new Date(request.expiresAt).getTime() / 1000) },
        }
      }
      const payment = await this.client.paymentIntents.create(params, {
        idempotencyKey: request.id,
      })
      return this.observe(payment)
    })
  }

  async find(reference: string): Promise<PaymentObservation | null> {
    return this.request(async () => {
      await this.verifyAccount()
      if (!/^[0-9a-f-]{36}$/i.test(reference)) throw new Error('Invalid purchase reference')
      const result = await this.client.paymentIntents.search({
        query: `metadata['purchase_id']:'${reference}'`,
        limit: 2,
      })
      if (result.data.length > 1 || result.has_more) throw new Error('Ambiguous purchase reference')
      // Search is eventually consistent. The durable worker retries create with the SAME key (<23h).
      return result.data[0] ? this.observe(result.data[0]) : null
    })
  }

  async get(id: string, knownPaidAt?: string): Promise<PaymentObservation> {
    return this.request(async () => {
      await this.verifyAccount()
      return this.observe(await this.client.paymentIntents.retrieve(id), knownPaidAt)
    })
  }

  async refund(id: string, amountCents: number, key: string): Promise<void> {
    await this.request(async () => {
      await this.verifyAccount()
      await this.assertPayment(await this.client.paymentIntents.retrieve(id))
      if (!Number.isSafeInteger(amountCents) || amountCents <= 0) throw new Error('Invalid refund')
      await this.client.refunds.create(
        { payment_intent: id, amount: amountCents },
        { idempotencyKey: key }
      )
      // Accepted != settled: worker reads successful refunds before releasing its financial hold.
    })
  }

  async cancel(id: string, key: string): Promise<void> {
    await this.request(async () => {
      await this.verifyAccount()
      await this.assertPayment(await this.client.paymentIntents.retrieve(id))
      await this.client.paymentIntents.cancel(id, {}, { idempotencyKey: key })
    })
  }

  verifyWebhook(
    headers: Record<string, string | undefined>,
    body: unknown,
    _query: Record<string, unknown>
  ): VerifiedPaymentEvent {
    if (!this.webhookSecret)
      throw new PaymentConfigurationException('Stripe webhook verification is not configured')
    try {
      if (typeof body !== 'string' || !headers['stripe-signature'])
        throw new Error('Missing signature or raw payload')
      // Explicit trust boundary: unmodified bytes, endpoint secret, SDK signature and timestamp check.
      const event = this.client.webhooks.constructEvent(
        body,
        headers['stripe-signature'],
        this.webhookSecret,
        300
      )
      if (
        event.livemode !== (this.environment === 'live') ||
        (event.account && event.account !== this.account)
      )
        throw new Error('Webhook environment or account mismatch')
      const object = event.data.object as {
        object: string
        id: string
        payment_intent?: string | null
      }
      const resourceId = object.object === 'payment_intent' ? object.id : object.payment_intent
      if (!resourceId || !/^pi_[a-zA-Z0-9]+$/.test(resourceId))
        throw new Error('Unsupported event resource')
      return { key: event.id, resourceId }
    } catch {
      throw new InvalidPaymentWebhookException('Stripe webhook could not be verified')
    }
  }

  private assertPayment(payment: Stripe.PaymentIntent) {
    if (
      payment.livemode !== (this.environment === 'live') ||
      payment.currency !== 'brl' ||
      !Number.isSafeInteger(payment.amount) ||
      payment.amount <= 0 ||
      !/^[0-9a-f-]{36}$/i.test(payment.metadata.purchase_id ?? '')
    )
      throw new Error('Invalid authenticated payment')
  }

  private async confirmationTime(payment: Stripe.PaymentIntent, knownPaidAt?: string) {
    // Timestamp already recorded by this worker remains valid beyond Stripe's 30-day event retention.
    if (knownPaidAt && Number.isFinite(Date.parse(knownPaidAt))) return knownPaidAt
    // PaymentIntent.created and Charge.created are NOT the asynchronous confirmation timestamp.
    for await (const event of this.client.events.list({
      type: 'payment_intent.succeeded',
      created: { gte: payment.created },
      limit: 100,
    })) {
      const object = event.data.object as Stripe.PaymentIntent
      if (
        object.id === payment.id &&
        object.status === 'succeeded' &&
        event.livemode === payment.livemode
      )
        return new Date(event.created * 1000).toISOString()
    }
    // Eventual visibility/retention gaps must retry or reach manual review, never invent a paidAt.
    throw new Error('Authenticated confirmation timestamp is not available')
  }

  private async observe(
    payment: Stripe.PaymentIntent,
    knownPaidAt?: string
  ): Promise<PaymentObservation> {
    this.assertPayment(payment)
    let state: PaymentObservation['state'] = payment.status === 'canceled' ? 'cancelled' : 'pending'
    let refundedCents = 0
    const refundReferences: string[] = []
    let paidAt: string | null = null
    if (payment.status === 'succeeded') {
      if (payment.amount_received !== payment.amount || !payment.latest_charge)
        throw new Error('Incomplete capture')
      const chargeId =
        typeof payment.latest_charge === 'string' ? payment.latest_charge : payment.latest_charge.id
      const charge = await this.client.charges.retrieve(chargeId)
      if (
        !charge.paid ||
        !charge.captured ||
        charge.amount_captured !== payment.amount ||
        charge.currency !== payment.currency ||
        charge.payment_intent !== payment.id ||
        charge.livemode !== payment.livemode
      )
        throw new Error('Charge does not match payment')
      for await (const refund of this.client.refunds.list({
        payment_intent: payment.id,
        limit: 100,
      })) {
        if (refund.payment_intent !== payment.id || refund.currency !== payment.currency)
          throw new Error('Invalid refund evidence')
        if (refund.status === 'succeeded') {
          refundedCents += refund.amount
          refundReferences.push(refund.id)
        }
      }
      if (!Number.isSafeInteger(refundedCents) || refundedCents > payment.amount)
        throw new Error('Invalid refund total')
      state = refundedCents === payment.amount ? 'refunded' : 'paid'
      if (charge.disputed) {
        for await (const dispute of this.client.disputes.list({
          payment_intent: payment.id,
          limit: 100,
        })) {
          if (!['won', 'warning_closed'].includes(dispute.status)) state = 'disputed'
        }
      }
      if (state === 'paid') paidAt = await this.confirmationTime(payment, knownPaidAt)
    } else if (payment.status === 'requires_payment_method' && payment.last_payment_error)
      state = 'failed'
    const pix = payment.next_action?.pix_display_qr_code
    return {
      id: payment.id,
      reference: payment.metadata.purchase_id,
      account: this.account,
      environment: this.environment,
      amountCents: payment.amount,
      currency: payment.currency.toUpperCase(),
      state,
      providerStatus: payment.status,
      paidAt,
      refundedCents,
      refundReferences,
      instructions:
        state === 'pending' && pix
          ? { pix_code: pix.data, pix_url: pix.hosted_instructions_url }
          : null,
    }
  }
}
