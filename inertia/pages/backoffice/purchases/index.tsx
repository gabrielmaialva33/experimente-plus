import { Head, Link, router } from '@inertiajs/react'
import { CheckCircle2, FlaskConical, ReceiptText, ShoppingBag } from 'lucide-react'
import { useState } from 'react'

import { ConfirmDialog } from '~/components/confirm_dialog'
import { EmptyState } from '~/components/empty_state'
import { PageHeader } from '~/components/page_header'
import { buildPageHref, PaginationNav } from '~/components/pagination'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { MainLayout } from '~/layouts/main_layout'
import { formatDateTime } from '~/lib/labels'
import {
  PURCHASE_STATUS_FILTERS,
  purchaseMethodLabel,
  purchaseProductLabel,
  purchaseStatusMeta,
  SIMULATED_PAYMENT_BADGE,
  type PurchaseStatus,
} from '~/lib/purchases'
import { cn } from '~/lib/utils'

interface PurchaseRow {
  id: string
  code: string
  created_at: string
  product_name: string
  product_type: 'edition' | 'offer'
  amount_cents: number
  currency: string
  method: 'pix' | 'card'
  status: PurchaseStatus
  paid_at: string | null
  expires_at: string
  buyer: { full_name: string; email: string } | null
  has_access: boolean
  simulated: boolean
  can_confirm_simulation: boolean
}

interface PurchasesPageProps {
  purchases: PurchaseRow[]
  meta: { total: number; current_page: number; last_page: number; per_page: number }
  counts: Record<PurchaseStatus, number>
  filters: { status: PurchaseStatus | null; page: number }
  simulation: { available: boolean }
}

const LIST_PATH = '/backoffice/purchases'

function money(cents: number, currency: string) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(cents / 100)
}

export default function PurchasesPage({
  purchases,
  meta,
  counts,
  filters,
  simulation,
}: PurchasesPageProps) {
  const [confirming, setConfirming] = useState<string | null>(null)
  const [dialog, setDialog] = useState<string | null>(null)
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0)

  function confirmSimulation(id: string) {
    setConfirming(id)
    router.post(
      `${LIST_PATH}/${id}/simulate-payment`,
      {},
      {
        preserveScroll: true,
        onFinish: () => {
          setConfirming(null)
          setDialog(null)
        },
      }
    )
  }

  function statusHref(status: PurchaseStatus | null, page?: number) {
    return buildPageHref(LIST_PATH, { status: status ?? '', ...(page ? { page } : {}) })
  }

  return (
    <MainLayout>
      <Head title="Pedidos" />

      <div className="space-y-7">
        <PageHeader
          eyebrow="Operação"
          icon={ShoppingBag}
          title="Pedidos"
          description="Compras de pacotes e vouchers feitas no app, das mais recentes para as mais antigas."
          meta={
            <>
              <Badge variant="neutral" appearance="light" shape="pill" size="lg">
                {total === 1 ? '1 pedido' : `${total.toLocaleString('pt-BR')} pedidos`}
              </Badge>
              {simulation.available ? (
                <Badge variant="warning" appearance="light" shape="pill" size="lg">
                  <FlaskConical aria-hidden="true" className="size-4" />
                  {SIMULATED_PAYMENT_BADGE}
                </Badge>
              ) : null}
            </>
          }
        />

        {simulation.available ? (
          <section
            aria-labelledby="simulated-payments-title"
            className="flex items-start gap-3 rounded-card border border-warning/30 bg-warning-soft p-5"
          >
            <FlaskConical
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-warning-accent"
            />
            <div className="min-w-0">
              <h2 id="simulated-payments-title" className="font-display text-lg font-bold">
                Pagamento simulado neste ambiente
              </h2>
              <p className="mt-1 max-w-3xl text-sm leading-6">
                Nada é cobrado aqui. Um pedido fica <strong>Pendente</strong> até alguém da equipe
                tocar em <strong>Confirmar pagamento simulado</strong>; então a conciliação libera o
                acesso na carteira da pessoa, como faria com um pagamento real. No ambiente de
                produção este botão não existe.
              </p>
            </div>
          </section>
        ) : null}

        <nav aria-label="Situação dos pedidos" className="flex flex-wrap gap-2">
          {[null, ...PURCHASE_STATUS_FILTERS].map((status) => {
            const selected = status === filters.status
            const count = status ? (counts[status] ?? 0) : total
            return (
              <Link
                key={status ?? 'all'}
                href={statusHref(status)}
                aria-current={selected ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selected
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-foreground hover:bg-accent'
                )}
              >
                {status ? purchaseStatusMeta(status).filter : 'Todos'}
                <span
                  className={cn(
                    'inline-flex min-w-6 justify-center rounded-full px-1.5 text-xs font-bold tabular-nums',
                    selected ? 'bg-primary-foreground/20' : 'bg-muted text-muted-foreground'
                  )}
                >
                  {count.toLocaleString('pt-BR')}
                </span>
              </Link>
            )
          })}
        </nav>

        {purchases.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            headingLevel={2}
            title="Nenhum pedido aqui"
            description={
              filters.status
                ? 'Nenhum pedido está nesta situação.'
                : 'Quando alguém comprar um pacote ou voucher no app, o pedido aparece aqui.'
            }
            className="rounded-card border border-dashed border-border bg-card"
          />
        ) : (
          <section aria-label="Pedidos" className="space-y-3">
            {purchases.map((purchase) => {
              const status = purchaseStatusMeta(purchase.status)
              const busy = confirming === purchase.id
              return (
                <article
                  key={purchase.id}
                  aria-labelledby={`purchase-${purchase.id}`}
                  className="overflow-hidden rounded-card border border-border-subtle bg-card"
                >
                  <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2
                          id={`purchase-${purchase.id}`}
                          className="font-display text-lg font-bold"
                        >
                          {purchase.product_name}
                        </h2>
                        <Badge variant={status.variant} appearance="light" shape="pill" size="md">
                          {status.label}
                        </Badge>
                        {purchase.simulated ? (
                          <Badge variant="warning" appearance="outline" shape="pill" size="md">
                            <FlaskConical aria-hidden="true" className="size-3.5" />
                            Pagamento simulado
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {purchaseProductLabel(purchase.product_type)} · Pedido{' '}
                        <span className="font-mono">{purchase.code}</span> ·{' '}
                        {formatDateTime(purchase.created_at)}
                      </p>
                      <p className="text-sm">
                        {purchase.buyer ? (
                          <>
                            <span className="font-semibold">{purchase.buyer.full_name}</span>
                            <span className="text-muted-foreground"> · {purchase.buyer.email}</span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">Conta excluída</span>
                        )}
                      </p>
                      {purchase.paid_at ? (
                        <p className="text-sm text-muted-foreground">
                          Pagamento confirmado em {formatDateTime(purchase.paid_at)}
                          {purchase.has_access ? ' · acesso na carteira' : ''}
                        </p>
                      ) : purchase.status === 'pending' ? (
                        <p className="text-sm text-muted-foreground">
                          Prazo para pagar: {formatDateTime(purchase.expires_at)}
                        </p>
                      ) : null}
                    </div>
                    <div className="shrink-0 sm:text-right">
                      <p className="font-display text-2xl font-extrabold tabular-nums">
                        {money(purchase.amount_cents, purchase.currency)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {purchaseMethodLabel(purchase.method)}
                      </p>
                    </div>
                  </div>

                  {purchase.can_confirm_simulation ? (
                    <div className="flex flex-col gap-3 border-t border-border-subtle bg-muted/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-muted-foreground">
                        Só neste ambiente de testes: nada é cobrado.
                      </p>
                      <ConfirmDialog
                        open={dialog === purchase.id}
                        onOpenChange={(open) => {
                          if (busy) return
                          setDialog(open ? purchase.id : null)
                        }}
                        title="Confirmar o pagamento simulado?"
                        description={`Nada é cobrado. O simulador marca o pedido ${purchase.code} como pago e a conciliação libera o acesso na carteira de ${purchase.buyer?.full_name ?? 'quem comprou'}, como faria com um pagamento real.`}
                        confirmLabel="Confirmar pagamento simulado"
                        processing={busy}
                        onConfirm={() => confirmSimulation(purchase.id)}
                        trigger={
                          <Button
                            type="button"
                            variant="primary"
                            size="lg"
                            shape="pill"
                            disabled={confirming !== null}
                          >
                            <CheckCircle2 aria-hidden="true" className="size-4" />
                            Confirmar pagamento simulado
                          </Button>
                        }
                      />
                    </div>
                  ) : null}
                </article>
              )
            })}
          </section>
        )}

        <PaginationNav
          currentPage={meta.current_page}
          lastPage={meta.last_page}
          buildHref={(page) => statusHref(filters.status, page)}
          label="Paginação dos pedidos"
        />
      </div>
    </MainLayout>
  )
}
