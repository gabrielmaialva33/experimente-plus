import { DateTime } from 'luxon'

import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'

import Establishment from '#modules/establishments/models/establishment'
import EstablishmentRevision from '#modules/establishments/models/establishment_revision'
import EstablishmentEvent from '#modules/partner_content/models/establishment_event'
import EstablishmentExperience from '#modules/partner_content/models/establishment_experience'
import PilotFeedback from '#modules/pilot_feedback/models/pilot_feedback'
import EstablishmentReview from '#modules/reviews/models/establishment_review'
import IRoles from '#modules/roles/interfaces/role_interface'
import type User from '#modules/users/models/user'
import {
  createEstablishmentScenario,
  createPublishedEstablishment,
  type EstablishmentScenario,
} from '#tests/functional/establishments/helpers'
import { createUser } from '#tests/functional/organizations/helpers'

const tenantHeader = (tenantId: number) => ({ 'x-tenant-id': String(tenantId) })

function parseInertiaPage(response: { text(): string }) {
  const match = response
    .text()
    .match(/<script data-page="app" type="application\/json">([\s\S]*?)<\/script>/)
  if (!match?.[1]) throw new Error('The response does not contain an Inertia page payload')
  return JSON.parse(match[1]) as { component: string; props: Record<string, any> }
}

interface Operation {
  scenario: EstablishmentScenario
  moderator: User
  admin: User
  reporter: User
}

async function operation(prefix: string): Promise<Operation> {
  const scenario = await createEstablishmentScenario(prefix)
  const moderator = await createUser({
    prefix: `${prefix}-moderator`,
    tenant: scenario.tenant,
    globalRole: IRoles.Slugs.MODERATOR,
  })
  const admin = await createUser({
    prefix: `${prefix}-admin`,
    tenant: scenario.tenant,
    globalRole: IRoles.Slugs.ADMIN,
  })
  const reporter = await createUser({ prefix: `${prefix}-reporter`, tenant: scenario.tenant })
  return { scenario, moderator, admin, reporter }
}

/** A new place submitted by the partner and waiting in the revision queue. */
async function pendingRevision(target: Operation, publicName: string, submittedDaysAgo: number) {
  const establishment = await Establishment.create({
    tenant_id: target.scenario.tenant.id,
    organization_id: target.scenario.organization.id,
    lifecycle_status: 'active',
    business_status: 'open',
    created_by: target.scenario.owner.id,
  })
  return EstablishmentRevision.create({
    establishment_id: establishment.id,
    tenant_id: target.scenario.tenant.id,
    version: 1,
    status: 'pending_review',
    public_name: publicName,
    slug: `${target.scenario.tenant.slug}-${establishment.id}`,
    city_id: target.scenario.city.id,
    short_description: 'Unidade nova aguardando a operação.',
    created_by: target.scenario.owner.id,
    submitted_at: DateTime.utc().minus({ days: submittedDaysAgo }),
  })
}

async function experience(
  target: Operation,
  establishment: Establishment,
  title: string,
  status: 'pending_review' | 'draft'
) {
  return EstablishmentExperience.create({
    tenant_id: target.scenario.tenant.id,
    establishment_id: establishment.id,
    created_by: target.scenario.owner.id,
    title,
    description: 'Uma hora de cafés especiais.',
    status,
  })
}

/** Files a report through the API, as a person would. */
async function report(client: ApiClient, target: Operation, establishment: Establishment) {
  const author = await createUser({
    prefix: `${target.scenario.tenant.slug}-author`,
    tenant: target.scenario.tenant,
  })
  const review = await EstablishmentReview.create({
    tenant_id: target.scenario.tenant.id,
    establishment_id: establishment.id,
    user_id: author.id,
    rating: 1,
    comment: 'Texto que alguém achou ofensivo.',
    status: 'published',
    photos_count: 0,
    videos_count: 0,
  })
  const filed = await client
    .post('/api/v1/content-reports')
    .headers(tenantHeader(target.scenario.tenant.id))
    .loginAs(target.reporter)
    .json({ target_type: 'review', target_id: review.id, reason: 'offensive' })
  filed.assertStatus(201)
  return filed.body() as { id: number; due_at: string }
}

async function feedback(target: Operation, status: 'new' | 'resolved') {
  return PilotFeedback.create({
    tenant_id: target.scenario.tenant.id,
    user_id: target.scenario.owner.id,
    context: 'general',
    rating: 4,
    message: 'O cadastro do lugar foi tranquilo.',
    status,
    reviewed_by: status === 'resolved' ? target.admin.id : null,
    reviewed_at: status === 'resolved' ? DateTime.utc() : null,
  })
}

/** One operation with something waiting in every queue, one report already late. */
async function busyOperation(client: ApiClient, prefix: string) {
  const target = await operation(prefix)
  const establishment = await createPublishedEstablishment(target.scenario, 'Casa de Petiscos')

  const revision = await pendingRevision(target, 'Ateliê do Café', 2)
  const workshop = await experience(target, establishment, 'Oficina de preparo', 'pending_review')
  await experience(target, establishment, 'Rascunho que ninguém enviou', 'draft')
  await EstablishmentEvent.create({
    tenant_id: target.scenario.tenant.id,
    establishment_id: establishment.id,
    created_by: target.scenario.owner.id,
    title: 'Noite de vinis',
    description: null,
    status: 'pending_review',
    starts_at: DateTime.utc().plus({ days: 3 }),
    ends_at: DateTime.utc().plus({ days: 3, hours: 3 }),
  })

  const late = await report(client, target, establishment)
  await db
    .from('content_reports')
    .where('id', late.id)
    .update({ due_at: DateTime.utc().minus({ hours: 2 }).toJSDate() })
  const onTime = await report(client, target, establishment)

  await feedback(target, 'new')
  await feedback(target, 'resolved')

  return { ...target, establishment, revision, workshop, late, onTime }
}

test.group('Backoffice today', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('counts what each queue holds and lists the late report first', async ({
    client,
    assert,
  }) => {
    const busy = await busyOperation(client, 'today-moderator')

    const response = await client
      .get('/backoffice/today')
      .headers(tenantHeader(busy.scenario.tenant.id))
      .loginAs(busy.moderator)
      .accept('html')

    response.assertStatus(200)
    assert.equal(response.header('cache-control'), 'private, no-store')
    assert.equal(response.header('x-robots-tag'), 'noindex, nofollow')

    const page = parseInertiaPage(response)
    assert.equal(page.component, 'backoffice/today/index')
    assert.equal(page.props.platform_access, 'platform_moderator')
    assert.deepEqual(page.props.counts, {
      revisions: 1,
      // The draft is the partner's, not the operation's.
      content: { 'experiences': 1, 'events': 1, 'showcase-items': 0 },
      reports: 2,
      overdue_reports: 1,
      // A moderator cannot read the pilot feedback queue, so it is not counted.
      feedback: null,
    })

    const inbox = page.props.inbox as Array<Record<string, any>>
    assert.lengthOf(inbox, 5)
    // A missed deadline outranks everything; then the nearest deadline.
    assert.deepInclude(inbox[0], { source: 'report', id: busy.late.id, overdue: true })
    assert.deepInclude(inbox[1], { source: 'report', id: busy.onTime.id, overdue: false })
    assert.equal(inbox[0].establishment_name, 'Casa de Petiscos')
    assert.equal(inbox[0].reason, 'offensive')
    // Without a deadline, what has waited longest comes first: the revision
    // was submitted two days ago.
    assert.deepInclude(inbox[2], {
      source: 'revision',
      id: busy.revision.id,
      public_name: 'Ateliê do Café',
    })
    assert.sameMembers(
      inbox.slice(3).map((item) => item.title),
      ['Oficina de preparo', 'Noite de vinis']
    )
    assert.notInclude(response.text(), 'Rascunho que ninguém enviou')
    // The inbox names a report's origin, never who filed it.
    assert.notInclude(response.text(), busy.reporter.email)
    assert.notInclude(response.text(), busy.reporter.full_name)
  })

  test('adds new pilot feedback for an administrator', async ({ client, assert }) => {
    const busy = await busyOperation(client, 'today-admin')

    const response = await client
      .get('/backoffice/today')
      .headers(tenantHeader(busy.scenario.tenant.id))
      .loginAs(busy.admin)
      .accept('html')

    response.assertStatus(200)
    const page = parseInertiaPage(response)
    assert.equal(page.props.platform_access, 'platform_admin')
    // Only the feedback nobody has looked at yet.
    assert.equal(page.props.counts.feedback, 1)
    assert.equal(page.props.counts.revisions, 1)
  })

  test('reads only the active operation', async ({ client, assert }) => {
    const busy = await busyOperation(client, 'today-busy')
    const quiet = await operation('today-quiet')

    const response = await client
      .get('/backoffice/today')
      .headers(tenantHeader(quiet.scenario.tenant.id))
      .loginAs(quiet.admin)
      .accept('html')

    response.assertStatus(200)
    const page = parseInertiaPage(response)
    assert.deepEqual(page.props.counts, {
      revisions: 0,
      content: { 'experiences': 0, 'events': 0, 'showcase-items': 0 },
      reports: 0,
      overdue_reports: 0,
      feedback: 0,
    })
    assert.deepEqual(page.props.inbox, [])
    assert.notInclude(response.text(), 'Oficina de preparo')
    assert.notInclude(response.text(), busy.revision.public_name!)
  })

  test('is closed to partners and ordinary accounts', async ({ client }) => {
    const busy = await busyOperation(client, 'today-denied')

    const asOwner = await client
      .get('/backoffice/today')
      .headers(tenantHeader(busy.scenario.tenant.id))
      .loginAs(busy.scenario.owner)
    asOwner.assertStatus(403)

    const asReporter = await client
      .get('/backoffice/today')
      .headers(tenantHeader(busy.scenario.tenant.id))
      .loginAs(busy.reporter)
    asReporter.assertStatus(403)

    const anonymous = await client.get('/backoffice/today').redirects(0)
    anonymous.assertStatus(302)
  })

  test('keeps the indicator dashboard reachable for administrators', async ({ client }) => {
    const target = await operation('today-dashboard')

    const dashboard = await client
      .get('/dashboard')
      .headers(tenantHeader(target.scenario.tenant.id))
      .loginAs(target.admin)
    dashboard.assertStatus(200)
  })
})
