import { inject } from '@adonisjs/core'

import ForbiddenException from '#exceptions/forbidden_exception'
import type ICurrentUserContext from '#modules/users/interfaces/current_user_context_interface'
import OrganizationResourceAuthorizationService, {
  type OrganizationActorAuthorizationContext,
} from '#modules/organizations/services/organization_resource_authorization_service'
import type User from '#modules/users/models/user'

export function projectCurrentUser(user: User): ICurrentUserContext.UserProjection {
  return {
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    username: user.username,
    email_verified: user.email_verified,
    email_verified_at: user.email_verified_at,
  }
}

export function projectMobileCapabilities(
  authorization: OrganizationActorAuthorizationContext
): ICurrentUserContext.CapabilitiesProjection {
  const redemptionRead = authorization.allowed_actions.redemptions.read
  const redemptionValidate = authorization.allowed_actions.redemptions.validate
  const accessSnapshot = authorization.access_snapshot

  return {
    consumer: {
      wallet: {
        read: true,
      },
    },
    partner: {
      enabled: accessSnapshot.has_active_organization_membership,
      redemptions: {
        read: redemptionRead,
        validate: redemptionValidate,
      },
    },
    platform_access: accessSnapshot.platform_access,
  }
}

/**
 * Builds the authenticated mobile context from trusted operation middleware
 * state and the canonical organization authorization projection.
 */
@inject()
export default class CurrentUserContextService {
  constructor(private resourceAuthorization: OrganizationResourceAuthorizationService) {}

  async run(actor: User, activeOperationId: number): Promise<ICurrentUserContext.Projection> {
    const operationRecords = await actor
      .related('tenants')
      .query()
      .where('tenants.is_active', true)
      .orderBy('tenants.id', 'asc')

    const activeOperation = operationRecords.find((operation) => operation.id === activeOperationId)
    if (!activeOperation) {
      throw new ForbiddenException('The active operation is no longer accessible')
    }

    const authorization = await this.resourceAuthorization.forActorContext(activeOperationId, actor)

    return {
      user: projectCurrentUser(actor),
      active_operation: {
        id: activeOperation.id,
        name: activeOperation.name,
        slug: activeOperation.slug,
      },
      operations: operationRecords.map((operation) => ({
        id: operation.id,
        name: operation.name,
        slug: operation.slug,
        role: operation.$extras.pivot_role as string,
        is_current: operation.id === activeOperationId,
      })),
      capabilities: projectMobileCapabilities(authorization),
    }
  }
}
