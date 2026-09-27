import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'

import type {
  OrganizationReviewPageProps,
  OrganizationReviewQueuePageProps,
} from '#modules/organizations/interfaces/organization_review_pages'
import Establishment from '#modules/establishments/models/establishment'
import EstablishmentRevision from '#modules/establishments/models/establishment_revision'
import Organization from '#modules/organizations/models/organization'
import OrganizationClaim from '#modules/organizations/models/organization_claim'
import OrganizationMember from '#modules/organizations/models/organization_member'
import IRole from '#modules/roles/interfaces/role_interface'
import type Tenant from '#modules/tenants/models/tenant'
import type User from '#modules/users/models/user'
import { createOperation, createOrganization, createUser } from './helpers.js'

const QUEUE = '/backoffice/organizations'
const tenantHeader = (tenant: Tenant) => ({ 'x-tenant-id': String(tenant.id) })

function parseInertiaPage(response: { text(): string }) {
  const match = response
    .text()
    .match(/<script data-page="app" type="application\/json">([\s\S]*?)<\/script>/)
  if (!match?.[1]) throw new Error('The response does not contain an Inertia page payload')
  return JSON.parse(match[1]) as { component: string; props: Record<string, unknown> }
}

async function statusOf(organizationId: number) {
  const organization = await Organization.findOrFail(organizationId)
  return organization.status
}

async function reviewScenario(prefix: string) {
  const tenant = await createOperation(prefix)
  const owner = await createUser({ prefix: `${prefix}-owner`, tenant })
  const moderator = await createUser({
    prefix: `${prefix}-moderator`,
    tenant,
    globalRole: IRole.Slugs.MODERATOR,
  })
  const admin = await createUser({
    prefix: `${prefix}-admin`,
    tenant,
    tenantRole: 'admin',
    globalRole: IRole.Slugs.ADMIN,
  })
  const organization = await createOrganization({ tenant, owner, prefix: 'Casa Norte' })
  const place = await Establishment.create({
    tenant_id: tenant.id,
    organization_id: organization.id,
    lifecycle_status: 'active',
    business_status: 'open',
    created_by: owner.id,
  })
  await EstablishmentRevision.create({
    establishment_id: place.id,
    tenant_id: tenant.id,
    version: 1,
    status: 'draft',
    public_name: 'Casa Norte — Centro',
    slug: `${prefix}-${place.id}`,
    created_by: owner.id,
  })
  return { tenant, owner, moderator, admin, organization }
}

/** "Enviar para análise" through the partner Portal, as the business does it. */
async function submitThroughPortal(
  client: ApiClient,
  tenant: Tenant,
  owner: User,
  organizationId: number
) {
  const submitted = await client
    .post(`/portal/organizations/${organizationId}/submit`)
    .headers(tenantHeader(tenant))
    .withCsrfToken()
    .redirects(0)
    .loginAs(owner)
  submitted.assertStatus(302)
}

async function decide(
  client: ApiClient,
  tenant: Tenant,
  actor: User,
  path: string,
  reason: string
) {
  return client
    .post(path)
    .headers({ ...tenantHeader(tenant), referer: QUEUE })
    .withCsrfToken()
    .redirects(0)
    .loginAs(actor)
    .json({ reason })
}

test.group('Back-office organization queue', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('lists the organizations waiting for review with who sent them and their places', async ({
    client,
    assert,
  }) => {
    const scenario = await reviewScenario('review-queue')
    await createOrganization({ tenant: scenario.tenant, status: 'active', prefix: 'Já ativa' })
    await submitThroughPortal(client, scenario.tenant, scenario.owner, scenario.organization.id)

    const response = await client
      .get(QUEUE)
      .headers(tenantHeader(scenario.tenant))
      .loginAs(scenario.moderator)
    response.assertStatus(200)
    assert.equal(response.header('cache-control'), 'private, no-store')
    assert.equal(response.header('x-robots-tag'), 'noindex, nofollow')

    const page = parseInertiaPage(response)
    assert.equal(page.component, 'backoffice/organizations/index')
    const props = page.props as unknown as OrganizationReviewQueuePageProps
    assert.equal(props.status, 'pending_review')
    assert.equal(props.counts.pending_review, 1)
    assert.equal(props.counts.active, 1)
    assert.lengthOf(props.organizations, 1)
    const [row] = props.organizations
    assert.equal(row.id, scenario.organization.id)
    assert.equal(row.tax_id, scenario.organization.tax_id)
    assert.equal(row.establishments, 1)
    assert.isString(row.submitted_at)
    assert.deepEqual(row.submitted_by, {
      id: scenario.owner.id,
      full_name: scenario.owner.full_name,
      email: scenario.owner.email,
    })

    const active = await client
      .get(`${QUEUE}?status=active`)
      .headers(tenantHeader(scenario.tenant))
      .loginAs(scenario.admin)
    active.assertStatus(200)
    const activeProps = parseInertiaPage(active)
      .props as unknown as OrganizationReviewQueuePageProps
    assert.deepEqual(
      activeProps.organizations.map((organization) => organization.status),
      ['active']
    )
  })

  test('shows the submitted data, the team and the history of one organization', async ({
    client,
    assert,
  }) => {
    const scenario = await reviewScenario('review-detail')
    await submitThroughPortal(client, scenario.tenant, scenario.owner, scenario.organization.id)

    const response = await client
      .get(`${QUEUE}/${scenario.organization.id}`)
      .headers(tenantHeader(scenario.tenant))
      .loginAs(scenario.moderator)
    response.assertStatus(200)
    const page = parseInertiaPage(response)
    assert.equal(page.component, 'backoffice/organizations/show')
    const props = page.props as unknown as OrganizationReviewPageProps

    assert.equal(props.organization.legal_name, scenario.organization.legal_name)
    assert.equal(props.organization.tax_id, scenario.organization.tax_id)
    assert.equal(props.organization.email, scenario.organization.email)
    assert.equal(props.organization.status, 'pending_review')
    assert.equal(props.submitted_by?.id, scenario.owner.id)
    assert.deepEqual(
      props.members.map((member) => [member.full_name, member.role]),
      [[scenario.owner.full_name, 'owner']]
    )
    assert.lengthOf(props.establishments, 1)
    assert.deepEqual(props.decisions, { approve: true, request_changes: true, reject: true })
    assert.deepInclude(props.history[0], { action: 'submit', actor: scenario.owner.full_name })
  })

  test('approves through the workflow, audits the reason and opens the Portal to the partner', async ({
    client,
    assert,
  }) => {
    const scenario = await reviewScenario('review-approve')
    await submitThroughPortal(client, scenario.tenant, scenario.owner, scenario.organization.id)

    const approved = await decide(
      client,
      scenario.tenant,
      scenario.moderator,
      `${QUEUE}/${scenario.organization.id}/approve`,
      'Razão social, CNPJ e contatos conferidos.'
    )
    approved.assertStatus(302)
    assert.equal(approved.header('location'), QUEUE)
    approved.assertFlashMessage(
      'success',
      'Organização aprovada. O negócio já pode enviar os lugares para a moderação.'
    )

    const organization = await Organization.findOrFail(scenario.organization.id)
    assert.equal(organization.status, 'active')
    assert.equal(organization.reviewed_by, scenario.moderator.id)
    assert.equal(organization.review_notes, 'Razão social, CNPJ e contatos conferidos.')

    const audit = await db
      .from('audit_logs')
      .where('resource', 'organizations')
      .where('action', 'approve')
      .where('resource_id', organization.id)
      .where('user_id', scenario.moderator.id)
      .firstOrFail()
    assert.deepInclude(audit.metadata, {
      status: 'active',
      reason: 'Razão social, CNPJ e contatos conferidos.',
    })

    const portal = await client
      .get(`/portal/organizations/${organization.id}`)
      .headers(tenantHeader(scenario.tenant))
      .loginAs(scenario.owner)
    portal.assertStatus(200)
    const view = parseInertiaPage(portal).props as {
      organization: { status: string; review_notes: string | null }
      allowed_actions: { establishments: { create: boolean } }
    }
    assert.equal(view.organization.status, 'active')
    // The approval note is the operation's; the partner reads a reason only when asked to act.
    assert.isNull(view.organization.review_notes)
    assert.isTrue(view.allowed_actions.establishments.create)

    const detail = await client
      .get(`${QUEUE}/${organization.id}`)
      .headers(tenantHeader(scenario.tenant))
      .loginAs(scenario.moderator)
    const props = parseInertiaPage(detail).props as unknown as OrganizationReviewPageProps
    assert.deepEqual(props.decisions, { approve: false, request_changes: false, reject: false })
    assert.deepInclude(props.history[0], {
      action: 'approve',
      reason: 'Razão social, CNPJ e contatos conferidos.',
      actor: scenario.moderator.full_name,
    })
  })

  test('asks for corrections and rejects with a reason the partner reads in the Portal', async ({
    client,
    assert,
  }) => {
    const scenario = await reviewScenario('review-changes')
    await submitThroughPortal(client, scenario.tenant, scenario.owner, scenario.organization.id)
    const path = `${QUEUE}/${scenario.organization.id}`

    const empty = await decide(
      client,
      scenario.tenant,
      scenario.moderator,
      `${path}/request-changes`,
      ''
    )
    empty.assertStatus(302)
    assert.equal(await statusOf(scenario.organization.id), 'pending_review')

    const reason = 'O CNPJ informado é de outra empresa. Confira o comprovante da Receita.'
    const changes = await decide(
      client,
      scenario.tenant,
      scenario.moderator,
      `${path}/request-changes`,
      reason
    )
    changes.assertStatus(302)
    assert.equal(changes.header('location'), QUEUE)

    const portal = await client
      .get(`/portal/organizations/${scenario.organization.id}`)
      .headers(tenantHeader(scenario.tenant))
      .loginAs(scenario.owner)
    const view = parseInertiaPage(portal).props as {
      organization: { status: string; review_notes: string | null; reviewed_at: string | null }
      allowed_actions: { organizations: { submit: boolean } }
    }
    assert.equal(view.organization.status, 'changes_requested')
    assert.equal(view.organization.review_notes, reason)
    assert.isString(view.organization.reviewed_at)
    assert.isTrue(view.allowed_actions.organizations.submit)

    const overview = await client
      .get('/portal')
      .headers(tenantHeader(scenario.tenant))
      .loginAs(scenario.owner)
    const overviewProps = parseInertiaPage(overview).props as {
      overview: { organizations: Array<{ id: number; review_notes: string | null }> }
    }
    assert.equal(
      overviewProps.overview.organizations.find((item) => item.id === scenario.organization.id)
        ?.review_notes,
      reason
    )

    await submitThroughPortal(client, scenario.tenant, scenario.owner, scenario.organization.id)
    const rejection = 'Cadastro duplicado de um negócio que já está na plataforma.'
    const rejected = await decide(
      client,
      scenario.tenant,
      scenario.admin,
      `${path}/reject`,
      rejection
    )
    rejected.assertStatus(302)
    const closed = await Organization.findOrFail(scenario.organization.id)
    assert.equal(closed.status, 'rejected')
    assert.equal(closed.reviewed_by, scenario.admin.id)

    const rejectedView = parseInertiaPage(
      await client
        .get(`/portal/organizations/${scenario.organization.id}`)
        .headers(tenantHeader(scenario.tenant))
        .loginAs(scenario.owner)
    ).props as { organization: { status: string; review_notes: string | null } }
    assert.equal(rejectedView.organization.status, 'rejected')
    assert.equal(rejectedView.organization.review_notes, rejection)
  })

  test('explains in Portuguese when the organization is no longer in review', async ({
    client,
    assert,
  }) => {
    const scenario = await reviewScenario('review-stale')
    await submitThroughPortal(client, scenario.tenant, scenario.owner, scenario.organization.id)
    const path = `${QUEUE}/${scenario.organization.id}`

    const first = await decide(
      client,
      scenario.tenant,
      scenario.moderator,
      `${path}/approve`,
      'Conferido.'
    )
    first.assertStatus(302)
    const again = await decide(
      client,
      scenario.tenant,
      scenario.admin,
      `${path}/reject`,
      'Decisão atrasada.'
    )
    again.assertStatus(302)
    assert.equal(again.header('location'), path)
    again.assertFlashMessage(
      'error',
      'Esta organização não está mais em análise: outra decisão já foi registrada. Atualize a página para ver a situação atual.'
    )
    assert.equal(await statusOf(scenario.organization.id), 'active')
  })

  test('is closed to partners and ordinary accounts, as the admin API is', async ({ client }) => {
    const scenario = await reviewScenario('review-denied')
    await submitThroughPortal(client, scenario.tenant, scenario.owner, scenario.organization.id)
    const outsider = await createUser({ prefix: 'review-denied-outsider', tenant: scenario.tenant })

    for (const actor of [scenario.owner, outsider]) {
      const queue = await client.get(QUEUE).headers(tenantHeader(scenario.tenant)).loginAs(actor)
      queue.assertStatus(403)
      const detail = await client
        .get(`${QUEUE}/${scenario.organization.id}`)
        .headers(tenantHeader(scenario.tenant))
        .loginAs(actor)
      detail.assertStatus(403)
      const approve = await decide(
        client,
        scenario.tenant,
        actor,
        `${QUEUE}/${scenario.organization.id}/approve`,
        'Eu mesmo aprovo.'
      )
      approve.assertStatus(403)
    }

    const anonymous = await client.get(QUEUE).redirects(0)
    anonymous.assertStatus(302)
  })

  test('lists pending claims and decides them through the claim service', async ({
    client,
    assert,
  }) => {
    const tenant = await createOperation('review-claims')
    const claimant = await createUser({ prefix: 'review-claimant', tenant })
    const moderator = await createUser({
      prefix: 'review-claims-moderator',
      tenant,
      globalRole: IRole.Slugs.MODERATOR,
    })
    const organization = await createOrganization({
      tenant,
      owner: null,
      status: 'active',
      prefix: 'Sem dono',
    })
    const filed = await client
      .post(`/api/v1/organizations/${organization.id}/claims`)
      .header('x-tenant-id', String(tenant.id))
      .loginAs(claimant)
      .json({
        message: 'Sou o sócio responsável.',
        evidence: { description: 'Contrato social.', document_file_ids: [] },
      })
    filed.assertStatus(201)

    const queue = parseInertiaPage(
      await client.get(QUEUE).headers(tenantHeader(tenant)).loginAs(moderator)
    ).props as unknown as OrganizationReviewQueuePageProps
    assert.lengthOf(queue.claims, 1)
    assert.deepInclude(queue.claims[0], {
      id: filed.body().id,
      message: 'Sou o sócio responsável.',
      evidence_description: 'Contrato social.',
      document_count: 0,
    })
    assert.equal(queue.claims[0].organization?.id, organization.id)
    assert.equal(queue.claims[0].claimant?.id, claimant.id)
    assert.deepEqual(queue.claim_decisions, { approve: true, reject: true })

    const approved = await decide(
      client,
      tenant,
      moderator,
      `/backoffice/organization-claims/${filed.body().id}/approve`,
      'Contrato social conferido.'
    )
    approved.assertStatus(302)
    assert.equal(approved.header('location'), QUEUE)
    const claim = await OrganizationClaim.findOrFail(filed.body().id)
    assert.equal(claim.status, 'approved')
    const owner = await OrganizationMember.query()
      .where('organization_id', organization.id)
      .where('user_id', claimant.id)
      .firstOrFail()
    assert.equal(owner.role, 'owner')
    assert.equal(owner.status, 'active')

    const replay = await decide(
      client,
      tenant,
      moderator,
      `/backoffice/organization-claims/${filed.body().id}/reject`,
      'Tarde demais.'
    )
    replay.assertStatus(302)
    replay.assertFlashMessage('error', 'Esta reivindicação já foi decidida. Atualize a página.')
  })

  test('counts the organizations waiting in "Hoje"', async ({ client, assert }) => {
    const scenario = await reviewScenario('review-today')
    await submitThroughPortal(client, scenario.tenant, scenario.owner, scenario.organization.id)

    const today = parseInertiaPage(
      await client
        .get('/backoffice/today')
        .headers(tenantHeader(scenario.tenant))
        .loginAs(scenario.moderator)
        .accept('html')
    ).props as {
      counts: { organizations: number; organization_claims: number }
      inbox: Array<Record<string, unknown>>
    }
    assert.equal(today.counts.organizations, 1)
    assert.equal(today.counts.organization_claims, 0)
    assert.deepInclude(today.inbox[0], {
      source: 'organization',
      id: scenario.organization.id,
      trade_name: scenario.organization.trade_name,
    })
  })
})
