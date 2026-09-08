import { randomBytes, randomUUID } from 'node:crypto'
import Stripe from 'stripe'

/** Deterministic SDK boundary: no network, no credential fixture, observable requests. */
export function stripeTransport() {
  const reference = randomUUID()
  const payment = {
    id: 'pi_' + randomBytes(12).toString('hex'),
    metadata: { purchase_id: reference },
    amount: 12345,
    amount_received: 12345,
    currency: 'brl',
    livemode: false,
    status: 'succeeded',
    created: Math.floor(Date.now() / 1000) - 60,
    latest_charge: 'ch_' + randomBytes(12).toString('hex'),
    next_action: null,
  } as unknown as Stripe.PaymentIntent
  const charge = {
    id: payment.latest_charge,
    payment_intent: payment.id,
    paid: true,
    captured: true,
    amount_captured: payment.amount,
    currency: 'brl',
    livemode: false,
    disputed: false,
  } as Stripe.Charge
  const refunds: Stripe.Refund[] = []
  const disputes: Stripe.Dispute[] = []
  const calls: Array<{ operation: string; params: unknown; key?: string }> = []
  const state = {
    account: 'acct_' + randomBytes(12).toString('hex'),
    found: true,
    duplicate: false,
    eventVisible: true,
    confirmedAt: Math.floor(Date.now() / 1000),
  }
  const client = {
    accounts: { retrieve: async () => ({ id: state.account }) },
    paymentIntents: {
      create: async (params: Stripe.PaymentIntentCreateParams, options: Stripe.RequestOptions) => {
        calls.push({ operation: 'create', params, key: options.idempotencyKey })
        Object.assign(payment, {
          metadata: params.metadata,
          amount: params.amount,
          amount_received: params.amount,
        })
        charge.amount_captured = params.amount
        return payment
      },
      retrieve: async () => payment,
      search: async () => ({
        data: state.found ? (state.duplicate ? [payment, payment] : [payment]) : [],
        has_more: false,
      }),
      cancel: async (_id: string, params: unknown, options: Stripe.RequestOptions) => {
        calls.push({ operation: 'cancel', params, key: options.idempotencyKey })
        payment.status = 'canceled'
        return payment
      },
    },
    charges: { retrieve: async () => charge },
    refunds: {
      list: async function* () {
        yield* refunds
      },
      create: async (params: Stripe.RefundCreateParams, options: Stripe.RequestOptions) => {
        calls.push({ operation: 'refund', params, key: options.idempotencyKey })
        if (!refunds.some((r) => r.id === options.idempotencyKey))
          refunds.push({
            id: options.idempotencyKey!,
            amount: params.amount!,
            payment_intent: payment.id,
            currency: 'brl',
            status: 'succeeded',
          } as Stripe.Refund)
        return refunds.at(-1)
      },
    },
    disputes: {
      list: async function* () {
        yield* disputes
      },
    },
    events: {
      list: async function* () {
        if (state.eventVisible)
          yield { data: { object: payment }, livemode: false, created: state.confirmedAt }
      },
    },
    webhooks: new Stripe(randomBytes(32).toString('hex')).webhooks,
  } as unknown as Stripe
  return { client, payment, charge, refunds, disputes, calls, state }
}
