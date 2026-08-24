import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'

import AuditService from '#modules/audits/services/audit_service'

export type EstablishmentAuditData = {
  actorId: number
  action: string
  resourceId: number
  metadata?: Record<string, unknown>
}

@inject()
export default class EstablishmentAuditService {
  constructor(private auditService: AuditService) {}

  async log(data: EstablishmentAuditData): Promise<void> {
    await this.auditService.logPermissionCheck(
      {
        userId: data.actorId,
        resource: 'establishments',
        action: data.action,
        resourceId: data.resourceId,
        result: 'granted',
        reason: 'Domain operation completed',
        metadata: data.metadata,
      },
      HttpContext.get() ?? undefined
    )
  }
}
