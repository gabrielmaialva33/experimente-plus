import { inject } from '@adonisjs/core'

import OrganizationPolicyService from '#modules/organizations/services/organization_policy_service'
import {
  PURCHASE_STATUSES,
  type PurchaseOperationsPageProps,
  type PurchaseOperationsRow,
  type PurchaseStatusFilter,
} from '#modules/purchases/interfaces/purchase_pages'
import type { PurchaseSnapshot } from '#modules/purchases/models/purchase'
import PurchaseRepository from '#modules/purchases/repositories/purchase_repository'
import { paymentSimulationAvailable } from '#modules/purchases/services/purchase_simulation_service'
import type User from '#modules/users/models/user'

/**
 * Read side of the back-office "Pedidos" list: the orders of the operation for
 * platform administrators, the same audience as `/api/v1/admin/purchases`.
 */
@inject()
export default class PurchasePagesService {
  constructor(
    private policy: OrganizationPolicyService,
    private repository: PurchaseRepository
  ) {}

  async list(
    tenantId: number,
    actor: User,
    filters: { status?: PurchaseStatusFilter; page?: number; perPage?: number } = {}
  ): Promise<PurchaseOperationsPageProps> {
    await this.policy.requirePlatformAdmin(actor)
    const simulation = paymentSimulationAvailable()
    const perPage = filters.perPage ?? 20
    const page = Math.max(1, filters.page ?? 1)

    const result = await this.repository.paginateForOperations(
      tenantId,
      filters.status,
      page,
      perPage
    )

    const counts = Object.fromEntries(PURCHASE_STATUSES.map((status) => [status, 0])) as Record<
      PurchaseStatusFilter,
      number
    >
    const grouped = await this.repository.countByStatus(tenantId)
    for (const row of grouped) {
      if (row.status in counts) counts[row.status as PurchaseStatusFilter] = Number(row.total)
    }

    const now = Date.now()
    return {
      purchases: result.all().map((row): PurchaseOperationsRow => {
        const snapshot = row.snapshot as PurchaseSnapshot
        const expiresAt = new Date(row.expires_at)
        const simulated = row.provider === 'fake'
        return {
          id: row.id,
          code: String(row.id).slice(0, 8).toUpperCase(),
          created_at: new Date(row.created_at).toISOString(),
          product_name: snapshot?.name ?? 'Pedido',
          product_type: row.offer_id === null ? 'edition' : 'offer',
          amount_cents: Number(row.amount_cents),
          currency: row.currency,
          method: row.method,
          status: row.status,
          paid_at: row.paid_at ? new Date(row.paid_at).toISOString() : null,
          expires_at: expiresAt.toISOString(),
          buyer: row.buyer_name ? { full_name: row.buyer_name, email: row.buyer_email } : null,
          has_access: row.access_id !== null,
          simulated,
          can_confirm_simulation:
            simulation &&
            simulated &&
            row.status === 'pending' &&
            !row.paid_at &&
            expiresAt.getTime() > now,
        }
      }),
      meta: {
        total: Number(result.total),
        current_page: Number(result.currentPage),
        last_page: Number(result.lastPage),
        per_page: Number(result.perPage),
      },
      counts,
      filters: { status: filters.status ?? null, page },
      simulation: { available: simulation },
    }
  }
}
