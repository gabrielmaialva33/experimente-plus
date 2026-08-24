import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

import OrganizationClaim from '#modules/organizations/models/organization_claim'
import OrganizationMember from '#modules/organizations/models/organization_member'
import IRole from '#modules/roles/interfaces/role_interface'
import {
  addOrganizationMember,
  createOperation,
  createOrganization,
  createUser,
} from './helpers.js'

test.group('Organization claims', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('approves one claim atomically and rejects competing claims', async ({ client, assert }) => {
    const tenant = await createOperation('claim-operation')
    const firstClaimant = await createUser({ prefix: 'first-claimant', tenant })
    const secondClaimant = await createUser({ prefix: 'second-claimant', tenant })
    const moderator = await createUser({
      prefix: 'claim-moderator',
      tenant,
      globalRole: IRole.Slugs.MODERATOR,
    })
    const organization = await createOrganization({
      tenant,
      owner: null,
      status: 'active',
      prefix: 'Unclaimed',
    })

    const first = await client
      .post(`/api/v1/organizations/${organization.id}/claims`)
      .header('x-tenant-id', String(tenant.id))
      .loginAs(firstClaimant)
      .json({
        message: 'Sou o responsável legal pelo estabelecimento.',
        evidence: { description: 'Contrato social disponível para conferência.' },
      })
    first.assertStatus(201)

    const second = await client
      .post(`/api/v1/organizations/${organization.id}/claims`)
      .header('x-tenant-id', String(tenant.id))
      .loginAs(secondClaimant)
      .json({ message: 'Também solicito a análise da representação.' })
    second.assertStatus(201)

    const approve = await client
      .post(`/api/v1/admin/organization-claims/${first.body().id}/approve`)
      .header('x-tenant-id', String(tenant.id))
      .loginAs(moderator)
      .json({ reason: 'Representação legal confirmada pela moderação' })
    approve.assertStatus(200)
    assert.equal(approve.body().status, 'approved')

    const approved = await OrganizationClaim.findOrFail(first.body().id)
    const rejectedCompetitor = await OrganizationClaim.findOrFail(second.body().id)
    assert.equal(approved.status, 'approved')
    assert.equal(approved.reviewed_by, moderator.id)
    assert.equal(rejectedCompetitor.status, 'rejected')
    assert.equal(rejectedCompetitor.reviewed_by, moderator.id)

    const owners = await OrganizationMember.query()
      .where('organization_id', organization.id)
      .where('role', 'owner')
      .where('status', 'active')
    assert.lengthOf(owners, 1)
    assert.equal(owners[0].user_id, firstClaimant.id)

    const replay = await client
      .post(`/api/v1/admin/organization-claims/${first.body().id}/approve`)
      .header('x-tenant-id', String(tenant.id))
      .loginAs(moderator)
      .json({ reason: 'Tentativa repetida' })
    replay.assertStatus(400)
  })

  test('rejects claims when an active owner already exists', async ({ client }) => {
    const tenant = await createOperation('claimed-operation')
    const owner = await createUser({ prefix: 'claimed-owner', tenant })
    const claimant = await createUser({ prefix: 'blocked-claimant', tenant })
    const organization = await createOrganization({ tenant, owner, status: 'active' })

    const response = await client
      .post(`/api/v1/organizations/${organization.id}/claims`)
      .header('x-tenant-id', String(tenant.id))
      .loginAs(claimant)
      .json({ message: 'Tentativa inválida' })

    response.assertStatus(400)
  })

  test('rejects claims from existing organization members', async ({ client }) => {
    const tenant = await createOperation('member-claim')
    const member = await createUser({ prefix: 'existing-member', tenant })
    const organization = await createOrganization({ tenant, owner: null, status: 'active' })
    await addOrganizationMember({ tenant, organization, user: member, role: 'editor' })

    const response = await client
      .post(`/api/v1/organizations/${organization.id}/claims`)
      .header('x-tenant-id', String(tenant.id))
      .loginAs(member)
      .json({ message: 'Membro não deve reivindicar' })

    response.assertStatus(400)
  })

  test('requires moderator permission and a review reason', async ({ client }) => {
    const tenant = await createOperation('claim-review-permission')
    const claimant = await createUser({ prefix: 'review-claimant', tenant })
    const regularUser = await createUser({ prefix: 'regular-reviewer', tenant })
    const moderator = await createUser({
      prefix: 'proper-reviewer',
      tenant,
      globalRole: IRole.Slugs.MODERATOR,
    })
    const organization = await createOrganization({ tenant, owner: null, status: 'active' })

    const claim = await client
      .post(`/api/v1/organizations/${organization.id}/claims`)
      .header('x-tenant-id', String(tenant.id))
      .loginAs(claimant)
      .json({ message: 'Pedido para revisão' })
    claim.assertStatus(201)

    const unauthorized = await client
      .post(`/api/v1/admin/organization-claims/${claim.body().id}/reject`)
      .header('x-tenant-id', String(tenant.id))
      .loginAs(regularUser)
      .json({ reason: 'Não deveria ter acesso' })
    unauthorized.assertStatus(403)

    const missingReason = await client
      .post(`/api/v1/admin/organization-claims/${claim.body().id}/reject`)
      .header('Accept', 'application/json')
      .header('x-tenant-id', String(tenant.id))
      .loginAs(moderator)
      .json({ reason: '' })
    missingReason.assertStatus(422)
  })
})
