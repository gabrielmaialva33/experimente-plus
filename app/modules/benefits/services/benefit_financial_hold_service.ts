import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

/** A financial hold does not change BenefitAccess lifecycle or redemption counters. */
export default class BenefitFinancialHoldService {
  async blocked(
    tenantId: number,
    accessId: number,
    client?: TransactionClientContract
  ): Promise<boolean> {
    return Boolean(
      await (client ?? db)
        .from('purchase_financial_holds')
        .where('tenant_id', tenantId)
        .where('access_id', accessId)
        .whereNull('released_at')
        .first()
    )
  }
  async blockedIds(tenantId: number, accessIds: number[]): Promise<Set<number>> {
    if (!accessIds.length) return new Set()
    const rows = await db
      .from('purchase_financial_holds')
      .select('access_id')
      .where('tenant_id', tenantId)
      .whereIn('access_id', accessIds)
      .whereNull('released_at')
    return new Set(rows.map((row) => Number(row.access_id)))
  }
}
