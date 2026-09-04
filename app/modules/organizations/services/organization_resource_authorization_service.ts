import { inject } from '@adonisjs/core'

import type IEstablishment from '#modules/establishments/interfaces/establishment_interface'
import type IOrganization from '#modules/organizations/interfaces/organization_interface'
import OrganizationPolicyService, {
  organizationPolicyCapabilitiesFor,
} from '#modules/organizations/services/organization_policy_service'
import IPermission from '#modules/permissions/interfaces/permission_interface'
import PermissionService from '#modules/permissions/services/permission_service'
import type User from '#modules/users/models/user'

type PolicyFlag = Exclude<keyof IOrganization.PolicyCapabilities, 'source' | 'role'>

export interface OrganizationActorAuthorizationContext {
  access_snapshot: IOrganization.ActorAccessSnapshot
  permission_names: ReadonlySet<string>
  allowed_actions: IOrganization.AllowedActions
}

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
      // A new revision also uses establishments.create, but remains fail-closed
      // until the establishment lifecycle/revision projection selects a source.
      create_revision: false,
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
      activate: allows(
        'manage_establishments',
        IPermission.Resources.BENEFIT_OFFERS,
        IPermission.Actions.UPDATE
      ),
      pause: allows(
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
      read: allows(
        'read_redemptions',
        IPermission.Resources.BENEFIT_OFFERS,
        IPermission.Actions.READ
      ),
      validate: allows(
        'validate_redemptions',
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

const ORGANIZATION_ESTABLISHMENT_MANAGEMENT_STATUSES = new Set<IOrganization.Status>([
  'draft',
  'changes_requested',
  'active',
])

/**
 * Narrows organization-scoped actions with lifecycle state. Capabilities stay
 * reusable and aggregated actions stay generic; only an organization projection
 * may expose creation of a unit.
 */
export function projectOrganizationStateAllowedActions(
  actions: IOrganization.AllowedActions,
  status: IOrganization.Status
): IOrganization.AllowedActions {
  const acceptsManagement = ORGANIZATION_ESTABLISHMENT_MANAGEMENT_STATUSES.has(status)
  const acceptsSubmission = status === 'draft' || status === 'changes_requested'

  return {
    ...actions,
    organizations: {
      ...actions.organizations,
      update: actions.organizations.update && acceptsManagement,
      submit: actions.organizations.submit && acceptsSubmission,
    },
    establishments: {
      ...actions.establishments,
      create: actions.establishments.create && acceptsManagement,
      create_revision: false,
    },
  }
}

export interface EstablishmentRevisionActionState {
  organization_status: IOrganization.Status
  lifecycle_status: IEstablishment.LifecycleStatus
  business_status: IEstablishment.BusinessStatus
  published_revision_id: number | null
  revision_status: IEstablishment.RevisionStatus | null
}

/**
 * A revision CTA is available only when the domain service has a canonical
 * source to clone and no open revision can race the request. The clone service
 * repeats all checks transactionally.
 */
export function projectEstablishmentRevisionAllowedActions(
  actions: IOrganization.AllowedActions,
  state: EstablishmentRevisionActionState
): IOrganization.AllowedActions {
  const establishmentArchived = state.lifecycle_status === 'archived'
  const organizationAllowsManagement = ORGANIZATION_ESTABLISHMENT_MANAGEMENT_STATUSES.has(
    state.organization_status
  )
  const revisionAcceptsEdits =
    state.revision_status === 'draft' || state.revision_status === 'changes_requested'
  const canEditRevision =
    organizationAllowsManagement && !establishmentArchived && revisionAcceptsEdits
  const canSubmitRevision =
    canEditRevision &&
    state.lifecycle_status === 'active' &&
    state.business_status !== 'permanently_closed'
  const hasCloneSource = state.published_revision_id
    ? state.revision_status === 'approved'
    : state.revision_status === 'rejected'

  return {
    ...actions,
    establishments: {
      ...actions.establishments,
      update: actions.establishments.update && canEditRevision,
      submit: actions.establishments.submit && canSubmitRevision,
      archive: actions.establishments.archive && !establishmentArchived,
      create_revision:
        actions.establishments.create &&
        organizationAllowsManagement &&
        !establishmentArchived &&
        hasCloneSource,
    },
  }
}

export interface EstablishmentBenefitActionState {
  lifecycle_status: IEstablishment.LifecycleStatus
  business_status: IEstablishment.BusinessStatus
  published_revision_id: number | null
}

/**
 * Keeps emergency/terminal offer actions available while narrowing actions
 * that would advertise new or changed terms. The offer service repeats these
 * checks for create/update/activate and intentionally keeps pause/archive as
 * state-transition escape hatches.
 */
export function projectEstablishmentBenefitAllowedActions(
  actions: IOrganization.AllowedActions,
  state: EstablishmentBenefitActionState
): IOrganization.AllowedActions {
  const acceptsNewTerms =
    state.lifecycle_status === 'active' &&
    state.published_revision_id !== null &&
    state.business_status !== 'permanently_closed'

  return {
    ...actions,
    benefit_offers: {
      ...actions.benefit_offers,
      create: actions.benefit_offers.create && acceptsNewTerms,
      update: actions.benefit_offers.update && acceptsNewTerms,
      activate: actions.benefit_offers.activate && acceptsNewTerms,
    },
  }
}

function capabilitiesForActor(
  snapshot: IOrganization.ActorAccessSnapshot
): IOrganization.PolicyCapabilities[] {
  if (snapshot.platform_access === 'platform_admin') {
    return [organizationPolicyCapabilitiesFor('platform_admin', null)]
  }

  if (snapshot.organization_accesses.length > 0) {
    return snapshot.organization_accesses.map((access) => access.capabilities)
  }

  return snapshot.platform_access === 'platform_moderator'
    ? [organizationPolicyCapabilitiesFor('platform_moderator', null)]
    : []
}

function capabilitiesForOrganization(
  snapshot: IOrganization.ActorAccessSnapshot,
  organizationId: number
): IOrganization.PolicyCapabilities[] {
  if (snapshot.platform_access === 'platform_admin') {
    return [organizationPolicyCapabilitiesFor('platform_admin', null)]
  }

  const membershipAccess = snapshot.organization_accesses.find(
    (access) => access.organization_id === organizationId
  )
  if (membershipAccess) {
    return [membershipAccess.capabilities]
  }

  return snapshot.platform_access === 'platform_moderator'
    ? [organizationPolicyCapabilitiesFor('platform_moderator', null)]
    : []
}

@inject()
export default class OrganizationResourceAuthorizationService {
  constructor(
    private organizationPolicy: OrganizationPolicyService,
    private permissionService: PermissionService
  ) {}

  async forOrganization(
    tenantId: number,
    organizationId: number,
    actor: User
  ): Promise<IOrganization.AllowedActions> {
    const decision = await this.organizationPolicy.resolveAccess(actor, tenantId, organizationId)
    const permissions = await this.permissionService.getEffectivePermissionNames(actor.id)

    return projectOrganizationAllowedActions([decision.capabilities], new Set(permissions))
  }

  /**
   * Aggregates actions across the organizations visible to the actor. This is
   * used only by cross-organization Portal pages such as redemption history.
   */
  async forActor(tenantId: number, actor: User): Promise<IOrganization.AllowedActions> {
    const context = await this.forActorContext(tenantId, actor)
    return context.allowed_actions
  }

  async forActorContext(
    tenantId: number,
    actor: User
  ): Promise<OrganizationActorAuthorizationContext> {
    const accessSnapshot = await this.organizationPolicy.resolveActorAccess(actor, tenantId)
    const permissions = await this.permissionService.getEffectivePermissionNames(actor.id)
    const permissionNames = new Set(permissions)
    const allowedActions = projectOrganizationAllowedActions(
      capabilitiesForActor(accessSnapshot),
      permissionNames
    )

    return {
      access_snapshot: accessSnapshot,
      permission_names: permissionNames,
      allowed_actions: allowedActions,
    }
  }

  forOrganizationFromContext(
    organizationId: number,
    context: OrganizationActorAuthorizationContext
  ): IOrganization.AllowedActions {
    return projectOrganizationAllowedActions(
      capabilitiesForOrganization(context.access_snapshot, organizationId),
      context.permission_names
    )
  }
}
