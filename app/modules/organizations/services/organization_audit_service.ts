import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'

import AuditService from '#modules/audits/services/audit_service'

export type OrganizationAuditData = {
  actorId: number
  resource: string
  action: string
  resourceId: number
  metadata?: Record<string, unknown>
}

@inject()
export default class OrganizationAuditService {
  constructor(private auditService: AuditService) {}

  async log(data: OrganizationAuditData): Promise<void> {
    await this.auditService.logPermissionCheck(
      {
        userId: data.actorId,
        resource: data.resource,
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
