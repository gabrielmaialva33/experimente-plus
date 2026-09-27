import type { Purchase } from '#modules/purchases/models/purchase'

export const PURCHASE_STATUSES = [
  'pending',
  'paid',
  'review',
  'failed',
  'cancelled',
  'refunded',
] as const satisfies readonly Purchase['status'][]

export type PurchaseStatusFilter = (typeof PURCHASE_STATUSES)[number]

/**
 * Inertia contract of the back-office "Pedidos" list. Type aliases, not
 * interfaces, so the props satisfy Inertia's JSON record type.
 */
export type PurchaseOperationsRow = {
  id: string
  code: string
  created_at: string
  product_name: string
  product_type: 'edition' | 'offer'
  amount_cents: number
  currency: string
  method: 'pix' | 'card'
  status: Purchase['status']
  paid_at: string | null
  expires_at: string
  buyer: { full_name: string; email: string } | null
  has_access: boolean
  /** Paid through the fake provider: nothing was charged. */
  simulated: boolean
  /** "Confirmar pagamento simulado" is offered for this row. */
  can_confirm_simulation: boolean
}

export type PurchaseOperationsPageProps = {
  purchases: PurchaseOperationsRow[]
  meta: { total: number; current_page: number; last_page: number; per_page: number }
  counts: Record<PurchaseStatusFilter, number>
  filters: { status: PurchaseStatusFilter | null; page: number }
  /**
   * The configured provider is the fake one and the deployment is not
   * production. False everywhere else: the page then renders no simulation
   * control, and the route refuses the action on its own.
   */
  simulation: { available: boolean }
}
