import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { test } from '@japa/runner'

import Establishment from '#modules/establishments/models/establishment'
import EstablishmentRevision from '#modules/establishments/models/establishment_revision'
import EstablishmentRevisionAddress from '#modules/establishments/models/establishment_revision_address'
import EstablishmentRevisionAttributeValue from '#modules/establishments/models/establishment_revision_attribute_value'
import EstablishmentRevisionCategory from '#modules/establishments/models/establishment_revision_category'
import EstablishmentRevisionHour from '#modules/establishments/models/establishment_revision_hour'
import EstablishmentRevisionSpecialDay from '#modules/establishments/models/establishment_revision_special_day'
import CategoryAttributeDefinition from '#modules/taxonomy/models/category_attribute_definition'
import CategoryAttributeOption from '#modules/taxonomy/models/category_attribute_option'
import { addOrganizationMember, createUser } from '#tests/functional/organizations/helpers'
import { createEstablishmentScenario } from '#tests/functional/establishments/helpers'

const tenantHeader = (tenantId: number) => ({ 'x-tenant-id': String(tenantId) })

async function findDraft(establishmentId: number): Promise<EstablishmentRevision> {
  return EstablishmentRevision.query()
    .where('establishment_id', establishmentId)
    .where('status', 'draft')
    .firstOrFail()
}

test.group('Establishments', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('creates a stable identity and normalized draft atomically', async ({ client, assert }) => {
    const scenario = await createEstablishmentScenario('create')

    const response = await client
      .post(`/api/v1/organizations/${scenario.organization.id}/establishments`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({
        public_name: '  Café Aurora  ',
        city_id: scenario.city.id,
        short_description: '  Cafés especiais e confeitaria artesanal.  ',
        public_email: '  CONTATO@EXAMPLE.COM  ',
        public_phone: '(43) 99999-0000',
        whatsapp: '(43) 98888-0000',
        website: '  https://cafe-aurora.example  ',
        instagram: ' @Cafe.Aurora ',
        availability_type: 'regular_hours',
      })

    response.assertStatus(201)
    const establishment = await Establishment.findOrFail(response.body().id)
    const revision = await findDraft(establishment.id)

    assert.equal(establishment.tenant_id, scenario.tenant.id)
    assert.equal(establishment.organization_id, scenario.organization.id)
    assert.equal(establishment.lifecycle_status, 'active')
    assert.equal(establishment.business_status, 'open')
    assert.isNull(establishment.published_revision_id)
    assert.equal(revision.version, 1)
    assert.equal(revision.public_name, 'Café Aurora')
    assert.equal(revision.slug, 'cafe-aurora')
    assert.equal(revision.short_description, 'Cafés especiais e confeitaria artesanal.')
    assert.equal(revision.public_email, 'contato@example.com')
    assert.equal(revision.public_phone, '43999990000')
    assert.equal(revision.whatsapp, '43988880000')
    assert.equal(revision.website, 'https://cafe-aurora.example')
    assert.equal(revision.instagram, 'cafe.aurora')
    assert.equal(revision.availability_type, 'regular_hours')

    const duplicate = await client
      .post(`/api/v1/organizations/${scenario.organization.id}/establishments`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({
        public_name: 'Café Aurora',
        city_id: scenario.city.id,
      })

    duplicate.assertStatus(201)
    const duplicateRevision = await findDraft(duplicate.body().id)
    assert.equal(duplicateRevision.slug, 'cafe-aurora-2')
  })

  test('hides foreign units and enforces organization capabilities', async ({ client }) => {
    const scenario = await createEstablishmentScenario('access')
    const created = await client
      .post(`/api/v1/organizations/${scenario.organization.id}/establishments`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({ public_name: 'Unidade Protegida', city_id: scenario.city.id })
    created.assertStatus(201)

    const outsider = await createUser({ prefix: 'unit-outsider', tenant: scenario.tenant })
    const hidden = await client
      .get(`/api/v1/establishments/${created.body().id}`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(outsider)
    hidden.assertStatus(404)

    const analyst = await createUser({ prefix: 'unit-analyst', tenant: scenario.tenant })
    await addOrganizationMember({
      tenant: scenario.tenant,
      organization: scenario.organization,
      user: analyst,
      role: 'analyst',
    })
    const readable = await client
      .get(`/api/v1/establishments/${created.body().id}`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(analyst)
    readable.assertStatus(200)

    const analystEdit = await client
      .put(`/api/v1/establishments/${created.body().id}/revision`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(analyst)
      .json({ short_description: 'Tentativa sem capacidade' })
    analystEdit.assertStatus(403)

    const editor = await createUser({ prefix: 'unit-editor', tenant: scenario.tenant })
    await addOrganizationMember({
      tenant: scenario.tenant,
      organization: scenario.organization,
      user: editor,
      role: 'editor',
    })
    const editorEdit = await client
      .put(`/api/v1/establishments/${created.body().id}/revision`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(editor)
      .json({ short_description: 'Atualização autorizada' })
    editorEdit.assertStatus(200)
  })

  test('persists revision sections and rejects inconsistent inputs', async ({ client, assert }) => {
    const scenario = await createEstablishmentScenario('sections')
    const created = await client
      .post(`/api/v1/organizations/${scenario.organization.id}/establishments`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({
        public_name: 'Café das Seções',
        city_id: scenario.city.id,
        description: 'Uma cafeteria completa.',
        public_phone: '(43) 99999-1000',
        availability_type: 'regular_hours',
      })
    created.assertStatus(201)
    const establishmentId = created.body().id
    const revision = await findDraft(establishmentId)

    const partialCoordinates = await client
      .put(`/api/v1/establishments/${establishmentId}/address`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({
        street: 'Rua das Flores',
        number: '100',
        district: 'Centro',
        latitude: -23.18,
      })
    partialCoordinates.assertStatus(400)

    const address = await client
      .put(`/api/v1/establishments/${establishmentId}/address`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({
        postal_code: '86300-000',
        street: ' Rua das Flores ',
        number: '100',
        district: ' Centro ',
        latitude: -23.18,
        longitude: -50.65,
        coordinate_source: 'manual',
      })
    address.assertStatus(200)

    const duplicateCategories = await client
      .put(`/api/v1/establishments/${establishmentId}/categories`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({
        categories: [
          { category_id: scenario.primaryCategory.id, is_primary: true },
          { category_id: scenario.primaryCategory.id, is_primary: false },
        ],
      })
    duplicateCategories.assertStatus(400)

    const redundantHierarchy = await client
      .put(`/api/v1/establishments/${establishmentId}/categories`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({
        categories: [
          { category_id: scenario.primaryCategory.id, is_primary: true, sort_order: 0 },
          { category_id: scenario.parentCategory.id, is_primary: false, sort_order: 1 },
        ],
      })
    redundantHierarchy.assertStatus(400)

    const categories = await client
      .put(`/api/v1/establishments/${establishmentId}/categories`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({
        categories: [{ category_id: scenario.primaryCategory.id, is_primary: true, sort_order: 0 }],
      })
    categories.assertStatus(200)

    const effective = await client
      .get(`/api/v1/taxonomy/categories/${scenario.primaryCategory.id}/effective-attributes`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
    effective.assertStatus(200)
    assert.includeMembers(
      effective.body().map((item: { id: number }) => item.id),
      [scenario.inheritedBoolean.id, scenario.selectDefinition.id]
    )

    const foreignDefinition = await CategoryAttributeDefinition.create({
      tenant_id: scenario.tenant.id,
      category_id: scenario.parentCategory.id,
      key: 'foreign_select',
      name: 'Outro select',
      description: null,
      data_type: 'single_select',
      unit: null,
      is_required: false,
      is_filterable: false,
      is_public: true,
      applies_to_descendants: true,
      sort_order: 5,
      is_active: true,
      validation_rules: {},
    })
    const foreignOption = await CategoryAttributeOption.create({
      tenant_id: scenario.tenant.id,
      attribute_definition_id: foreignDefinition.id,
      label: 'Inválida',
      value: 'invalid',
      sort_order: 0,
      is_active: true,
    })

    const invalidOption = await client
      .put(`/api/v1/establishments/${establishmentId}/attributes`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({
        attributes: [
          {
            attribute_definition_id: scenario.selectDefinition.id,
            option_ids: [foreignOption.id],
          },
        ],
      })
    invalidOption.assertStatus(400)

    const attributes = await client
      .put(`/api/v1/establishments/${establishmentId}/attributes`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({
        attributes: [
          { attribute_definition_id: scenario.inheritedBoolean.id, value: true },
          {
            attribute_definition_id: scenario.selectDefinition.id,
            option_ids: [scenario.standardOption.id],
          },
        ],
      })
    attributes.assertStatus(200)

    const overlappingHours = await client
      .put(`/api/v1/establishments/${establishmentId}/hours`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({
        hours: [
          { weekday: 1, opens_at: '08:00', closes_at: '12:00' },
          { weekday: 1, opens_at: '11:00', closes_at: '18:00' },
        ],
      })
    overlappingHours.assertStatus(400)

    const hours = await client
      .put(`/api/v1/establishments/${establishmentId}/hours`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({
        hours: [
          { weekday: 1, opens_at: '08:00', closes_at: '12:00', sort_order: 0 },
          { weekday: 1, opens_at: '13:00', closes_at: '18:00', sort_order: 1 },
          {
            weekday: 5,
            opens_at: '20:00',
            closes_at: '02:00',
            spans_next_day: true,
          },
        ],
      })
    hours.assertStatus(200)

    const invalidSpecialDay = await client
      .put(`/api/v1/establishments/${establishmentId}/special-days`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({
        special_days: [
          {
            date: '2026-12-25',
            status: 'closed',
            intervals: [{ opens_at: '10:00', closes_at: '12:00' }],
          },
        ],
      })
    invalidSpecialDay.assertStatus(400)

    const specialDays = await client
      .put(`/api/v1/establishments/${establishmentId}/special-days`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({
        special_days: [
          { date: '2026-12-25', status: 'closed', note: 'Natal' },
          {
            date: '2026-12-31',
            status: 'custom_hours',
            intervals: [{ opens_at: '09:00', closes_at: '14:00' }],
          },
        ],
      })
    specialDays.assertStatus(200)

    assert.equal(
      await EstablishmentRevisionAddress.query()
        .where('revision_id', revision.id)
        .count('* as total')
        .first()
        .then((row) => Number(row?.$extras.total ?? 0)),
      1
    )
    assert.equal(
      await EstablishmentRevisionCategory.query()
        .where('revision_id', revision.id)
        .count('* as total')
        .first()
        .then((row) => Number(row?.$extras.total ?? 0)),
      1
    )
    assert.equal(
      await EstablishmentRevisionAttributeValue.query()
        .where('revision_id', revision.id)
        .count('* as total')
        .first()
        .then((row) => Number(row?.$extras.total ?? 0)),
      2
    )
    assert.equal(
      await EstablishmentRevisionHour.query()
        .where('revision_id', revision.id)
        .count('* as total')
        .first()
        .then((row) => Number(row?.$extras.total ?? 0)),
      3
    )
    assert.equal(
      await EstablishmentRevisionSpecialDay.query()
        .where('revision_id', revision.id)
        .count('* as total')
        .first()
        .then((row) => Number(row?.$extras.total ?? 0)),
      2
    )
  })

  test('reports EP-03 completeness independently from future media', async ({ client, assert }) => {
    const scenario = await createEstablishmentScenario('completeness')
    const created = await client
      .post(`/api/v1/organizations/${scenario.organization.id}/establishments`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({
        public_name: 'Café Completo',
        city_id: scenario.city.id,
        description: 'Descrição pública completa.',
        public_phone: '(43) 99999-2000',
        availability_type: 'regular_hours',
      })
    created.assertStatus(201)
    const establishmentId = created.body().id

    const initial = await client
      .get(`/api/v1/establishments/${establishmentId}/completeness`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
    initial.assertStatus(200)
    assert.isFalse(initial.body().eligible)
    assert.includeMembers(
      initial.body().blocking_issues.map((issue: { code: string }) => issue.code),
      ['address_missing', 'coordinates_missing', 'primary_category_missing', 'weekly_hours_missing']
    )

    await client
      .put(`/api/v1/establishments/${establishmentId}/address`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({
        street: 'Rua Principal',
        number: '10',
        district: 'Centro',
        latitude: -23.18,
        longitude: -50.65,
        coordinate_source: 'manual',
      })
      .then((response) => response.assertStatus(200))

    await client
      .put(`/api/v1/establishments/${establishmentId}/categories`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({ categories: [{ category_id: scenario.primaryCategory.id, is_primary: true }] })
      .then((response) => response.assertStatus(200))

    await client
      .put(`/api/v1/establishments/${establishmentId}/attributes`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({
        attributes: [
          { attribute_definition_id: scenario.inheritedBoolean.id, value: true },
          {
            attribute_definition_id: scenario.selectDefinition.id,
            option_ids: [scenario.premiumOption.id],
          },
        ],
      })
      .then((response) => response.assertStatus(200))

    await client
      .put(`/api/v1/establishments/${establishmentId}/hours`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({ hours: [{ weekday: 1, opens_at: '08:00', closes_at: '18:00' }] })
      .then((response) => response.assertStatus(200))

    const complete = await client
      .get(`/api/v1/establishments/${establishmentId}/completeness`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
    complete.assertStatus(200)
    assert.isFalse(complete.body().eligible)
    assert.equal(complete.body().score, 90)
    assert.deepEqual(
      complete.body().blocking_issues.map((issue: { code: string }) => issue.code),
      ['media_missing']
    )
    assert.equal(complete.body().rules_version, 2)
  })

  test('separates business status changes from lifecycle management', async ({ client }) => {
    const scenario = await createEstablishmentScenario('lifecycle')
    const created = await client
      .post(`/api/v1/organizations/${scenario.organization.id}/establishments`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({ public_name: 'Unidade Operacional', city_id: scenario.city.id })
    created.assertStatus(201)
    const establishmentId = created.body().id

    const editor = await createUser({ prefix: 'status-editor', tenant: scenario.tenant })
    await addOrganizationMember({
      tenant: scenario.tenant,
      organization: scenario.organization,
      user: editor,
      role: 'editor',
    })

    const temporaryClose = await client
      .patch(`/api/v1/establishments/${establishmentId}/business-status`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(editor)
      .json({ business_status: 'temporarily_closed' })
    temporaryClose.assertStatus(200)

    const permanentByEditor = await client
      .patch(`/api/v1/establishments/${establishmentId}/business-status`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(editor)
      .json({ business_status: 'permanently_closed' })
    permanentByEditor.assertStatus(403)

    const permanentByOwner = await client
      .patch(`/api/v1/establishments/${establishmentId}/business-status`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({ business_status: 'permanently_closed' })
    permanentByOwner.assertStatus(200)

    const archiveByEditor = await client
      .delete(`/api/v1/establishments/${establishmentId}`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(editor)
    archiveByEditor.assertStatus(403)

    const archiveByOwner = await client
      .delete(`/api/v1/establishments/${establishmentId}`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
    archiveByOwner.assertStatus(204)

    const statusAfterArchive = await client
      .patch(`/api/v1/establishments/${establishmentId}/business-status`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({ business_status: 'open' })
    statusAfterArchive.assertStatus(400)
  })

  test('enforces one open revision and tenant-safe revision children in the database', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('constraints')
    const created = await client
      .post(`/api/v1/organizations/${scenario.organization.id}/establishments`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({ public_name: 'Unidade Constraint', city_id: scenario.city.id })
    created.assertStatus(201)

    const establishment = await Establishment.findOrFail(created.body().id)
    const revision = await findDraft(establishment.id)

    await assert.rejects(() =>
      db.transaction(async (transaction) => {
        await transaction.table('establishment_revisions').insert({
          tenant_id: scenario.tenant.id,
          establishment_id: establishment.id,
          version: 2,
          status: 'changes_requested',
          city_id: scenario.city.id,
          public_name: 'Outra revisão aberta',
          slug: 'outra-revisao-aberta',
          availability_type: 'regular_hours',
          rules_version: 2,
          created_by: scenario.owner.id,
          submitted_at: new Date(),
          reviewed_by: scenario.owner.id,
          reviewed_at: new Date(),
          created_at: new Date(),
          updated_at: new Date(),
        })
      })
    )

    const foreign = await createEstablishmentScenario('foreign-constraint')
    await assert.rejects(() =>
      db.transaction(async (transaction) => {
        await transaction.table('establishment_revision_addresses').insert({
          tenant_id: foreign.tenant.id,
          revision_id: revision.id,
          street: 'Rua impossível',
          number: '1',
          without_number: false,
          district: 'Centro',
          created_at: new Date(),
          updated_at: new Date(),
        })
      })
    )
  })
})
