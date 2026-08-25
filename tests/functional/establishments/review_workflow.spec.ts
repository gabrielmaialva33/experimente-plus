import { rm } from 'node:fs/promises'
import { join } from 'node:path'

import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import type { ApiClient } from '@japa/api-client'
import { test } from '@japa/runner'

import Establishment from '#modules/establishments/models/establishment'
import EstablishmentRevision from '#modules/establishments/models/establishment_revision'
import EstablishmentRevisionEvent from '#modules/establishments/models/establishment_revision_event'
import EstablishmentRevisionReviewIssue from '#modules/establishments/models/establishment_revision_review_issue'
import EstablishmentRevisionMedia from '#modules/media/models/establishment_revision_media'
import IRoles from '#modules/roles/interfaces/role_interface'
import {
  createEstablishmentScenario,
  type EstablishmentScenario,
} from '#tests/functional/establishments/helpers'
import { addOrganizationMember, createUser } from '#tests/functional/organizations/helpers'

const fixture = (name: string) => join(process.cwd(), 'tests', 'fixtures', 'media', name)
const tenantHeader = (tenantId: number) => ({ 'x-tenant-id': String(tenantId) })

async function createDraftEstablishment(
  client: ApiClient,
  scenario: EstablishmentScenario,
  publicName = 'Unidade em revisão'
): Promise<number> {
  const response = await client
    .post(`/api/v1/organizations/${scenario.organization.id}/establishments`)
    .headers(tenantHeader(scenario.tenant.id))
    .loginAs(scenario.owner)
    .json({
      public_name: publicName,
      city_id: scenario.city.id,
      short_description: 'Perfil completo para validar submissão e publicação',
      public_phone: '(43) 99999-0000',
      availability_type: 'regular_hours',
    })

  response.assertStatus(201)
  return Number(response.body().id)
}

async function completeProfile(
  client: ApiClient,
  scenario: EstablishmentScenario,
  establishmentId: number
): Promise<number> {
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

  const categories = await client
    .put(`/api/v1/establishments/${establishmentId}/categories`)
    .headers(tenantHeader(scenario.tenant.id))
    .loginAs(scenario.owner)
    .json({
      categories: [{ category_id: scenario.primaryCategory.id, is_primary: true }],
    })
  categories.assertStatus(200)

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

  const hours = await client
    .put(`/api/v1/establishments/${establishmentId}/hours`)
    .headers(tenantHeader(scenario.tenant.id))
    .loginAs(scenario.owner)
    .json({
      hours: [
        { weekday: 1, opens_at: '08:00', closes_at: '12:00' },
        { weekday: 1, opens_at: '13:30', closes_at: '18:00' },
      ],
    })
  hours.assertStatus(200)

  const media = await client
    .post(`/api/v1/establishments/${establishmentId}/media`)
    .headers(tenantHeader(scenario.tenant.id))
    .loginAs(scenario.owner)
    .field('alt_text', 'Fachada principal da unidade')
    .field('is_cover', 'true')
    .file('file', fixture('valid.png'))
  media.assertStatus(201)

  return Number(media.body().id)
}

async function createModerator(scenario: EstablishmentScenario) {
  return createUser({
    prefix: 'review-moderator',
    tenant: scenario.tenant,
    tenantRole: 'member',
    globalRole: IRoles.Slugs.MODERATOR,
  })
}

async function createAdministrator(scenario: EstablishmentScenario) {
  return createUser({
    prefix: 'review-admin',
    tenant: scenario.tenant,
    tenantRole: 'member',
    globalRole: IRoles.Slugs.ADMIN,
  })
}

async function submitRevision(
  client: ApiClient,
  scenario: EstablishmentScenario,
  establishmentId: number
) {
  return client
    .post(`/api/v1/establishments/${establishmentId}/submit`)
    .headers(tenantHeader(scenario.tenant.id))
    .loginAs(scenario.owner)
}

async function approveMedia(
  client: ApiClient,
  scenario: EstablishmentScenario,
  moderator: Awaited<ReturnType<typeof createModerator>>,
  mediaId: number
) {
  return client
    .post(`/api/v1/admin/media/${mediaId}/approve`)
    .headers(tenantHeader(scenario.tenant.id))
    .loginAs(moderator)
    .json({})
}

async function pendingRevision(establishmentId: number) {
  return EstablishmentRevision.query()
    .where('establishment_id', establishmentId)
    .where('status', 'pending_review')
    .firstOrFail()
}

test.group('Establishment review workflow', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.teardown(async () => {
    await rm(app.makePath('storage', 'media'), { recursive: true, force: true })
  })

  test('returns actionable diagnostics and keeps an incomplete revision editable', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('review-incomplete')
    const establishmentId = await createDraftEstablishment(client, scenario)

    const response = await submitRevision(client, scenario, establishmentId)
    response.assertStatus(422)
    response.assertBodyContains({ submitted: false, gate: { eligible: false } })

    const issueCodes = response
      .body()
      .gate.blocking_issues.map((issue: { code: string }) => issue.code)
    assert.include(issueCodes, 'address_missing')
    assert.include(issueCodes, 'primary_category_missing')
    assert.include(issueCodes, 'media_missing')

    const revision = await EstablishmentRevision.query()
      .where('establishment_id', establishmentId)
      .firstOrFail()
    assert.equal(revision.status, 'draft')
    assert.isNull(revision.submitted_at)
    const creationEvent = await EstablishmentRevisionEvent.query()
      .where('revision_id', revision.id)
      .where('event_type', 'created')
      .firstOrFail()
    assert.isNull(creationEvent.from_status)
    assert.equal(creationEvent.to_status, 'draft')
  })

  test('submits a complete revision atomically and freezes partner mutations', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('review-submit')
    const establishmentId = await createDraftEstablishment(client, scenario)
    await completeProfile(client, scenario, establishmentId)

    const analyst = await createUser({
      prefix: 'review-analyst',
      tenant: scenario.tenant,
      tenantRole: 'member',
    })
    await addOrganizationMember({
      tenant: scenario.tenant,
      organization: scenario.organization,
      user: analyst,
      role: 'analyst',
    })

    const analystAttempt = await client
      .post(`/api/v1/establishments/${establishmentId}/submit`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(analyst)
    analystAttempt.assertStatus(403)

    const submitted = await submitRevision(client, scenario, establishmentId)
    submitted.assertStatus(200)
    submitted.assertBodyContains({
      submitted: true,
      revision: { status: 'pending_review', version: 1 },
      gate: { eligible: true, score: 100 },
    })

    const revision = await pendingRevision(establishmentId)
    assert.isNotNull(revision.submitted_at)
    assert.isNull(revision.reviewed_by)
    assert.isNull(revision.reviewed_at)

    const event = await EstablishmentRevisionEvent.query()
      .where('revision_id', revision.id)
      .where('event_type', 'submitted')
      .firstOrFail()
    assert.equal(event.from_status, 'draft')
    assert.equal(event.to_status, 'pending_review')

    const frozenUpdate = await client
      .put(`/api/v1/establishments/${establishmentId}/revision`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({ short_description: 'Tentativa de alterar conteúdo congelado' })
    frozenUpdate.assertStatus(400)
  })

  test('persists structured correction issues and resolves them on resubmission', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('review-changes')
    const establishmentId = await createDraftEstablishment(client, scenario)
    await completeProfile(client, scenario, establishmentId)
    const submitted = await submitRevision(client, scenario, establishmentId)
    submitted.assertStatus(200)
    const revision = await pendingRevision(establishmentId)
    const moderator = await createModerator(scenario)

    const changes = await client
      .post(`/api/v1/admin/establishment-revisions/${revision.id}/request-changes`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(moderator)
      .json({
        reason: 'A descrição precisa ser mais objetiva',
        issues: [
          {
            code: 'description_needs_revision',
            field: 'short_description',
            message: 'Explique o principal diferencial da unidade',
            severity: 'blocking',
          },
        ],
      })
    changes.assertStatus(200)
    changes.assertBodyContains({ status: 'changes_requested' })

    const ownerReview = await client
      .get(`/api/v1/establishments/${establishmentId}/review`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
    ownerReview.assertStatus(200)
    assert.equal(ownerReview.body().review_issues[0].code, 'description_needs_revision')
    assert.isNull(ownerReview.body().review_issues[0].resolved_at)

    const update = await client
      .put(`/api/v1/establishments/${establishmentId}/revision`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({ short_description: 'Café regional com torra própria e atendimento local' })
    update.assertStatus(200)

    const resubmitted = await submitRevision(client, scenario, establishmentId)
    resubmitted.assertStatus(200)
    resubmitted.assertBodyContains({
      submitted: true,
      revision: { status: 'pending_review' },
    })

    const issue = await EstablishmentRevisionReviewIssue.query()
      .where('revision_id', revision.id)
      .where('code', 'description_needs_revision')
      .firstOrFail()
    assert.isNotNull(issue.resolved_at)
    assert.equal(issue.resolved_by, scenario.owner.id)

    const events = await EstablishmentRevisionEvent.query()
      .where('revision_id', revision.id)
      .orderBy('id', 'asc')
    assert.deepEqual(
      events.map((event) => event.event_type),
      ['created', 'submitted', 'changes_requested', 'resubmitted']
    )
  })

  test('blocks publication with pending media and publishes atomically after media approval', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('review-approve')
    const establishmentId = await createDraftEstablishment(client, scenario)
    const mediaId = await completeProfile(client, scenario, establishmentId)
    const submitted = await submitRevision(client, scenario, establishmentId)
    submitted.assertStatus(200)
    const revision = await pendingRevision(establishmentId)
    const moderator = await createModerator(scenario)

    const blocked = await client
      .post(`/api/v1/admin/establishment-revisions/${revision.id}/approve`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(moderator)
      .json({})
    blocked.assertStatus(422)
    blocked.assertBodyContains({ approved: false, publication_gate: { eligible: false } })
    assert.include(
      blocked.body().publication_gate.blocking_issues.map((issue: { code: string }) => issue.code),
      'media_pending'
    )

    const approvedMedia = await approveMedia(client, scenario, moderator, mediaId)
    approvedMedia.assertStatus(200)
    approvedMedia.assertBodyContains({ moderation_status: 'approved', is_cover: true })

    const approved = await client
      .post(`/api/v1/admin/establishment-revisions/${revision.id}/approve`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(moderator)
      .json({ reason: 'Ficha e mídia verificadas' })
    approved.assertStatus(200)
    approved.assertBodyContains({
      approved: true,
      revision: { status: 'approved' },
      publication_gate: { eligible: true, score: 100 },
    })

    const establishment = await Establishment.findOrFail(establishmentId)
    assert.equal(establishment.published_revision_id, revision.id)

    const events = await EstablishmentRevisionEvent.query()
      .where('revision_id', revision.id)
      .orderBy('id', 'asc')
    assert.deepEqual(
      events.map((event) => event.event_type),
      ['created', 'submitted', 'approved', 'published']
    )

    const publicMedia = await client.get(`/api/v1/public/establishments/${establishmentId}/media`)
    publicMedia.assertStatus(200)
    assert.lengthOf(publicMedia.body().media, 1)
    assert.equal(publicMedia.body().media[0].id, mediaId)

    const secondDecision = await client
      .post(`/api/v1/admin/establishment-revisions/${revision.id}/reject`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(moderator)
      .json({ reason: 'Decisão concorrente inválida' })
    secondDecision.assertStatus(400)
  })

  test('clones a published revision, preserves its aggregate and keeps the old publication after rejection', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('review-clone')
    const establishmentId = await createDraftEstablishment(client, scenario)
    const mediaId = await completeProfile(client, scenario, establishmentId)
    await submitRevision(client, scenario, establishmentId)
    const revisionOne = await pendingRevision(establishmentId)
    const moderator = await createModerator(scenario)
    const approvedMedia = await approveMedia(client, scenario, moderator, mediaId)
    approvedMedia.assertStatus(200)

    const firstApproval = await client
      .post(`/api/v1/admin/establishment-revisions/${revisionOne.id}/approve`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(moderator)
      .json({})
    firstApproval.assertStatus(200)

    const clone = await client
      .post(`/api/v1/establishments/${establishmentId}/revisions`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({ status: 'approved', reviewed_by: moderator.id })
    clone.assertStatus(201)
    clone.assertBodyContains({ version: 2, status: 'draft', based_on_revision_id: revisionOne.id })

    const revisionTwoId = Number(clone.body().id)
    const copiedMedia = await EstablishmentRevisionMedia.query()
      .where('revision_id', revisionTwoId)
      .firstOrFail()
    const originalMedia = await EstablishmentRevisionMedia.findOrFail(mediaId)
    assert.equal(copiedMedia.media_asset_id, originalMedia.media_asset_id)
    assert.equal(copiedMedia.moderation_status, 'approved')
    assert.isTrue(copiedMedia.is_cover)

    const copiedAddressCount = await db
      .from('establishment_revision_addresses')
      .where('revision_id', revisionTwoId)
      .count('* as total')
      .first()
    const copiedCategoryCount = await db
      .from('establishment_revision_categories')
      .where('revision_id', revisionTwoId)
      .count('* as total')
      .first()
    const copiedAttributeCount = await db
      .from('establishment_revision_attribute_values')
      .where('revision_id', revisionTwoId)
      .count('* as total')
      .first()
    const copiedHourCount = await db
      .from('establishment_revision_hours')
      .where('revision_id', revisionTwoId)
      .count('* as total')
      .first()
    const copiedAggregateCounts = [
      copiedAddressCount,
      copiedCategoryCount,
      copiedAttributeCount,
      copiedHourCount,
    ]
    assert.deepEqual(
      copiedAggregateCounts.map((row) => Number(row?.total ?? 0)),
      [1, 1, 2, 2]
    )

    const secondSubmission = await submitRevision(client, scenario, establishmentId)
    secondSubmission.assertStatus(200)

    const rejected = await client
      .post(`/api/v1/admin/establishment-revisions/${revisionTwoId}/reject`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(moderator)
      .json({ reason: 'Nova versão não atende à política editorial' })
    rejected.assertStatus(200)
    rejected.assertBodyContains({ status: 'rejected' })

    const establishment = await Establishment.findOrFail(establishmentId)
    assert.equal(establishment.published_revision_id, revisionOne.id)

    const cloneRejected = await client
      .post(`/api/v1/establishments/${establishmentId}/revisions`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({ source: 'latest_terminal' })
    cloneRejected.assertStatus(201)
    cloneRejected.assertBodyContains({
      version: 3,
      status: 'draft',
      based_on_revision_id: revisionTwoId,
    })
  })

  test('keeps the moderation queue tenant-scoped and inaccessible to partners', async ({
    client,
    assert,
  }) => {
    const first = await createEstablishmentScenario('review-queue-one')
    const firstEstablishment = await createDraftEstablishment(client, first)
    await completeProfile(client, first, firstEstablishment)
    await submitRevision(client, first, firstEstablishment)

    const second = await createEstablishmentScenario('review-queue-two')
    const secondEstablishment = await createDraftEstablishment(client, second)
    await completeProfile(client, second, secondEstablishment)
    await submitRevision(client, second, secondEstablishment)

    const ownerAttempt = await client
      .get('/api/v1/admin/establishment-revisions')
      .headers(tenantHeader(first.tenant.id))
      .loginAs(first.owner)
    ownerAttempt.assertStatus(403)

    const firstModerator = await createModerator(first)
    const firstQueue = await client
      .get('/api/v1/admin/establishment-revisions')
      .headers(tenantHeader(first.tenant.id))
      .loginAs(firstModerator)
    firstQueue.assertStatus(200)
    assert.deepEqual(
      firstQueue.body().data.map((item: { establishment_id: number }) => item.establishment_id),
      [firstEstablishment]
    )

    const secondModerator = await createModerator(second)
    const secondQueue = await client
      .get('/api/v1/admin/establishment-revisions')
      .headers(tenantHeader(second.tenant.id))
      .loginAs(secondModerator)
    secondQueue.assertStatus(200)
    assert.deepEqual(
      secondQueue.body().data.map((item: { establishment_id: number }) => item.establishment_id),
      [secondEstablishment]
    )
  })

  test('suspends public discovery without deleting the published revision and restores it', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('review-suspend')
    const establishmentId = await createDraftEstablishment(client, scenario)
    const mediaId = await completeProfile(client, scenario, establishmentId)
    await submitRevision(client, scenario, establishmentId)
    const revision = await pendingRevision(establishmentId)
    const moderator = await createModerator(scenario)
    await approveMedia(client, scenario, moderator, mediaId)
    const approval = await client
      .post(`/api/v1/admin/establishment-revisions/${revision.id}/approve`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(moderator)
      .json({})
    approval.assertStatus(200)

    const administrator = await createAdministrator(scenario)
    const suspended = await client
      .post(`/api/v1/admin/establishments/${establishmentId}/suspend`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(administrator)
      .json({ reason: 'Verificação administrativa temporária' })
    suspended.assertStatus(200)
    suspended.assertBodyContains({ lifecycle_status: 'suspended' })

    const hidden = await client.get(`/api/v1/public/establishments/${establishmentId}/media`)
    hidden.assertStatus(404)

    const suspendedEstablishment = await Establishment.findOrFail(establishmentId)
    assert.equal(suspendedEstablishment.published_revision_id, revision.id)

    const restored = await client
      .post(`/api/v1/admin/establishments/${establishmentId}/restore`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(administrator)
      .json({ reason: 'Verificação concluída' })
    restored.assertStatus(200)
    restored.assertBodyContains({ lifecycle_status: 'active' })

    const publicAgain = await client.get(`/api/v1/public/establishments/${establishmentId}/media`)
    publicAgain.assertStatus(200)
  })

  test('enforces tenant-safe review records, unique open issues and append-only events', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('review-db')
    const establishmentId = await createDraftEstablishment(client, scenario)
    await completeProfile(client, scenario, establishmentId)
    await submitRevision(client, scenario, establishmentId)
    const revision = await pendingRevision(establishmentId)
    const moderator = await createModerator(scenario)

    const changes = await client
      .post(`/api/v1/admin/establishment-revisions/${revision.id}/request-changes`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(moderator)
      .json({
        reason: 'Correção obrigatória',
        issues: [
          {
            code: 'public_name_review',
            field: 'public_name',
            message: 'Confirme o nome público',
            severity: 'blocking',
          },
        ],
      })
    changes.assertStatus(200)

    const issue = await EstablishmentRevisionReviewIssue.query()
      .where('revision_id', revision.id)
      .whereNull('resolved_at')
      .firstOrFail()
    const event = await EstablishmentRevisionEvent.query()
      .where('revision_id', revision.id)
      .where('event_type', 'changes_requested')
      .firstOrFail()
    const foreign = await createEstablishmentScenario('review-db-foreign')

    await assert.rejects(() =>
      db.transaction(async (transaction) => {
        await transaction.table('establishment_revision_review_issues').insert({
          tenant_id: foreign.tenant.id,
          establishment_id: establishmentId,
          revision_id: revision.id,
          code: 'cross_tenant_issue',
          field: 'general',
          message: 'Should fail',
          severity: 'blocking',
          created_by: foreign.owner.id,
          created_at: new Date(),
        })
      })
    )

    await assert.rejects(() =>
      db.transaction(async (transaction) => {
        await transaction.table('establishment_revision_review_issues').insert({
          tenant_id: scenario.tenant.id,
          establishment_id: establishmentId,
          revision_id: revision.id,
          code: issue.code,
          field: issue.field,
          message: 'Duplicate open issue',
          severity: 'blocking',
          created_by: moderator.id,
          created_at: new Date(),
        })
      })
    )

    await assert.rejects(() =>
      db.transaction(async (transaction) => {
        await transaction
          .from('establishment_revision_events')
          .where('id', event.id)
          .update({ reason: 'Mutation must fail' })
      })
    )

    await assert.rejects(() =>
      db.transaction(async (transaction) => {
        await transaction.from('establishment_revision_events').where('id', event.id).delete()
      })
    )
  })
})
