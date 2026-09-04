import { inject } from '@adonisjs/core'

import type IOrganization from '#modules/organizations/interfaces/organization_interface'
import OrganizationMemberRepository from '#modules/organizations/repositories/organization_member_repository'
import OrganizationPolicyService, {
  organizationPolicyCapabilitiesFor,
} from '#modules/organizations/services/organization_policy_service'
import IPermission from '#modules/permissions/interfaces/permission_interface'
import PermissionService from '#modules/permissions/services/permission_service'
import type User from '#modules/users/models/user'

type PolicyFlag = Exclude<keyof IOrganization.PolicyCapabilities, 'source' | 'role'>

const permissionName = (resource: IPermission.Resources, action: IPermission.Actions) =>
  `${resource}.${action}`

/**
 * Crosses global route permissions with organization-domain policy decisions.
 * This pure projection is also the contract-level test seam for Portal views.
 */
export function projectOrganizationAllowedActions(
  capabilities: readonly IOrganization.PolicyCapabilities[],
  permissionNames: ReadonlySet<string>
): IOrganization.AllowedActions {
  const policyAllows = (flag: PolicyFlag) =>
    capabilities.some((capability) => capability[flag] === true)
  const globallyAllows = (resource: IPermission.Resources, action: IPermission.Actions) =>
    permissionNames.has(permissionName(resource, action))
  const allows = (
    policyFlag: PolicyFlag,
    resource: IPermission.Resources,
    action: IPermission.Actions
  ) => policyAllows(policyFlag) && globallyAllows(resource, action)

  return {
    organizations: {
      read: allows('read', IPermission.Resources.ORGANIZATIONS, IPermission.Actions.READ),
      update: allows(
        'update_organization',
        IPermission.Resources.ORGANIZATIONS,
        IPermission.Actions.UPDATE
      ),
      submit: allows(
        'submit_organization',
        IPermission.Resources.ORGANIZATIONS,
        IPermission.Actions.SUBMIT
      ),
    },
    establishments: {
      read: allows('read', IPermission.Resources.ESTABLISHMENTS, IPermission.Actions.READ),
      list: allows('read', IPermission.Resources.ESTABLISHMENTS, IPermission.Actions.LIST),
      create: allows(
        'manage_establishments',
        IPermission.Resources.ESTABLISHMENTS,
        IPermission.Actions.CREATE
      ),
      update: allows(
        'manage_establishments',
        IPermission.Resources.ESTABLISHMENTS,
        IPermission.Actions.UPDATE
      ),
      submit: allows(
        'manage_establishments',
        IPermission.Resources.ESTABLISHMENTS,
        IPermission.Actions.SUBMIT
      ),
      archive: allows(
        'manage_establishment_lifecycle',
        IPermission.Resources.ESTABLISHMENTS,
        IPermission.Actions.ARCHIVE
      ),
    },
    benefit_offers: {
      read: allows('read', IPermission.Resources.BENEFIT_OFFERS, IPermission.Actions.READ),
      list: allows('read', IPermission.Resources.BENEFIT_OFFERS, IPermission.Actions.LIST),
      create: allows(
        'manage_establishments',
        IPermission.Resources.BENEFIT_OFFERS,
        IPermission.Actions.CREATE
      ),
      update: allows(
        'manage_establishments',
        IPermission.Resources.BENEFIT_OFFERS,
        IPermission.Actions.UPDATE
      ),
      archive: allows(
        'manage_establishments',
        IPermission.Resources.BENEFIT_OFFERS,
        IPermission.Actions.ARCHIVE
      ),
    },
    redemptions: {
      read: allows('read', IPermission.Resources.BENEFIT_OFFERS, IPermission.Actions.READ),
      validate: allows(
        'manage_establishments',
        IPermission.Resources.BENEFIT_OFFERS,
        IPermission.Actions.UPDATE
      ),
    },
    analytics: {
      read: allows('read_analytics', IPermission.Resources.ANALYTICS, IPermission.Actions.READ),
    },
    pilot_feedback: {
      create: allows('read', IPermission.Resources.PILOT_FEEDBACK, IPermission.Actions.CREATE),
    },
  }
}

@inject()
export default class OrganizationResourceAuthorizationService {
  constructor(
    private organizationPolicy: OrganizationPolicyService,
    private memberRepository: OrganizationMemberRepository,
    private permissionService: PermissionService
  ) {}

  async forOrganization(
    tenantId: number,
    organizationId: number,
    actor: User
  ): Promise<IOrganization.AllowedActions> {
    const [decision, permissions] = await Promise.all([
      this.organizationPolicy.resolveAccess(actor, tenantId, organizationId),
      this.permissionService.getEffectivePermissionNames(actor.id),
    ])

    return projectOrganizationAllowedActions([decision.capabilities], new Set(permissions))
  }

  /**
   * Aggregates actions across the organizations visible to the actor. This is
   * used only by cross-organization Portal pages such as redemption history.
   */
  async forActor(tenantId: number, actor: User): Promise<IOrganization.AllowedActions> {
    const [isPlatformAdmin, memberships, permissions] = await Promise.all([
      this.organizationPolicy.isPlatformAdmin(actor),
      this.memberRepository.listActiveByUser(tenantId, actor.id),
      this.permissionService.getEffectivePermissionNames(actor.id),
    ])
    const capabilities = isPlatformAdmin
      ? [organizationPolicyCapabilitiesFor('platform_admin', null)]
      : memberships.map((membership) =>
          organizationPolicyCapabilitiesFor('membership', membership.role)
        )

    return projectOrganizationAllowedActions(capabilities, new Set(permissions))
  }
}
