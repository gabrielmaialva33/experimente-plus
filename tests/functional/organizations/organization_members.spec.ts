import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

import OrganizationMember from '#modules/organizations/models/organization_member'
import {
  addOrganizationMember,
  createOperation,
  createOrganization,
  createUser,
} from './helpers.js'

test.group('Organization members', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('never removes, suspends or demotes the last active owner', async ({ client }) => {
    const tenant = await createOperation('last-owner')
    const owner = await createUser({ prefix: 'last-owner-user', tenant })
    const organization = await createOrganization({ tenant, owner, prefix: 'Last owner' })
    const membership = await OrganizationMember.findByOrFail('user_id', owner.id)

    const demote = await client
      .patch(`/api/v1/organizations/${organization.id}/members/${membership.id}`)
      .header('x-tenant-id', String(tenant.id))
      .loginAs(owner)
      .json({ role: 'admin' })
    demote.assertStatus(400)

    const suspend = await client
      .patch(`/api/v1/organizations/${organization.id}/members/${membership.id}`)
      .header('x-tenant-id', String(tenant.id))
      .loginAs(owner)
      .json({ status: 'suspended' })
    suspend.assertStatus(400)

    const remove = await client
      .delete(`/api/v1/organizations/${organization.id}/members/${membership.id}`)
      .header('x-tenant-id', String(tenant.id))
      .loginAs(owner)
    remove.assertStatus(400)
  })

  test('allows owner changes when another active owner remains', async ({ client, assert }) => {
    const tenant = await createOperation('multiple-owners')
    const firstOwner = await createUser({ prefix: 'first-owner', tenant })
    const secondOwner = await createUser({ prefix: 'second-owner', tenant })
    const organization = await createOrganization({
      tenant,
      owner: firstOwner,
      prefix: 'Multiple owners',
    })
    const secondMembership = await addOrganizationMember({
      tenant,
      organization,
      user: secondOwner,
      role: 'owner',
    })

    const response = await client
      .patch(`/api/v1/organizations/${organization.id}/members/${secondMembership.id}`)
      .header('x-tenant-id', String(tenant.id))
      .loginAs(firstOwner)
      .json({ role: 'admin' })

    response.assertStatus(200)
    assert.equal(response.body().role, 'admin')
    assert.equal(response.body().status, 'active')
  })

  test('organization admin cannot manage an owner', async ({ client }) => {
    const tenant = await createOperation('admin-owner-boundary')
    const owner = await createUser({ prefix: 'boundary-owner', tenant })
    const admin = await createUser({ prefix: 'boundary-admin', tenant })
    const organization = await createOrganization({ tenant, owner, prefix: 'Boundary' })
    const ownerMembership = await OrganizationMember.findByOrFail('user_id', owner.id)
    await addOrganizationMember({ tenant, organization, user: admin, role: 'admin' })

    const removeOwner = await client
      .delete(`/api/v1/organizations/${organization.id}/members/${ownerMembership.id}`)
      .header('x-tenant-id', String(tenant.id))
      .loginAs(admin)
    removeOwner.assertStatus(403)

    const demoteOwner = await client
      .patch(`/api/v1/organizations/${organization.id}/members/${ownerMembership.id}`)
      .header('x-tenant-id', String(tenant.id))
      .loginAs(admin)
      .json({ role: 'editor' })
    demoteOwner.assertStatus(403)
  })

  test('organization admin may manage editor and analyst memberships only', async ({
    client,
    assert,
  }) => {
    const tenant = await createOperation('admin-limited-management')
    const owner = await createUser({ prefix: 'limited-owner', tenant })
    const admin = await createUser({ prefix: 'limited-admin', tenant })
    const editor = await createUser({ prefix: 'limited-editor', tenant })
    const organization = await createOrganization({ tenant, owner, prefix: 'Limited roles' })
    await addOrganizationMember({ tenant, organization, user: admin, role: 'admin' })
    const editorMembership = await addOrganizationMember({
      tenant,
      organization,
      user: editor,
      role: 'editor',
    })

    const update = await client
      .patch(`/api/v1/organizations/${organization.id}/members/${editorMembership.id}`)
      .header('x-tenant-id', String(tenant.id))
      .loginAs(admin)
      .json({ role: 'analyst' })
    update.assertStatus(200)
    assert.equal(update.body().role, 'analyst')

    const promote = await client
      .patch(`/api/v1/organizations/${organization.id}/members/${editorMembership.id}`)
      .header('x-tenant-id', String(tenant.id))
      .loginAs(admin)
      .json({ role: 'owner' })
    promote.assertStatus(403)
  })
})
