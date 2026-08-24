import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import mail from '@adonisjs/mail/services/main'
import { DateTime } from 'luxon'

import OrganizationInvitation from '#modules/organizations/models/organization_invitation'
import OrganizationMember from '#modules/organizations/models/organization_member'
import OrganizationInvitationNotification from '#modules/organizations/services/organization_invitation_notification'
import {
  addOrganizationMember,
  createOperation,
  createOrganization,
  createUser,
} from './helpers.js'

test.group('Organization invitations', (group) => {
  group.each.setup(() => {
    mail.restore()
    mail.fake()
    return testUtils.db().withGlobalTransaction()
  })

  group.each.teardown(() => {
    mail.restore()
  })

  test('stores only the HMAC and accepts a matching account exactly once', async ({
    client,
    assert,
  }) => {
    const tenant = await createOperation('invitation-operation')
    const owner = await createUser({ prefix: 'invitation-owner', tenant })
    const invitee = await createUser({ prefix: 'invitation-invitee' })
    const wrongAccount = await createUser({ prefix: 'invitation-wrong-account' })
    const organization = await createOrganization({ tenant, owner, prefix: 'Invitation' })
    const { mails } = mail.fake()

    const create = await client
      .post(`/api/v1/organizations/${organization.id}/invitations`)
      .header('x-tenant-id', String(tenant.id))
      .loginAs(owner)
      .json({ email: invitee.email.toUpperCase(), role: 'editor' })

    create.assertStatus(201)
    assert.equal(create.body().invitation.email, invitee.email)
    assert.equal(create.body().invitation.role, 'editor')
    assert.notProperty(create.body().invitation, 'token_hash')
    mails.assertSentCount(OrganizationInvitationNotification, 1)

    const notification = mails.sent()[0] as OrganizationInvitationNotification
    const rawToken = notification.getInvitationToken()
    const invitation = await OrganizationInvitation.findOrFail(create.body().invitation.id)
    assert.lengthOf(invitation.token_hash, 64)
    assert.notEqual(invitation.token_hash, rawToken)

    const wrongEmail = await client
      .post('/api/v1/organization-invitations/accept')
      .loginAs(wrongAccount)
      .json({ token: rawToken })
    wrongEmail.assertStatus(400)

    const accept = await client
      .post('/api/v1/organization-invitations/accept')
      .loginAs(invitee)
      .json({ token: rawToken })
    accept.assertStatus(200)
    assert.equal(accept.body().tenant_id, tenant.id)
    assert.equal(accept.body().organization.id, organization.id)
    assert.equal(accept.body().role, 'editor')

    const membership = await OrganizationMember.query()
      .where('organization_id', organization.id)
      .where('user_id', invitee.id)
      .firstOrFail()
    assert.equal(membership.status, 'active')
    assert.equal(membership.role, 'editor')

    const tenantMembership = await invitee
      .related('tenants')
      .query()
      .where('tenants.id', tenant.id)
      .first()
    assert.isNotNull(tenantMembership)
    assert.equal(tenantMembership!.$extras.pivot_role, 'member')

    const replay = await client
      .post('/api/v1/organization-invitations/accept')
      .loginAs(invitee)
      .json({ token: rawToken })
    replay.assertStatus(400)
  })

  test('rotates pending invitations and invalidates the previous token', async ({
    client,
    assert,
  }) => {
    const tenant = await createOperation('invitation-rotation')
    const owner = await createUser({ prefix: 'rotation-owner', tenant })
    const invitee = await createUser({ prefix: 'rotation-invitee' })
    const organization = await createOrganization({ tenant, owner, prefix: 'Rotation' })
    const { mails } = mail.fake()

    const first = await client
      .post(`/api/v1/organizations/${organization.id}/invitations`)
      .header('x-tenant-id', String(tenant.id))
      .loginAs(owner)
      .json({ email: invitee.email, role: 'analyst' })
    first.assertStatus(201)
    const firstToken = (mails.sent()[0] as OrganizationInvitationNotification).getInvitationToken()

    const second = await client
      .post(`/api/v1/organizations/${organization.id}/invitations`)
      .header('x-tenant-id', String(tenant.id))
      .loginAs(owner)
      .json({ email: invitee.email, role: 'editor' })
    second.assertStatus(201)
    const secondToken = (mails.sent()[1] as OrganizationInvitationNotification).getInvitationToken()

    const previous = await OrganizationInvitation.findOrFail(first.body().invitation.id)
    assert.isNotNull(previous.revoked_at)
    assert.notEqual(firstToken, secondToken)

    const oldToken = await client
      .post('/api/v1/organization-invitations/accept')
      .loginAs(invitee)
      .json({ token: firstToken })
    oldToken.assertStatus(400)

    const newToken = await client
      .post('/api/v1/organization-invitations/accept')
      .loginAs(invitee)
      .json({ token: secondToken })
    newToken.assertStatus(200)
    assert.equal(newToken.body().role, 'editor')
  })

  test('rejects revoked and expired invitations', async ({ client }) => {
    const tenant = await createOperation('invitation-terminal')
    const owner = await createUser({ prefix: 'terminal-owner', tenant })
    const revokedInvitee = await createUser({ prefix: 'revoked-invitee' })
    const expiredInvitee = await createUser({ prefix: 'expired-invitee' })
    const organization = await createOrganization({ tenant, owner, prefix: 'Terminal invitation' })
    const { mails } = mail.fake()

    const revoked = await client
      .post(`/api/v1/organizations/${organization.id}/invitations`)
      .header('x-tenant-id', String(tenant.id))
      .loginAs(owner)
      .json({ email: revokedInvitee.email, role: 'editor' })
    const revokedToken = (
      mails.sent()[0] as OrganizationInvitationNotification
    ).getInvitationToken()

    const revoke = await client
      .delete(
        `/api/v1/organizations/${organization.id}/invitations/${revoked.body().invitation.id}`
      )
      .header('x-tenant-id', String(tenant.id))
      .loginAs(owner)
    revoke.assertStatus(204)

    const revokedAccept = await client
      .post('/api/v1/organization-invitations/accept')
      .loginAs(revokedInvitee)
      .json({ token: revokedToken })
    revokedAccept.assertStatus(400)

    const expired = await client
      .post(`/api/v1/organizations/${organization.id}/invitations`)
      .header('x-tenant-id', String(tenant.id))
      .loginAs(owner)
      .json({ email: expiredInvitee.email, role: 'analyst' })
    const expiredToken = (
      mails.sent()[1] as OrganizationInvitationNotification
    ).getInvitationToken()
    const expiredRecord = await OrganizationInvitation.findOrFail(expired.body().invitation.id)
    expiredRecord.expires_at = DateTime.now().minus({ minute: 1 })
    await expiredRecord.save()

    const expiredAccept = await client
      .post('/api/v1/organization-invitations/accept')
      .loginAs(expiredInvitee)
      .json({ token: expiredToken })
    expiredAccept.assertStatus(400)
  })

  test('reactivates a removed membership but not a suspended one', async ({ client, assert }) => {
    const tenant = await createOperation('membership-reactivation')
    const owner = await createUser({ prefix: 'reactivation-owner', tenant })
    const removedUser = await createUser({ prefix: 'removed-user', tenant })
    const suspendedUser = await createUser({ prefix: 'suspended-user', tenant })
    const organization = await createOrganization({ tenant, owner, prefix: 'Reactivation' })
    await addOrganizationMember({
      tenant,
      organization,
      user: removedUser,
      role: 'analyst',
      status: 'removed',
    })
    await addOrganizationMember({
      tenant,
      organization,
      user: suspendedUser,
      role: 'editor',
      status: 'suspended',
    })
    const { mails } = mail.fake()

    const removedInvitation = await client
      .post(`/api/v1/organizations/${organization.id}/invitations`)
      .header('x-tenant-id', String(tenant.id))
      .loginAs(owner)
      .json({ email: removedUser.email, role: 'editor' })
    removedInvitation.assertStatus(201)
    const removedToken = (
      mails.sent()[0] as OrganizationInvitationNotification
    ).getInvitationToken()

    const removedAccept = await client
      .post('/api/v1/organization-invitations/accept')
      .loginAs(removedUser)
      .json({ token: removedToken })
    removedAccept.assertStatus(200)

    const reactivated = await OrganizationMember.query()
      .where('organization_id', organization.id)
      .where('user_id', removedUser.id)
      .firstOrFail()
    assert.equal(reactivated.status, 'active')
    assert.equal(reactivated.role, 'editor')
    assert.isNull(reactivated.removed_at)

    const suspendedInvitation = await client
      .post(`/api/v1/organizations/${organization.id}/invitations`)
      .header('x-tenant-id', String(tenant.id))
      .loginAs(owner)
      .json({ email: suspendedUser.email, role: 'editor' })
    suspendedInvitation.assertStatus(201)
    const suspendedToken = (
      mails.sent()[1] as OrganizationInvitationNotification
    ).getInvitationToken()

    const suspendedAccept = await client
      .post('/api/v1/organization-invitations/accept')
      .loginAs(suspendedUser)
      .json({ token: suspendedToken })
    suspendedAccept.assertStatus(400)
  })

  test('keeps an invitation persisted when SMTP delivery fails', async ({
    client,
    assert,
    cleanup,
  }) => {
    const tenant = await createOperation('invitation-delivery-failure')
    const owner = await createUser({ prefix: 'delivery-owner', tenant })
    const invitee = await createUser({ prefix: 'delivery-invitee' })
    const organization = await createOrganization({ tenant, owner, prefix: 'Delivery failure' })
    const mutableMail = mail as unknown as { send: typeof mail.send }
    const originalSend = mutableMail.send
    mutableMail.send = (() => Promise.reject(new Error('SMTP unavailable'))) as typeof mail.send
    cleanup(() => {
      mutableMail.send = originalSend
    })

    const response = await client
      .post(`/api/v1/organizations/${organization.id}/invitations`)
      .header('x-tenant-id', String(tenant.id))
      .loginAs(owner)
      .json({ email: invitee.email, role: 'analyst' })

    response.assertStatus(201)
    assert.isFalse(response.body().email_sent)
    assert.isNotNull(await OrganizationInvitation.find(response.body().invitation.id))
  })

  test('organization admin cannot invite owner or admin', async ({ client }) => {
    const tenant = await createOperation('invitation-role-policy')
    const owner = await createUser({ prefix: 'role-owner', tenant })
    const admin = await createUser({ prefix: 'role-admin', tenant })
    const invitee = await createUser({ prefix: 'role-invitee' })
    const organization = await createOrganization({ tenant, owner, prefix: 'Role policy' })
    await addOrganizationMember({ tenant, organization, user: admin, role: 'admin' })

    for (const role of ['owner', 'admin'] as const) {
      const response = await client
        .post(`/api/v1/organizations/${organization.id}/invitations`)
        .header('x-tenant-id', String(tenant.id))
        .loginAs(admin)
        .json({ email: invitee.email, role })
      response.assertStatus(403)
    }
  })
})
