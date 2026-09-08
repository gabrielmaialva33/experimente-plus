import { PaymentConfigurationException } from '#modules/purchases/exceptions'
import { deploymentEnvironment } from '#shared/utils/deployment_environment'
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'
import UnauthorizedException from '#exceptions/unauthorized_exception'
import {
  PaymentPort,
  type PaymentObservation,
  type PaymentRequest,
} from '#modules/purchases/interfaces/payment_port'

/** Durable simulator: state survives restarts, never selectable in production. */
export default class FakePaymentAdapter extends PaymentPort {
  readonly name = 'fake'
  readonly account = 'local'
  readonly environment = 'test' as const
  constructor() {
    super()
    if (deploymentEnvironment(env.get('DEPLOYMENT_ENV')) === 'production')
      throw new PaymentConfigurationException('Fake payments are forbidden in production')
  }
  async create(request: PaymentRequest): Promise<PaymentObservation> {
    const id = `fake_${request.id}`
    const state: PaymentObservation = {
      id,
      reference: request.id,
      account: this.account,
      environment: this.environment,
      amountCents: request.amountCents,
      currency: request.currency,
      state: 'pending',
      paidAt: null,
      refundedCents: 0,
      instructions: { pix_code: `SIMULATION:${id}` },
    }
    await db
      .table('purchase_fake_payments')
      .insert({ id, purchase_id: request.id, state: JSON.stringify(state) })
      .onConflict('id')
      .ignore()
    return this.get(id)
  }
  async find(reference: string) {
    const row = await db.from('purchase_fake_payments').where('purchase_id', reference).first()
    return row ? (row.state as PaymentObservation) : null
  }
  async get(id: string): Promise<PaymentObservation> {
    const row = await db.from('purchase_fake_payments').where('id', id).first()
    if (!row) throw new Error('Payment not found')
    return row.state
  }
  async simulate(
    id: string,
    change: Partial<Pick<PaymentObservation, 'state' | 'paidAt' | 'refundedCents'>>
  ): Promise<void> {
    await db.transaction(async (client) => {
      const row = await client
        .from('purchase_fake_payments')
        .where('id', id)
        .forUpdate()
        .firstOrFail()
      await client
        .from('purchase_fake_payments')
        .where('id', id)
        .update({ state: JSON.stringify({ ...row.state, ...change }) })
    })
  }
  async refund(id: string, amountCents: number, key: string): Promise<void> {
    await db.transaction(async (client) => {
      const row = await client
        .from('purchase_fake_payments')
        .where('id', id)
        .forUpdate()
        .firstOrFail()
      const state = row.state as PaymentObservation & { refunds?: Record<string, number> }
      const refunds = state.refunds ?? {}
      if (refunds[key] !== undefined) {
        if (refunds[key] !== amountCents) throw new Error('Conflicting refund')
        return
      }
      if (state.refundedCents + amountCents > state.amountCents)
        throw new Error('Refund exceeds payment')
      refunds[key] = amountCents
      state.refundedCents += amountCents
      state.refunds = refunds
      state.state = state.refundedCents === state.amountCents ? 'refunded' : 'paid'
      await client
        .from('purchase_fake_payments')
        .where('id', id)
        .update({ state: JSON.stringify(state) })
    })
  }
  async cancel(id: string): Promise<void> {
    const state = await this.get(id)
    if (state.state === 'pending') await this.simulate(id, { state: 'cancelled' })
  }
  sign(resourceId: string, eventId: string): string {
    return createHmac('sha256', env.get('APP_KEY')).update(`${resourceId}:${eventId}`).digest('hex')
  }
  verifyWebhook(headers: Record<string, string | undefined>, body: unknown) {
    const data = body as { resource_id?: unknown; event_id?: unknown }
    if (
      !data ||
      typeof data.resource_id !== 'string' ||
      typeof data.event_id !== 'string' ||
      data.resource_id.length > 150 ||
      data.event_id.length > 150
    )
      throw new UnauthorizedException('Invalid payment notification')
    const signature = headers['x-fake-signature'] ?? ''
    const expected = this.sign(data.resource_id, data.event_id)
    if (
      !/^[a-f0-9]{64}$/.test(signature) ||
      !timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))
    )
      throw new UnauthorizedException('Invalid payment notification')
    return {
      resourceId: data.resource_id,
      key: createHash('sha256').update(data.event_id).digest('hex'),
    }
  }
}
