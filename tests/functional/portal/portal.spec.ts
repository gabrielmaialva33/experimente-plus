import { rm } from 'node:fs/promises'
import { join } from 'node:path'

import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import type { ApiClient } from '@japa/api-client'
import { test } from '@japa/runner'

import EstablishmentRevision from '#modules/establishments/models/establishment_revision'
import EstablishmentRevisionAttributeValue from '#modules/establishments/models/establishment_revision_attribute_value'
import IRoles from '#modules/roles/interfaces/role_interface'
import Category from '#modules/taxonomy/models/category'
import CategoryAttributeDefinition from '#modules/taxonomy/models/category_attribute_definition'
import CategoryAttributeOption from '#modules/taxonomy/models/category_attribute_option'
import {
  createEstablishmentScenario,
  type EstablishmentScenario,
} from '#tests/functional/establishments/helpers'
import { createUser } from '#tests/functional/organizations/helpers'

const mediaFixture = (name: string) => join(process.cwd(), 'tests', 'fixtures', 'media', name)
const tenantHeader = (tenantId: number) => ({ 'x-tenant-id': String(tenantId) })

interface TestInertiaPage {
  component: string
  props: Record<string, unknown>
}

interface EffectiveAttributeProp {
  id: number
  name: string
  data_type: string
  source_category_id: number
  inherited: boolean
  is_required: boolean
  value: string | number | boolean | null
  option_ids: number[]
  options: Array<{ id: number; label: string; value: string }>
}

interface EditorProps {
  effective_attributes: EffectiveAttributeProp[]
  completeness: {
    eligible: boolean
    score: number
    blocking_issues: Array<{ code: string }>
  }
}

interface PortalAttributeFixture {
  parentOverride: CategoryAttributeDefinition
  longText: CategoryAttributeDefinition
  text: CategoryAttributeDefinition
  integer: CategoryAttributeDefinition
  decimal: CategoryAttributeDefinition
  url: CategoryAttributeDefinition
  multiSelect: CategoryAttributeDefinition
  wifiOption: CategoryAttributeOption
  accessibilityOption: CategoryAttributeOption
}

function parseInertiaPage(response: { text(): string }): TestInertiaPage {
  const match = response
    .text()
    .match(/<script data-page="app" type="application\/json">([\s\S]*?)<\/script>/)

  if (!match?.[1]) {
    throw new Error('The response does not contain an Inertia page payload')
  }

  return JSON.parse(match[1]) as TestInertiaPage
}

function parseEditorProps(response: { text(): string }): EditorProps {
  const page = parseInertiaPage(response)
  if (page.component !== 'portal/establishments/edit') {
    throw new Error(`Unexpected Inertia component: ${page.component}`)
  }

  return page.props as unknown as EditorProps
}

function requireEffectiveAttribute(
  attributes: EffectiveAttributeProp[],
  definitionId: number
): EffectiveAttributeProp {
  const attribute = attributes.find((item) => item.id === definitionId)
  if (!attribute) {
    throw new Error(`Effective attribute ${definitionId} was not projected by the Portal`)
  }
  return attribute
}

function requireStoredValue(
  values: EstablishmentRevisionAttributeValue[],
  definitionId: number
): EstablishmentRevisionAttributeValue {
  const value = values.find((item) => item.attribute_definition_id === definitionId)
  if (!value) {
    throw new Error(`Attribute value ${definitionId} was not persisted`)
  }
  return value
}

async function findDraft(establishmentId: number): Promise<EstablishmentRevision> {
  return EstablishmentRevision.query()
    .where('establishment_id', establishmentId)
    .whereIn('status', ['draft', 'changes_requested'])
    .firstOrFail()
}

async function createDraftEstablishment(client: ApiClient, scenario: EstablishmentScenario) {
  const response = await client
    .post(`/api/v1/organizations/${scenario.organization.id}/establishments`)
    .headers(tenantHeader(scenario.tenant.id))
    .loginAs(scenario.owner)
    .json({
      public_name: 'Unidade do portal',
      city_id: scenario.city.id,
      short_description: 'Unidade criada para validar o portal operacional do parceiro.',
      public_phone: '(43) 99999-0000',
      availability_type: 'regular_hours',
    })

  response.assertStatus(201)
  return Number(response.body().id)
}

async function createDefinition(
  scenario: EstablishmentScenario,
  input: {
    categoryId: number
    key: string
    name: string
    dataType: CategoryAttributeDefinition['data_type']
    sortOrder: number
    appliesToDescendants?: boolean
    isRequired?: boolean
  }
): Promise<CategoryAttributeDefinition> {
  return CategoryAttributeDefinition.create({
    tenant_id: scenario.tenant.id,
    category_id: input.categoryId,
    key: input.key,
    name: input.name,
    description: `${input.name} para o teste do editor operacional.`,
    data_type: input.dataType,
    unit: input.dataType === 'decimal' ? 'R$' : null,
    is_required: input.isRequired ?? false,
    is_filterable: false,
    is_public: true,
    applies_to_descendants: input.appliesToDescendants ?? false,
    sort_order: input.sortOrder,
    is_active: true,
    validation_rules: {},
  })
}

async function createPortalAttributeFixture(
  scenario: EstablishmentScenario
): Promise<PortalAttributeFixture> {
  const parentOverride = await createDefinition(scenario, {
    categoryId: scenario.parentCategory.id,
    key: 'editor_description',
    name: 'Descrição herdada',
    dataType: 'text',
    sortOrder: 2,
    appliesToDescendants: true,
  })
  const longText = await createDefinition(scenario, {
    categoryId: scenario.primaryCategory.id,
    key: 'editor_description',
    name: 'Descrição específica',
    dataType: 'long_text',
    sortOrder: 2,
  })
  const text = await createDefinition(scenario, {
    categoryId: scenario.primaryCategory.id,
    key: 'editor_specialty',
    name: 'Especialidade da casa',
    dataType: 'text',
    sortOrder: 3,
  })
  const integer = await createDefinition(scenario, {
    categoryId: scenario.primaryCategory.id,
    key: 'editor_seats',
    name: 'Número de lugares',
    dataType: 'integer',
    sortOrder: 4,
  })
  const decimal = await createDefinition(scenario, {
    categoryId: scenario.primaryCategory.id,
    key: 'editor_average_ticket',
    name: 'Ticket médio',
    dataType: 'decimal',
    sortOrder: 5,
  })
  const url = await createDefinition(scenario, {
    categoryId: scenario.primaryCategory.id,
    key: 'editor_menu_url',
    name: 'Cardápio online',
    dataType: 'url',
    sortOrder: 6,
  })
  const multiSelect = await createDefinition(scenario, {
    categoryId: scenario.primaryCategory.id,
    key: 'editor_amenities',
    name: 'Comodidades',
    dataType: 'multi_select',
    sortOrder: 7,
  })
  const wifiOption = await CategoryAttributeOption.create({
    tenant_id: scenario.tenant.id,
    attribute_definition_id: multiSelect.id,
    label: 'Wi-Fi',
    value: 'wifi',
    sort_order: 0,
    is_active: true,
  })
  const accessibilityOption = await CategoryAttributeOption.create({
    tenant_id: scenario.tenant.id,
    attribute_definition_id: multiSelect.id,
    label: 'Acessibilidade',
    value: 'accessibility',
    sort_order: 1,
    is_active: true,
  })

  return {
    parentOverride,
    longText,
    text,
    integer,
    decimal,
    url,
    multiSelect,
    wifiOption,
    accessibilityOption,
  }
}

test.group('Operational portals', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.teardown(async () => {
    await rm(app.makePath('storage', 'media'), { recursive: true, force: true })
  })

  test('renders the partner overview, organization and establishment editor for members', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('portal-member')
    const establishmentId = await createDraftEstablishment(client, scenario)

    const overview = await client
      .get('/portal')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
    overview.assertStatus(200)
    assert.include(overview.text(), 'portal/index')
    assert.include(overview.text(), scenario.organization.trade_name)
    assert.equal(overview.header('cache-control'), 'private, no-store')
    assert.equal(overview.header('x-robots-tag'), 'noindex, nofollow')

    const organization = await client
      .get(`/portal/organizations/${scenario.organization.id}`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
    organization.assertStatus(200)
    assert.include(organization.text(), 'portal/organizations/show')
    assert.equal(organization.header('cache-control'), 'private, no-store')
    assert.equal(organization.header('x-robots-tag'), 'noindex, nofollow')

    const establishment = await client
      .get(`/portal/establishments/${establishmentId}`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
    establishment.assertStatus(200)
    assert.include(establishment.text(), 'portal/establishments/edit')
    assert.equal(establishment.header('cache-control'), 'private, no-store')
    assert.equal(establishment.header('x-robots-tag'), 'noindex, nofollow')
  })

  test('projects and persists every effective attribute type through the partner editor', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('portal-attributes')
    const fixture = await createPortalAttributeFixture(scenario)
    const establishmentId = await createDraftEstablishment(client, scenario)
    const editorPath = `/portal/establishments/${establishmentId}`

    await client
      .put(`/api/v1/establishments/${establishmentId}/categories`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({ categories: [{ category_id: scenario.primaryCategory.id, is_primary: true }] })
      .then((response) => response.assertStatus(200))

    const before = await client
      .get(editorPath)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
    before.assertStatus(200)

    const beforeProps = parseEditorProps(before)
    const effective = beforeProps.effective_attributes
    assert.lengthOf(effective, 8)
    assert.include(
      beforeProps.completeness.blocking_issues.map((issue) => issue.code),
      'required_attribute_missing'
    )
    assert.include(before.text(), 'Características da categoria')
    assert.include(before.text(), '<textarea')
    assert.include(before.text(), 'type="url"')
    assert.include(before.text(), 'type="number"')
    assert.include(before.text(), 'type="checkbox"')

    const inherited = requireEffectiveAttribute(effective, scenario.inheritedBoolean.id)
    assert.equal(inherited.data_type, 'boolean')
    assert.equal(inherited.source_category_id, scenario.parentCategory.id)
    assert.isTrue(inherited.inherited)
    assert.isTrue(inherited.is_required)

    const singleSelect = requireEffectiveAttribute(effective, scenario.selectDefinition.id)
    assert.equal(singleSelect.data_type, 'single_select')
    assert.equal(singleSelect.source_category_id, scenario.primaryCategory.id)
    assert.isFalse(singleSelect.inherited)
    assert.deepEqual(
      singleSelect.options.map((option) => option.id),
      [scenario.standardOption.id, scenario.premiumOption.id]
    )

    assert.equal(requireEffectiveAttribute(effective, fixture.longText.id).data_type, 'long_text')
    assert.equal(requireEffectiveAttribute(effective, fixture.text.id).data_type, 'text')
    assert.equal(requireEffectiveAttribute(effective, fixture.integer.id).data_type, 'integer')
    assert.equal(requireEffectiveAttribute(effective, fixture.decimal.id).data_type, 'decimal')
    assert.equal(requireEffectiveAttribute(effective, fixture.url.id).data_type, 'url')
    assert.equal(
      requireEffectiveAttribute(effective, fixture.multiSelect.id).data_type,
      'multi_select'
    )
    assert.isFalse(effective.some((attribute) => attribute.id === fixture.parentOverride.id))
    assert.notInclude(before.text(), fixture.parentOverride.name)
    assert.include(before.text(), fixture.longText.name)

    const foreignScenario = await createEstablishmentScenario('portal-foreign-option')
    const invalidOption = await client
      .put(`/api/v1/establishments/${establishmentId}/attributes`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({
        attributes: [
          {
            attribute_definition_id: scenario.selectDefinition.id,
            option_ids: [foreignScenario.premiumOption.id],
          },
        ],
      })
    invalidOption.assertStatus(400)

    const save = await client
      .put(`/portal/establishments/${establishmentId}/attributes`)
      .withCsrfToken()
      .redirects(0)
      .headers({ ...tenantHeader(scenario.tenant.id), referer: editorPath })
      .loginAs(scenario.owner)
      .json({
        attributes: [
          { attribute_definition_id: scenario.inheritedBoolean.id, value: true },
          {
            attribute_definition_id: scenario.selectDefinition.id,
            option_ids: [scenario.premiumOption.id],
          },
          {
            attribute_definition_id: fixture.longText.id,
            value: 'Ambiente tranquilo para encontros.',
          },
          { attribute_definition_id: fixture.text.id, value: '  Café coado  ' },
          { attribute_definition_id: fixture.integer.id, value: 48 },
          { attribute_definition_id: fixture.decimal.id, value: 37.5 },
          { attribute_definition_id: fixture.url.id, value: 'https://example.com/menu' },
          {
            attribute_definition_id: fixture.multiSelect.id,
            option_ids: [fixture.wifiOption.id, fixture.accessibilityOption.id],
          },
        ],
      })
    assert.include([302, 303], save.status())

    const revision = await findDraft(establishmentId)
    const storedValues = await EstablishmentRevisionAttributeValue.query()
      .where('tenant_id', scenario.tenant.id)
      .where('revision_id', revision.id)
      .preload('selected_options')
      .orderBy('attribute_definition_id', 'asc')
    assert.lengthOf(storedValues, 8)

    assert.isTrue(requireStoredValue(storedValues, scenario.inheritedBoolean.id).value_boolean)
    assert.equal(requireStoredValue(storedValues, fixture.text.id).value_text, 'Café coado')
    assert.equal(
      requireStoredValue(storedValues, fixture.longText.id).value_text,
      'Ambiente tranquilo para encontros.'
    )
    assert.equal(requireStoredValue(storedValues, fixture.integer.id).value_integer, 48)
    assert.equal(Number(requireStoredValue(storedValues, fixture.decimal.id).value_decimal), 37.5)
    assert.equal(
      requireStoredValue(storedValues, fixture.url.id).value_url,
      'https://example.com/menu'
    )
    assert.deepEqual(
      requireStoredValue(storedValues, scenario.selectDefinition.id).selected_options.map(
        (option) => option.attribute_option_id
      ),
      [scenario.premiumOption.id]
    )
    assert.deepEqual(
      requireStoredValue(storedValues, fixture.multiSelect.id)
        .selected_options.map((option) => option.attribute_option_id)
        .sort((left, right) => left - right),
      [fixture.wifiOption.id, fixture.accessibilityOption.id].sort((left, right) => left - right)
    )

    const after = await client
      .get(editorPath)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
    after.assertStatus(200)
    const afterProps = parseEditorProps(after)
    assert.notInclude(
      afterProps.completeness.blocking_issues.map((issue) => issue.code),
      'required_attribute_missing'
    )
    assert.isTrue(
      requireEffectiveAttribute(afterProps.effective_attributes, scenario.inheritedBoolean.id).value
    )
    assert.deepEqual(
      requireEffectiveAttribute(afterProps.effective_attributes, scenario.selectDefinition.id)
        .option_ids,
      [scenario.premiumOption.id]
    )
    assert.equal(
      requireEffectiveAttribute(afterProps.effective_attributes, fixture.text.id).value,
      'Café coado'
    )
    assert.equal(
      requireEffectiveAttribute(afterProps.effective_attributes, fixture.decimal.id).value,
      37.5
    )
    assert.deepEqual(
      requireEffectiveAttribute(afterProps.effective_attributes, fixture.multiSelect.id).option_ids,
      [fixture.wifiOption.id, fixture.accessibilityOption.id]
    )

    const address = await client
      .put(`/api/v1/establishments/${establishmentId}/address`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({
        postal_code: '86300000',
        street: 'Rua das Flores',
        number: '120',
        without_number: false,
        district: 'Centro',
        latitude: -23.18,
        longitude: -50.65,
        coordinate_source: 'manual',
      })
    address.assertStatus(200)

    const hours = await client
      .put(`/api/v1/establishments/${establishmentId}/hours`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({ hours: [{ weekday: 1, opens_at: '08:00', closes_at: '18:00' }] })
    hours.assertStatus(200)

    const media = await client
      .post(`/api/v1/establishments/${establishmentId}/media`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .field('alt_text', 'Imagem de capa preenchida pelo Portal')
      .file('file', mediaFixture('valid.webp'))
    media.assertStatus(201)
    media.assertBodyContains({ moderation_status: 'pending', is_cover: true })

    const completeEditor = await client
      .get(editorPath)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
    completeEditor.assertStatus(200)
    const completeProps = parseEditorProps(completeEditor)
    assert.isTrue(completeProps.completeness.eligible)
    assert.equal(completeProps.completeness.score, 100)
    assert.deepEqual(completeProps.completeness.blocking_issues, [])

    const alternateCategory = await Category.create({
      tenant_id: scenario.tenant.id,
      family_id: scenario.family.id,
      parent_id: scenario.parentCategory.id,
      name: 'Padarias do portal',
      slug: `padarias-portal-${scenario.tenant.id}`,
      description: null,
      icon: null,
      sort_order: 1,
      is_active: true,
      allows_always_open: false,
    })
    await client
      .put(`/api/v1/establishments/${establishmentId}/categories`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({ categories: [{ category_id: alternateCategory.id, is_primary: true }] })
      .then((response) => response.assertStatus(200))

    const remainingValues = await EstablishmentRevisionAttributeValue.query()
      .where('tenant_id', scenario.tenant.id)
      .where('revision_id', revision.id)
      .orderBy('attribute_definition_id', 'asc')
    assert.deepEqual(
      remainingValues.map((value) => value.attribute_definition_id),
      [scenario.inheritedBoolean.id]
    )

    const alternateEditor = await client
      .get(editorPath)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
    alternateEditor.assertStatus(200)
    const alternateProps = parseEditorProps(alternateEditor)
    assert.lengthOf(alternateProps.effective_attributes, 2)
    assert.isTrue(
      requireEffectiveAttribute(alternateProps.effective_attributes, scenario.inheritedBoolean.id)
        .value
    )
    assert.equal(
      requireEffectiveAttribute(alternateProps.effective_attributes, fixture.parentOverride.id)
        .data_type,
      'text'
    )
    assert.isFalse(
      alternateProps.effective_attributes.some(
        (attribute) => attribute.id === scenario.selectDefinition.id
      )
    )
  })

  test('keeps organization and establishment pages hidden from outsiders', async ({ client }) => {
    const scenario = await createEstablishmentScenario('portal-outsider')
    const establishmentId = await createDraftEstablishment(client, scenario)
    const outsider = await createUser({
      prefix: 'portal-outsider-user',
      tenant: scenario.tenant,
      tenantRole: 'member',
    })

    const organization = await client
      .get(`/portal/organizations/${scenario.organization.id}`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(outsider)
    organization.assertStatus(404)

    const establishment = await client
      .get(`/portal/establishments/${establishmentId}`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(outsider)
    establishment.assertStatus(404)

    const attributes = await client
      .put(`/portal/establishments/${establishmentId}/attributes`)
      .withCsrfToken()
      .redirects(0)
      .headers({
        ...tenantHeader(scenario.tenant.id),
        referer: `/portal/establishments/${establishmentId}`,
      })
      .loginAs(outsider)
      .json({ attributes: [] })
    attributes.assertStatus(404)
  })

  test('separates moderation and pilot feedback backoffice capabilities', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('portal-backoffice')
    const moderator = await createUser({
      prefix: 'portal-moderator',
      tenant: scenario.tenant,
      tenantRole: 'member',
      globalRole: IRoles.Slugs.MODERATOR,
    })
    const admin = await createUser({
      prefix: 'portal-admin',
      tenant: scenario.tenant,
      tenantRole: 'admin',
      globalRole: IRoles.Slugs.ADMIN,
    })

    const partnerQueue = await client
      .get('/backoffice/moderation')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
    partnerQueue.assertStatus(403)

    const moderatorQueue = await client
      .get('/backoffice/moderation')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(moderator)
    moderatorQueue.assertStatus(200)
    assert.include(moderatorQueue.text(), 'backoffice/moderation/index')
    assert.equal(moderatorQueue.header('cache-control'), 'private, no-store')
    assert.equal(moderatorQueue.header('x-robots-tag'), 'noindex, nofollow')

    const moderatorFeedback = await client
      .get('/backoffice/feedback')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(moderator)
    moderatorFeedback.assertStatus(403)

    const adminFeedback = await client
      .get('/backoffice/feedback')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(admin)
    adminFeedback.assertStatus(200)
    assert.include(adminFeedback.text(), 'backoffice/feedback/index')
  })
})
