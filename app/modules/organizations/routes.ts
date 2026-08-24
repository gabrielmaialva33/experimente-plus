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

const permission = (resource: IPermission.Resources, action: IPermission.Actions) =>
  middleware.permission({ permissions: `${resource}.${action}` })

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
