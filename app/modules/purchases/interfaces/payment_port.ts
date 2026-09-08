export type PaymentMethod = 'pix' | 'card'
export type PaymentState = 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded' | 'disputed'
export interface PaymentObservation {
  id: string
  reference: string
  account: string
  environment: 'test' | 'live'
  amountCents: number
  currency: string
  providerStatus?: string
  providerDetail?: string
  refundReferences?: string[]
  state: PaymentState
  paidAt: string | null
  refundedCents: number
  instructions: { pix_code?: string; pix_url?: string } | null
}
export interface PaymentInput {
  email: string
  name?: string
  card_token?: string
  payment_method_id?: string
  document_type?: string
  document_number?: string
}
export interface PaymentRequest {
  id: string
  amountCents: number
  currency: string
  method: PaymentMethod
  createdAt: string
  expiresAt: string
  input: PaymentInput
}
export interface VerifiedPaymentEvent {
  key: string
  resourceId: string
}
export abstract class PaymentPort {
  abstract readonly name: string
  abstract readonly account: string
  abstract readonly environment: 'test' | 'live'
  abstract create(request: PaymentRequest): Promise<PaymentObservation>
  abstract find(reference: string): Promise<PaymentObservation | null>
  // The worker may reuse its previously authenticated confirmation time after PSP event retention.
  abstract get(id: string, knownPaidAt?: string): Promise<PaymentObservation>
  abstract refund(id: string, amountCents: number, key: string): Promise<void>
  abstract cancel(id: string, key: string): Promise<void>
  abstract verifyWebhook(
    headers: Record<string, string | undefined>,
    body: unknown,
    query: Record<string, unknown>
  ): VerifiedPaymentEvent
}
