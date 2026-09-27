/**
 * Presentation of purchases in the back office. The purchase ledger and its
 * reconciliation stay on the server; this only names the states, in the words
 * the app uses with the buyer.
 */

export type PurchaseStatus = 'pending' | 'paid' | 'review' | 'failed' | 'cancelled' | 'refunded'

export const PURCHASE_STATUS_FILTERS: readonly PurchaseStatus[] = [
  'pending',
  'paid',
  'review',
  'failed',
  'cancelled',
  'refunded',
]

/** Shown wherever a payment is simulated: nothing was, or will be, charged. */
export const SIMULATED_PAYMENT_BADGE = 'Pagamento simulado — ambiente de testes'

type BadgeVariant = 'success' | 'info' | 'warning' | 'destructive' | 'neutral'

const STATUS_META: Record<
  PurchaseStatus,
  { label: string; filter: string; variant: BadgeVariant }
> = {
  pending: { label: 'Pendente', filter: 'Pendentes', variant: 'info' },
  paid: { label: 'Pago', filter: 'Pagos', variant: 'success' },
  review: { label: 'Em conferência', filter: 'Em conferência', variant: 'warning' },
  failed: { label: 'Não concluído', filter: 'Não concluídos', variant: 'destructive' },
  cancelled: { label: 'Cancelado', filter: 'Cancelados', variant: 'neutral' },
  refunded: { label: 'Reembolsado', filter: 'Reembolsados', variant: 'neutral' },
}

export function purchaseStatusMeta(status: string) {
  return (
    STATUS_META[status as PurchaseStatus] ?? { label: status, filter: status, variant: 'neutral' }
  )
}

export function purchaseMethodLabel(method: string): string {
  return method === 'card' ? 'Cartão' : 'Pix'
}

export function purchaseProductLabel(type: string): string {
  return type === 'offer' ? 'Voucher avulso' : 'Pacote da edição'
}
