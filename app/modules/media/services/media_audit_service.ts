import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'

import AuditService from '#modules/audits/services/audit_service'

export interface MediaAuditData {
  actorId: number
  action: string
  resourceId: number
  metadata?: Record<string, unknown>
}

@inject()
export default class MediaAuditService {
  constructor(private auditService: AuditService) {}

  async log(data: MediaAuditData): Promise<void> {
    await this.auditService.logPermissionCheck(
      {
        userId: data.actorId,
        resource: 'media',
        action: data.action,
        resourceId: data.resourceId,
        result: 'granted',
        reason: 'Media domain operation completed',
        metadata: data.metadata,
      },
      HttpContext.get() ?? undefined
    )
  }
}
