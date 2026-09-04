import { inject } from '@adonisjs/core'

import ForbiddenException from '#exceptions/forbidden_exception'
import type ICurrentUserContext from '#modules/users/interfaces/current_user_context_interface'
import type IOrganization from '#modules/organizations/interfaces/organization_interface'
import OrganizationMemberRepository from '#modules/organizations/repositories/organization_member_repository'
import OrganizationResourceAuthorizationService from '#modules/organizations/services/organization_resource_authorization_service'
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
  actions: IOrganization.AllowedActions,
  platformAccess: ICurrentUserContext.PlatformAccess,
  hasActiveOrganizationMembership: boolean
): ICurrentUserContext.CapabilitiesProjection {
  const redemptionRead = actions.redemptions.read
  const redemptionValidate = actions.redemptions.validate

  return {
    consumer: {
      wallet: {
        read: true,
      },
    },
    partner: {
      enabled: hasActiveOrganizationMembership,
      redemptions: {
        read: redemptionRead,
        validate: redemptionValidate,
      },
    },
    platform_access: platformAccess,
  }
}

/**
 * Builds the authenticated mobile context from trusted operation middleware
 * state and the canonical organization authorization projection.
 */
@inject()
export default class CurrentUserContextService {
  constructor(
    private resourceAuthorization: OrganizationResourceAuthorizationService,
    private organizationMemberRepository: OrganizationMemberRepository
  ) {}

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
    const hasActiveOrganizationMembership = await this.organizationMemberRepository.hasActiveByUser(
      activeOperationId,
      actor.id
    )

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
      capabilities: projectMobileCapabilities(
        authorization.allowed_actions,
        authorization.access_snapshot.platform_access,
        hasActiveOrganizationMembership
      ),
    }
  }
}
