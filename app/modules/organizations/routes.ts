import router from '@adonisjs/core/services/router'

import IPermission from '#modules/permissions/interfaces/permission_interface'
import { middleware } from '#start/kernel'

const OrganizationsController = () =>
  import('#modules/organizations/controllers/organizations_controller')
const OrganizationMembersController = () =>
  import('#modules/organizations/controllers/organization_members_controller')
const OrganizationInvitationsController = () =>
  import('#modules/organizations/controllers/organization_invitations_controller')
const OrganizationClaimsController = () =>
  import('#modules/organizations/controllers/organization_claims_controller')
const AdminOrganizationsController = () =>
  import('#modules/organizations/controllers/admin_organizations_controller')
const AdminOrganizationClaimsController = () =>
  import('#modules/organizations/controllers/admin_organization_claims_controller')
const OrganizationTeamPagesController = () =>
  import('#modules/organizations/controllers/organization_team_pages_controller')
const OrganizationInvitationPagesController = () =>
  import('#modules/organizations/controllers/organization_invitation_pages_controller')
const OrganizationReviewPagesController = () =>
  import('#modules/organizations/controllers/organization_review_pages_controller')

const permission = (resource: IPermission.Resources, action: IPermission.Actions) =>
  middleware.permission({ permissions: `${resource}.${action}` })

/** A page that shows two resources needs the right to read both. */
const permissions = (...pairs: [IPermission.Resources, IPermission.Actions][]) =>
  middleware.permission({
    permissions: pairs.map(([resource, action]) => `${resource}.${action}`),
    requireAll: true,
  })

router
  .group(() => {
    router
      .get('/', [OrganizationsController, 'index'])
      .use(permission(IPermission.Resources.ORGANIZATIONS, IPermission.Actions.LIST))
    router
      .post('/', [OrganizationsController, 'store'])
      .use(permission(IPermission.Resources.ORGANIZATIONS, IPermission.Actions.CREATE))
    router
      .get('/:id', [OrganizationsController, 'show'])
      .use(permission(IPermission.Resources.ORGANIZATIONS, IPermission.Actions.READ))
    router
      .put('/:id', [OrganizationsController, 'update'])
      .use(permission(IPermission.Resources.ORGANIZATIONS, IPermission.Actions.UPDATE))
    router
      .post('/:id/submit', [OrganizationsController, 'submit'])
      .use(permission(IPermission.Resources.ORGANIZATIONS, IPermission.Actions.SUBMIT))
    router
      .post('/:id/archive', [OrganizationsController, 'archive'])
      .use(permission(IPermission.Resources.ORGANIZATIONS, IPermission.Actions.ARCHIVE))

    router
      .get('/:id/members', [OrganizationMembersController, 'index'])
      .use(permission(IPermission.Resources.ORGANIZATION_MEMBERS, IPermission.Actions.LIST))
    router
      .patch('/:id/members/:memberId', [OrganizationMembersController, 'update'])
      .use(permission(IPermission.Resources.ORGANIZATION_MEMBERS, IPermission.Actions.UPDATE))
    router
      .delete('/:id/members/:memberId', [OrganizationMembersController, 'destroy'])
      .use(permission(IPermission.Resources.ORGANIZATION_MEMBERS, IPermission.Actions.DELETE))

    router
      .get('/:id/invitations', [OrganizationInvitationsController, 'index'])
      .use(permission(IPermission.Resources.ORGANIZATION_INVITATIONS, IPermission.Actions.LIST))
    router
      .post('/:id/invitations', [OrganizationInvitationsController, 'store'])
      .use(permission(IPermission.Resources.ORGANIZATION_INVITATIONS, IPermission.Actions.CREATE))
    router
      .post('/:id/invitations/:invitationId/resend', [OrganizationInvitationsController, 'resend'])
      .use(permission(IPermission.Resources.ORGANIZATION_INVITATIONS, IPermission.Actions.RESEND))
    router
      .delete('/:id/invitations/:invitationId', [OrganizationInvitationsController, 'destroy'])
      .use(permission(IPermission.Resources.ORGANIZATION_INVITATIONS, IPermission.Actions.REVOKE))

    router
      .post('/:id/claims', [OrganizationClaimsController, 'store'])
      .use(permission(IPermission.Resources.ORGANIZATION_CLAIMS, IPermission.Actions.CREATE))
  })
  .prefix('/api/v1/organizations')
  .use(middleware.auth())
  .use(middleware.tenant({ required: true }))

router
  .post('/api/v1/organization-invitations/accept', [OrganizationInvitationsController, 'accept'])
  .use(middleware.auth())
  .use(permission(IPermission.Resources.ORGANIZATION_INVITATIONS, IPermission.Actions.ACCEPT))

router
  .group(() => {
    router
      .get('/', [AdminOrganizationsController, 'index'])
      .use(permission(IPermission.Resources.ORGANIZATIONS, IPermission.Actions.LIST))
    router
      .post('/:id/approve', [AdminOrganizationsController, 'approve'])
      .use(permission(IPermission.Resources.ORGANIZATIONS, IPermission.Actions.APPROVE))
    router
      .post('/:id/request-changes', [AdminOrganizationsController, 'requestChanges'])
      .use(permission(IPermission.Resources.ORGANIZATIONS, IPermission.Actions.REQUEST_CHANGES))
    router
      .post('/:id/reject', [AdminOrganizationsController, 'reject'])
      .use(permission(IPermission.Resources.ORGANIZATIONS, IPermission.Actions.REJECT))
    router
      .post('/:id/suspend', [AdminOrganizationsController, 'suspend'])
      .use(permission(IPermission.Resources.ORGANIZATIONS, IPermission.Actions.SUSPEND))
    router
      .post('/:id/restore', [AdminOrganizationsController, 'restore'])
      .use(permission(IPermission.Resources.ORGANIZATIONS, IPermission.Actions.RESTORE))
    router
      .post('/:id/archive', [AdminOrganizationsController, 'archive'])
      .use(permission(IPermission.Resources.ORGANIZATIONS, IPermission.Actions.ARCHIVE))
  })
  .prefix('/api/v1/admin/organizations')
  .use(middleware.auth())
  .use(middleware.tenant({ required: true }))

router
  .group(() => {
    router
      .get('/', [AdminOrganizationClaimsController, 'index'])
      .use(permission(IPermission.Resources.ORGANIZATION_CLAIMS, IPermission.Actions.LIST))
    router
      .post('/:id/approve', [AdminOrganizationClaimsController, 'approve'])
      .use(permission(IPermission.Resources.ORGANIZATION_CLAIMS, IPermission.Actions.APPROVE))
    router
      .post('/:id/reject', [AdminOrganizationClaimsController, 'reject'])
      .use(permission(IPermission.Resources.ORGANIZATION_CLAIMS, IPermission.Actions.REJECT))
  })
  .prefix('/api/v1/admin/organization-claims')
  .use(middleware.auth())
  .use(middleware.tenant({ required: true }))

/**
 * "Organizações" in the back-office moderation inbox. Each route carries the
 * permission of its `/api/v1/admin/organizations` or `/organization-claims`
 * counterpart and calls the same service method; the services require platform
 * moderation again, so a partner who holds `organizations.list` for the Portal
 * still gets a 403 here.
 */
router
  .group(() => {
    router
      .get('/organizations', [OrganizationReviewPagesController, 'index'])
      .as('backoffice.organizations.index')
      .use(permission(IPermission.Resources.ORGANIZATIONS, IPermission.Actions.LIST))
    router
      .get('/organizations/:organizationId', [OrganizationReviewPagesController, 'show'])
      .where('organizationId', router.matchers.number())
      .as('backoffice.organizations.show')
      .use(permission(IPermission.Resources.ORGANIZATIONS, IPermission.Actions.READ))
    router
      .post('/organizations/:organizationId/approve', [
        OrganizationReviewPagesController,
        'approve',
      ])
      .where('organizationId', router.matchers.number())
      .as('backoffice.organizations.approve')
      .use(permission(IPermission.Resources.ORGANIZATIONS, IPermission.Actions.APPROVE))
    router
      .post('/organizations/:organizationId/request-changes', [
        OrganizationReviewPagesController,
        'requestChanges',
      ])
      .where('organizationId', router.matchers.number())
      .as('backoffice.organizations.request_changes')
      .use(permission(IPermission.Resources.ORGANIZATIONS, IPermission.Actions.REQUEST_CHANGES))
    router
      .post('/organizations/:organizationId/reject', [OrganizationReviewPagesController, 'reject'])
      .where('organizationId', router.matchers.number())
      .as('backoffice.organizations.reject')
      .use(permission(IPermission.Resources.ORGANIZATIONS, IPermission.Actions.REJECT))
    router
      .post('/organization-claims/:claimId/approve', [
        OrganizationReviewPagesController,
        'approveClaim',
      ])
      .where('claimId', router.matchers.number())
      .as('backoffice.organization_claims.approve')
      .use(permission(IPermission.Resources.ORGANIZATION_CLAIMS, IPermission.Actions.APPROVE))
    router
      .post('/organization-claims/:claimId/reject', [
        OrganizationReviewPagesController,
        'rejectClaim',
      ])
      .where('claimId', router.matchers.number())
      .as('backoffice.organization_claims.reject')
      .use(permission(IPermission.Resources.ORGANIZATION_CLAIMS, IPermission.Actions.REJECT))
  })
  .prefix('/backoffice')
  .use(middleware.auth({ guards: ['jwt'] }))
  .use(middleware.tenant({ required: true }))

/**
 * "Equipe" in the partner Portal. Each route carries the permission of its
 * `/api/v1/organizations/:id/...` counterpart, so the page is never a wider
 * door than the API; the membership and invitation services decide which
 * roles the actor may grant or manage.
 */
router
  .group(() => {
    router
      .get('/team', [OrganizationTeamPagesController, 'index'])
      .as('portal.team.index')
      .use(permission(IPermission.Resources.ORGANIZATION_MEMBERS, IPermission.Actions.LIST))
    router
      .get('/organizations/:organizationId/team', [OrganizationTeamPagesController, 'show'])
      .where('organizationId', router.matchers.number())
      .as('portal.team.show')
      .use(
        permissions(
          [IPermission.Resources.ORGANIZATION_MEMBERS, IPermission.Actions.LIST],
          [IPermission.Resources.ORGANIZATION_INVITATIONS, IPermission.Actions.LIST]
        )
      )
    router
      .post('/organizations/:organizationId/team/invitations', [
        OrganizationTeamPagesController,
        'invite',
      ])
      .where('organizationId', router.matchers.number())
      .as('portal.team.invitations.store')
      .use(permission(IPermission.Resources.ORGANIZATION_INVITATIONS, IPermission.Actions.CREATE))
    router
      .post('/organizations/:organizationId/team/invitations/:invitationId/resend', [
        OrganizationTeamPagesController,
        'resendInvitation',
      ])
      .where('organizationId', router.matchers.number())
      .where('invitationId', router.matchers.number())
      .as('portal.team.invitations.resend')
      .use(permission(IPermission.Resources.ORGANIZATION_INVITATIONS, IPermission.Actions.RESEND))
    router
      .delete('/organizations/:organizationId/team/invitations/:invitationId', [
        OrganizationTeamPagesController,
        'cancelInvitation',
      ])
      .where('organizationId', router.matchers.number())
      .where('invitationId', router.matchers.number())
      .as('portal.team.invitations.destroy')
      .use(permission(IPermission.Resources.ORGANIZATION_INVITATIONS, IPermission.Actions.REVOKE))
    router
      .patch('/organizations/:organizationId/team/members/:memberId', [
        OrganizationTeamPagesController,
        'updateMember',
      ])
      .where('organizationId', router.matchers.number())
      .where('memberId', router.matchers.number())
      .as('portal.team.members.update')
      .use(permission(IPermission.Resources.ORGANIZATION_MEMBERS, IPermission.Actions.UPDATE))
    router
      .delete('/organizations/:organizationId/team/members/:memberId', [
        OrganizationTeamPagesController,
        'removeMember',
      ])
      .where('organizationId', router.matchers.number())
      .where('memberId', router.matchers.number())
      .as('portal.team.members.destroy')
      .use(permission(IPermission.Resources.ORGANIZATION_MEMBERS, IPermission.Actions.DELETE))
  })
  .prefix('/portal')
  .use(middleware.auth({ guards: ['jwt'] }))
  .use(middleware.tenant({ required: true }))

/**
 * The page the invitation e-mail links to. Reading it needs no account: the
 * link explains the invitation and offers sign-in or sign-up. Accepting needs
 * the invited account and the permission the API route carries; the token
 * resolves its own operation, so no active one is required.
 */
router
  .get('/organization-invitations/accept', [OrganizationInvitationPagesController, 'show'])
  .as('organization_invitations.accept.show')
router
  .post('/organization-invitations/accept', [OrganizationInvitationPagesController, 'accept'])
  .as('organization_invitations.accept.store')
  .use(middleware.auth({ guards: ['jwt'] }))
  .use(permission(IPermission.Resources.ORGANIZATION_INVITATIONS, IPermission.Actions.ACCEPT))
