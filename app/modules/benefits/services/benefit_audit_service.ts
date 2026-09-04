import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'

import AuditService, { type AuditWriteOptions } from '#modules/audits/services/audit_service'

export type BenefitAuditData = {
  actorId: number
  resource: 'benefit_editions' | 'benefit_offers' | 'benefit_accesses' | 'benefit_redemptions'
  action: string
  resourceId: number
  metadata?: Record<string, unknown>
}

@inject()
export default class BenefitAuditService {
  constructor(private auditService: AuditService) {}

  async log(data: BenefitAuditData, options: AuditWriteOptions = {}): Promise<void> {
    await this.auditService.logPermissionCheck(
      {
        userId: data.actorId,
        resource: data.resource,
        action: data.action,
        resourceId: data.resourceId,
        result: 'granted',
        reason: 'Benefit domain operation completed',
        metadata: data.metadata,
      },
      HttpContext.get() ?? undefined,
      options
    )
  }
}
