import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

import Organization from '#modules/organizations/models/organization'
import OrganizationMember from '#modules/organizations/models/organization_member'
import IRole from '#modules/roles/interfaces/role_interface'
import {
  addOrganizationMember,
  createOperation,
  createOrganization,
  createUser,
  generateCnpj,
  organizationPayload,
} from './helpers.js'

test.group('Organizations', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('creates a normalized draft and its owner atomically', async ({ client, assert }) => {
    const tenant = await createOperation('create-organization')
    const owner = await createUser({ prefix: 'owner', tenant })
    const payload = organizationPayload()

    const response = await client
      .post('/api/v1/organizations')
      .header('x-tenant-id', String(tenant.id))
      .loginAs(owner)
      .json({
        ...payload,
        status: 'active',
        reviewed_by: owner.id,
      })

    response.assertStatus(201)
    assert.equal(response.body().status, 'draft')
    assert.equal(response.body().tax_id, generateCnpj('123456780001'))
    assert.equal(response.body().phone, '43999990000')
    assert.equal(response.body().slug, 'experimente-cafe')
    assert.isNull(response.body().reviewed_by)

    const organization = await Organization.findOrFail(response.body().id)
    const members = await OrganizationMember.query()
      .where('organization_id', organization.id)
      .where('tenant_id', tenant.id)

    assert.lengthOf(members, 1)
    assert.equal(members[0].user_id, owner.id)
    assert.equal(members[0].role, 'owner')
    assert.equal(members[0].status, 'active')
  })

  test('rejects invalid or duplicate CNPJ in one operation and allows it in another', async ({
    client,
    assert,
  }) => {
    const firstTenant = await createOperation('first-operation')
    const secondTenant = await createOperation('second-operation')
    const firstOwner = await createUser({ prefix: 'first-owner', tenant: firstTenant })
    const secondOwner = await createUser({ prefix: 'second-owner', tenant: secondTenant })
    const payload = organizationPayload('223456780001')

    const invalid = await client
      .post('/api/v1/organizations')
      .header('x-tenant-id', String(firstTenant.id))
      .loginAs(firstOwner)
      .json({ ...payload, tax_id: '11.111.111/1111-11' })
    invalid.assertStatus(400)

    const first = await client
      .post('/api/v1/organizations')
      .header('x-tenant-id', String(firstTenant.id))
      .loginAs(firstOwner)
      .json(payload)
    first.assertStatus(201)

    const duplicate = await client
      .post('/api/v1/organizations')
      .header('x-tenant-id', String(firstTenant.id))
      .loginAs(firstOwner)
      .json({
        ...payload,
        trade_name: 'Outra unidade legal',
        email: 'outra@example.com',
      })
    duplicate.assertStatus(400)

    const isolated = await client
      .post('/api/v1/organizations')
      .header('x-tenant-id', String(secondTenant.id))
      .loginAs(secondOwner)
      .json(payload)
    isolated.assertStatus(201)

    assert.equal(first.body().tax_id, isolated.body().tax_id)
  })

  test('hides private organizations from users without membership', async ({ client, assert }) => {
    const tenant = await createOperation('idor-operation')
    const owner = await createUser({ prefix: 'idor-owner', tenant })
    const outsider = await createUser({ prefix: 'idor-outsider', tenant })
    const organization = await createOrganization({ tenant, owner, prefix: 'Private' })

    const show = await client
      .get(`/api/v1/organizations/${organization.id}`)
      .header('x-tenant-id', String(tenant.id))
      .loginAs(outsider)
    show.assertStatus(404)

    const update = await client
      .put(`/api/v1/organizations/${organization.id}`)
      .header('x-tenant-id', String(tenant.id))
      .loginAs(outsider)
      .json({ trade_name: 'IDOR attempt' })
    update.assertStatus(404)

    const outsiderList = await client
      .get('/api/v1/organizations')
      .header('x-tenant-id', String(tenant.id))
      .loginAs(outsider)
    outsiderList.assertStatus(200)
    assert.lengthOf(outsiderList.body(), 0)

    const ownerList = await client
      .get('/api/v1/organizations')
      .header('x-tenant-id', String(tenant.id))
      .loginAs(owner)
    ownerList.assertStatus(200)
    assert.deepEqual(
      ownerList.body().map((item: { id: number }) => item.id),
      [organization.id]
    )
  })

  test('enforces organization edit policy beyond the global USER permission', async ({
    client,
    assert,
  }) => {
    const tenant = await createOperation('organization-policy')
    const owner = await createUser({ prefix: 'policy-owner', tenant })
    const organization = await createOrganization({ tenant, owner, prefix: 'Policy' })
    const organizationAdmin = await createUser({ prefix: 'policy-org-admin', tenant })
    const editor = await createUser({ prefix: 'policy-editor', tenant })
    const analyst = await createUser({ prefix: 'policy-analyst', tenant })
    const platformAdmin = await createUser({
      prefix: 'policy-platform-admin',
      tenant,
      globalRole: IRole.Slugs.ADMIN,
    })
    const platformRoot = await createUser({
      prefix: 'policy-platform-root',
      tenant,
      globalRole: IRole.Slugs.ROOT,
    })

    await addOrganizationMember({ tenant, organization, user: organizationAdmin, role: 'admin' })
    await addOrganizationMember({ tenant, organization, user: editor, role: 'editor' })
    await addOrganizationMember({ tenant, organization, user: analyst, role: 'analyst' })

    for (const actor of [editor, analyst]) {
      const denied = await client
        .put(`/api/v1/organizations/${organization.id}`)
        .header('x-tenant-id', String(tenant.id))
        .loginAs(actor)
        .json({ trade_name: `Denied ${actor.id}` })

      denied.assertStatus(403)
    }

    for (const actor of [owner, organizationAdmin, platformAdmin, platformRoot]) {
      const allowed = await client
        .put(`/api/v1/organizations/${organization.id}`)
        .header('x-tenant-id', String(tenant.id))
        .loginAs(actor)
        .json({ trade_name: `Allowed ${actor.id}` })

      allowed.assertStatus(200)
      assert.equal(allowed.body().trade_name, `Allowed ${actor.id}`)
    }
  })

  test('enforces the review workflow and protects legal data after approval', async ({
    client,
    assert,
  }) => {
    const tenant = await createOperation('workflow-operation')
    const owner = await createUser({ prefix: 'workflow-owner', tenant })
    const moderator = await createUser({
      prefix: 'workflow-moderator',
      tenant,
      globalRole: IRole.Slugs.MODERATOR,
    })
    const organization = await createOrganization({ tenant, owner, prefix: 'Workflow' })

    const submit = await client
      .post(`/api/v1/organizations/${organization.id}/submit`)
      .header('x-tenant-id', String(tenant.id))
      .loginAs(owner)
    submit.assertStatus(200)
    assert.equal(submit.body().status, 'pending_review')
    assert.exists(submit.body().submitted_at)

    const pendingEdit = await client
      .put(`/api/v1/organizations/${organization.id}`)
      .header('x-tenant-id', String(tenant.id))
      .loginAs(owner)
      .json({ trade_name: 'Must not change while pending' })
    pendingEdit.assertStatus(400)

    const approve = await client
      .post(`/api/v1/admin/organizations/${organization.id}/approve`)
      .header('x-tenant-id', String(tenant.id))
      .loginAs(moderator)
      .json({ reason: 'Cadastro e documentos conferidos' })
    approve.assertStatus(200)
    assert.equal(approve.body().status, 'active')
    assert.equal(approve.body().reviewed_by, moderator.id)

    const commercialEdit = await client
      .put(`/api/v1/organizations/${organization.id}`)
      .header('x-tenant-id', String(tenant.id))
      .loginAs(owner)
      .json({ trade_name: 'Workflow Atualizada' })
    commercialEdit.assertStatus(200)
    assert.equal(commercialEdit.body().trade_name, 'Workflow Atualizada')

    const legalEdit = await client
      .put(`/api/v1/organizations/${organization.id}`)
      .header('x-tenant-id', String(tenant.id))
      .loginAs(owner)
      .json({ legal_name: 'Outra Razão Social Ltda' })
    legalEdit.assertStatus(400)
  })

  test('requires a reason and rejects invalid state transitions', async ({ client }) => {
    const tenant = await createOperation('invalid-workflow')
    const owner = await createUser({ prefix: 'invalid-owner', tenant })
    const moderator = await createUser({
      prefix: 'invalid-moderator',
      tenant,
      globalRole: IRole.Slugs.MODERATOR,
    })
    const organization = await createOrganization({ tenant, owner, prefix: 'Invalid workflow' })

    const approveDraft = await client
      .post(`/api/v1/admin/organizations/${organization.id}/approve`)
      .header('x-tenant-id', String(tenant.id))
      .loginAs(moderator)
      .json({ reason: 'Tentativa inválida' })
    approveDraft.assertStatus(400)

    await client
      .post(`/api/v1/organizations/${organization.id}/submit`)
      .header('x-tenant-id', String(tenant.id))
      .loginAs(owner)

    const missingReason = await client
      .post(`/api/v1/admin/organizations/${organization.id}/reject`)
      .header('Accept', 'application/json')
      .header('x-tenant-id', String(tenant.id))
      .loginAs(moderator)
      .json({ reason: '' })
    missingReason.assertStatus(422)
  })
})
