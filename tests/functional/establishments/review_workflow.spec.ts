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

function parseInertiaPage(response: { text(): string }): {
  component: string
  props: Record<string, unknown>
} {
  const match = response
    .text()
    .match(/<script data-page="app" type="application\/json">([\s\S]*?)<\/script>/)
  if (!match?.[1]) {
    throw new Error('The response does not contain an Inertia page payload')
  }

  return JSON.parse(match[1]) as { component: string; props: Record<string, unknown> }
}

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

function databaseDateKey(value: unknown): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10)
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

  test('blocks a public slug owned by another establishment on submission and approval', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('review-published-slug')
    const moderator = await createModerator(scenario)

    const firstEstablishmentId = await createDraftEstablishment(
      client,
      scenario,
      'Unidade com URL pública'
    )
    const firstMediaId = await completeProfile(client, scenario, firstEstablishmentId)
    const firstSubmission = await submitRevision(client, scenario, firstEstablishmentId)
    firstSubmission.assertStatus(200)
    const firstRevision = await pendingRevision(firstEstablishmentId)
    const firstMediaApproval = await approveMedia(client, scenario, moderator, firstMediaId)
    firstMediaApproval.assertStatus(200)
    const firstApproval = await client
      .post(`/api/v1/admin/establishment-revisions/${firstRevision.id}/approve`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(moderator)
      .json({})
    firstApproval.assertStatus(200)

    const secondEstablishmentId = await createDraftEstablishment(
      client,
      scenario,
      'Outra unidade completa'
    )
    const secondMediaId = await completeProfile(client, scenario, secondEstablishmentId)
    const secondDraft = await EstablishmentRevision.query()
      .where('establishment_id', secondEstablishmentId)
      .where('status', 'draft')
      .firstOrFail()
    const availableSlug = secondDraft.slug
    secondDraft.slug = firstRevision.slug
    await secondDraft.save()

    const editorPath = `/portal/establishments/${secondEstablishmentId}`
    const conflictedEditor = await client
      .get(editorPath)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
    conflictedEditor.assertStatus(200)
    const conflictedPage = parseInertiaPage(conflictedEditor)
    assert.equal(conflictedPage.component, 'portal/establishments/edit')
    const conflictedCompleteness = conflictedPage.props.completeness as {
      eligible: boolean
      score: number
      blocking_issues: Array<{
        code: string
        field: string
        message: string
        severity: string
      }>
    }
    assert.isFalse(conflictedCompleteness.eligible)
    assert.equal(conflictedCompleteness.score, 99)
    assert.deepEqual(conflictedCompleteness.blocking_issues, [
      {
        code: 'slug_already_published',
        field: 'slug',
        message:
          'A URL pública já está em uso por outra unidade desta cidade. Altere o nome público para gerar um endereço diferente.',
        severity: 'blocking',
        metadata: { city_id: scenario.city.id, slug: firstRevision.slug },
      },
    ])

    const blockedPortalSubmission = await client
      .post(`${editorPath}/submit`)
      .withCsrfToken()
      .headers({ ...tenantHeader(scenario.tenant.id), referer: editorPath })
      .loginAs(scenario.owner)
      .json({})
    blockedPortalSubmission.assertStatus(200)
    const redirectedPage = parseInertiaPage(blockedPortalSubmission)
    assert.equal(redirectedPage.component, 'portal/establishments/edit')
    assert.equal(
      (redirectedPage.props.errors as Record<string, unknown> | undefined)?.submission,
      'A ficha ainda não está pronta. Revise as pendências indicadas antes de enviar.'
    )
    const redirectedCompleteness = redirectedPage.props.completeness as {
      eligible: boolean
      blocking_issues: Array<{ code: string; field: string; message: string }>
    }
    assert.isFalse(redirectedCompleteness.eligible)
    assert.deepInclude(redirectedCompleteness.blocking_issues[0], {
      code: 'slug_already_published',
      field: 'slug',
    })
    assert.notInclude(redirectedCompleteness.blocking_issues[0].message, 'Another establishment')

    const blockedSubmission = await submitRevision(client, scenario, secondEstablishmentId)
    blockedSubmission.assertStatus(422)
    blockedSubmission.assertBodyContains({
      submitted: false,
      revision: { status: 'draft' },
      gate: { eligible: false },
    })
    const submissionSlugIssue = blockedSubmission
      .body()
      .gate.blocking_issues.find(
        (issue: { code: string }) => issue.code === 'slug_already_published'
      )
    assert.deepInclude(submissionSlugIssue, {
      field: 'slug',
      severity: 'blocking',
    })

    secondDraft.slug = availableSlug
    await secondDraft.save()
    const secondSubmission = await submitRevision(client, scenario, secondEstablishmentId)
    secondSubmission.assertStatus(200)
    const secondRevision = await pendingRevision(secondEstablishmentId)
    secondRevision.slug = firstRevision.slug
    await secondRevision.save()
    const secondMediaApproval = await approveMedia(client, scenario, moderator, secondMediaId)
    secondMediaApproval.assertStatus(200)

    const blocked = await client
      .post(`/api/v1/admin/establishment-revisions/${secondRevision.id}/approve`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(moderator)
      .json({})
    blocked.assertStatus(422)
    blocked.assertBodyContains({
      approved: false,
      revision: { status: 'pending_review' },
      publication_gate: { eligible: false },
    })
    const slugIssue = blocked
      .body()
      .publication_gate.blocking_issues.find(
        (issue: { code: string }) => issue.code === 'slug_already_published'
      )
    assert.deepInclude(slugIssue, {
      field: 'slug',
      severity: 'blocking',
    })
    assert.include(slugIssue.message, 'URL pública')

    const firstEstablishment = await Establishment.findOrFail(firstEstablishmentId)
    const secondEstablishment = await Establishment.findOrFail(secondEstablishmentId)
    assert.equal(firstEstablishment.published_revision_id, firstRevision.id)
    assert.isNull(secondEstablishment.published_revision_id)
    await secondRevision.refresh()
    assert.equal(secondRevision.status, 'pending_review')
  })

  test('clones only the published revision when one exists and preserves its full aggregate', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('review-clone')
    scenario.selectDefinition.data_type = 'multi_select'
    await scenario.selectDefinition.save()
    const establishmentId = await createDraftEstablishment(client, scenario)
    const mediaId = await completeProfile(client, scenario, establishmentId)

    const attributes = await client
      .put(`/api/v1/establishments/${establishmentId}/attributes`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({
        attributes: [
          { attribute_definition_id: scenario.inheritedBoolean.id, value: true },
          {
            attribute_definition_id: scenario.selectDefinition.id,
            option_ids: [scenario.standardOption.id, scenario.premiumOption.id],
          },
        ],
      })
    attributes.assertStatus(200)

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
            note: 'Véspera de Ano-Novo',
            intervals: [
              { opens_at: '09:00', closes_at: '12:00', sort_order: 0 },
              { opens_at: '13:00', closes_at: '17:00', sort_order: 1 },
            ],
          },
        ],
      })
    specialDays.assertStatus(200)

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
      .json({ source: 'published' })
    clone.assertStatus(201)
    clone.assertBodyContains({ version: 2, status: 'draft', based_on_revision_id: revisionOne.id })

    const revisionTwoId = Number(clone.body().id)
    const revisionTwo = await EstablishmentRevision.findOrFail(revisionTwoId)
    assert.isNull(revisionTwo.review_notes)
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

    const copiedMultiValue = await db
      .from('establishment_revision_attribute_values')
      .where('tenant_id', scenario.tenant.id)
      .where('revision_id', revisionTwoId)
      .where('attribute_definition_id', scenario.selectDefinition.id)
      .firstOrFail()
    const copiedOptions = await db
      .from('establishment_revision_attribute_value_options')
      .where('tenant_id', scenario.tenant.id)
      .where('attribute_value_id', copiedMultiValue.id)
      .orderBy('attribute_option_id', 'asc')
    assert.deepEqual(
      copiedOptions.map((option) => Number(option.attribute_option_id)),
      [scenario.standardOption.id, scenario.premiumOption.id].sort((left, right) => left - right)
    )

    const copiedSpecialDays = await db
      .from('establishment_revision_special_days')
      .where('tenant_id', scenario.tenant.id)
      .where('revision_id', revisionTwoId)
      .orderBy('date', 'asc')
    assert.lengthOf(copiedSpecialDays, 2)
    assert.deepEqual(
      copiedSpecialDays.map((day) => [databaseDateKey(day.date), day.status, day.note]),
      [
        ['2026-12-25', 'closed', 'Natal'],
        ['2026-12-31', 'custom_hours', 'Véspera de Ano-Novo'],
      ]
    )
    const customDay = copiedSpecialDays.find((day) => databaseDateKey(day.date) === '2026-12-31')
    assert.exists(customDay)
    const copiedSpecialHours = await db
      .from('establishment_revision_special_hours')
      .where('tenant_id', scenario.tenant.id)
      .where('revision_id', revisionTwoId)
      .orderBy('sort_order', 'asc')
    assert.deepEqual(
      copiedSpecialHours.map((interval) => ({
        special_day_id: Number(interval.special_day_id),
        opens_at: String(interval.opens_at).slice(0, 5),
        closes_at: String(interval.closes_at).slice(0, 5),
        sort_order: Number(interval.sort_order),
      })),
      [
        {
          special_day_id: Number(customDay!.id),
          opens_at: '09:00',
          closes_at: '12:00',
          sort_order: 0,
        },
        {
          special_day_id: Number(customDay!.id),
          opens_at: '13:00',
          closes_at: '17:00',
          sort_order: 1,
        },
      ]
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

    const rejectedSourceAttack = await client
      .post(`/api/v1/establishments/${establishmentId}/revisions`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({ source: 'latest_terminal' })
    rejectedSourceAttack.assertStatus(400)

    const clonePublished = await client
      .post(`/api/v1/establishments/${establishmentId}/revisions`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({ source: 'published' })
    clonePublished.assertStatus(201)
    clonePublished.assertBodyContains({
      version: 3,
      status: 'draft',
      based_on_revision_id: revisionOne.id,
    })
  })

  test('clones the latest rejected revision only when no publication exists', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('review-clone-rejected')
    const establishmentId = await createDraftEstablishment(client, scenario)
    await completeProfile(client, scenario, establishmentId)
    await submitRevision(client, scenario, establishmentId)
    const rejectedRevision = await pendingRevision(establishmentId)
    const moderator = await createModerator(scenario)

    const rejected = await client
      .post(`/api/v1/admin/establishment-revisions/${rejectedRevision.id}/reject`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(moderator)
      .json({ reason: 'Conteúdo precisa de uma nova proposta editorial' })
    rejected.assertStatus(200)

    const establishment = await Establishment.findOrFail(establishmentId)
    assert.isNull(establishment.published_revision_id)

    const publishedSource = await client
      .post(`/api/v1/establishments/${establishmentId}/revisions`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({ source: 'published' })
    publishedSource.assertStatus(400)

    const clone = await client
      .post(`/api/v1/establishments/${establishmentId}/revisions`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({ source: 'latest_terminal' })
    clone.assertStatus(201)
    clone.assertBodyContains({
      version: 2,
      status: 'draft',
      based_on_revision_id: rejectedRevision.id,
    })

    const clonedRevision = await EstablishmentRevision.findOrFail(Number(clone.body().id))
    assert.isNull(clonedRevision.review_notes)
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
