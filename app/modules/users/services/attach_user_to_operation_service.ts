import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'

import BadRequestException from '#exceptions/bad_request_exception'
import NotFoundException from '#exceptions/not_found_exception'
import Tenant from '#modules/tenants/models/tenant'
import User from '#modules/users/models/user'

export type OperationLink = {
  id: number
  name: string
  linked: boolean
}

/**
 * Links an account to an operation as `member`, the same link that sign-up
 * and invitation acceptance create: it gives the person a wallet in that
 * operation and lets organizations of it invite them.
 *
 * Idempotent and conservative: an existing link keeps its role and any ban,
 * so repeating the action, or running it for someone already linked, changes
 * nothing.
 */
@inject()
export default class AttachUserToOperationService {
  /** The active operation by id, as the back office names it. */
  async operation(tenantId: number): Promise<{ id: number; name: string } | null> {
    const tenant = await Tenant.query().where('id', tenantId).where('is_active', true).first()
    return tenant ? { id: tenant.id, name: tenant.name } : null
  }

  async status(userId: number, tenantId: number): Promise<OperationLink | null> {
    const operation = await this.operation(tenantId)
    if (!operation) {
      return null
    }

    const link = await db
      .from('user_tenants')
      .where('user_id', userId)
      .where('tenant_id', operation.id)
      .first()

    return { ...operation, linked: Boolean(link) }
  }

  async run(userId: number, tenantId: number): Promise<{ created: boolean; operation: string }> {
    return db.transaction(async (client) => {
      const user = await User.query({ client })
        .where('id', userId)
        .where('is_deleted', false)
        .first()
      if (!user) {
        throw new NotFoundException('User not found')
      }

      const tenant = await Tenant.query({ client })
        .where('id', tenantId)
        .where('is_active', true)
        .first()
      if (!tenant) {
        throw new BadRequestException('Operation is inactive or unavailable')
      }

      const now = new Date()
      const inserted = await client
        .table('user_tenants')
        .insert({
          user_id: user.id,
          tenant_id: tenant.id,
          role: 'member',
          created_at: now,
          updated_at: now,
        })
        .onConflict(['user_id', 'tenant_id'])
        .ignore()
        .returning('user_id')

      return { created: inserted.length > 0, operation: tenant.name }
    })
  }
}
