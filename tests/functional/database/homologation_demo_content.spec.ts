import { randomBytes, randomUUID } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { mock } from 'node:test'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import db from '@adonisjs/lucid/services/db'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import env from '#start/env'
import AuditLog from '#modules/audits/models/audit_log'
import EstablishmentEvent from '#modules/partner_content/models/establishment_event'
import EstablishmentExperience from '#modules/partner_content/models/establishment_experience'
import EstablishmentShowcaseItem from '#modules/partner_content/models/establishment_showcase_item'
import PartnerContentPolicyRepository from '#modules/partner_content/repositories/partner_content_policy_repository'
import PartnerContentService from '#modules/partner_content/services/partner_content_service'
import ContentReport from '#modules/reviews/models/content_report'
import EstablishmentReview from '#modules/reviews/models/establishment_review'
import EstablishmentReviewReply from '#modules/reviews/models/establishment_review_reply'
import { DEMO_CONTENT_ACTION } from '#modules/tenants/services/homologation_demo_content'
import HomologationProvisioningService from '#modules/tenants/services/homologation_provisioning_service'
import {
  ACCOUNT_KINDS,
  type HomologationProvisioningConfig,
} from '#modules/tenants/services/homologation_provisioning_config'
import User from '#modules/users/models/user'
import { useFakePayments } from '#tests/helpers/fake_payments'

function configuration(): HomologationProvisioningConfig {
  const accounts = {} as HomologationProvisioningConfig['accounts']
  for (const kind of ACCOUNT_KINDS)
    accounts[kind] = {
      fullName: 'Demonstração ' + kind,
      email: randomUUID() + '@example.test',
      password: randomBytes(32).toString('base64url') + 'aB7',
    }
  return {
    tenantSlug: 'demo-' + randomUUID().slice(0, 8),
    tenantName: 'Homologação demonstrativa',
    accounts,
  }
}

/** A fixed local instant in Londrina, so "today" never straddles midnight during a run. */
const londrina = (iso: string) => DateTime.fromISO(iso, { zone: 'America/Sao_Paulo' }).toUTC()

test.group('Homologation demonstration content', (group) => {
  group.each.setup(() => useFakePayments())
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.teardown(() => mock.restoreAll())
  // The limiter is in memory and shared by the whole test process; the public
  // reads below must not spend the quota of the next spec.
  group.each.setup(async () => {
    await limiter.clear()
    return () => limiter.clear()
  })

  function deployment(value: string | undefined) {
    const original = env.get.bind(env)
    mock.method(env, 'get', (key: string, fallback?: string) =>
      key === 'DEPLOYMENT_ENV' ? value : (original(key) ?? fallback)
    )
  }

  async function baseline(cleanup: (fn: () => Promise<void>) => void) {
    deployment('homologation')
    const input = configuration()
    cleanup(() =>
      rm(app.makePath('storage', 'homologation/media/v1/fs', input.tenantSlug), {
        recursive: true,
        force: true,
      })
    )
    const service = new HomologationProvisioningService()
    const receipt = await service.run(input)
    return { input, service, receipt }
  }

  const host = (slug: string) => slug + '.experimente.test'

  test('provisions every kind of demonstration content through the domain', async ({
    assert,
    cleanup,
  }) => {
    const { input, service, receipt } = await baseline(cleanup)
    const now = londrina('2026-09-23T14:00:00')

    const outcome = await service.provisionDemoContent(input, now)

    assert.isEmpty(outcome.notCreated)
    assert.sameMembers(outcome.created, [
      'experience:atelier:oficina',
      'experience:petiscos:mesa',
      'showcase:atelier:graos',
      'showcase:petiscos:porcao',
      'event:samba:2026-09-23',
      'event:degustacao:2026-09-25',
      'event:festival:2026-09-28',
      'review:atelier',
      'review:petiscos',
      'report:showcase',
    ])

    const tenant = receipt.tenantId
    const experiences = await EstablishmentExperience.query().where('tenant_id', tenant)
    const showcase = await EstablishmentShowcaseItem.query().where('tenant_id', tenant)
    const events = await EstablishmentEvent.query().where('tenant_id', tenant)
    for (const item of [...experiences, ...showcase, ...events]) {
      // Published through submit and, for events, approval: the snapshot is what
      // the public reads, and it exists only if the lifecycle ran.
      assert.equal(item.status, 'published')
      assert.isNotNull(item.published_snapshot)
      assert.include(item.title, 'demonstração')
      assert.equal(item.created_by, receipt.accounts.partner)
    }
    assert.lengthOf(experiences, 2)
    assert.sameMembers(
      showcase.map((item) => item.informational_price_cents),
      [3900, 4500]
    )
    assert.lengthOf(events, 3)

    const reviews = await EstablishmentReview.query().where('tenant_id', tenant)
    assert.lengthOf(reviews, 2)
    for (const review of reviews) {
      assert.equal(review.user_id, receipt.accounts.customer)
      assert.equal(review.status, 'published')
      const reply = await EstablishmentReviewReply.query().where('review_id', review.id).first()
      assert.equal(reply?.user_id, receipt.accounts.partner)
    }

    const reports = await ContentReport.query().where('tenant_id', tenant)
    assert.lengthOf(reports, 1, 'the demo texts must trip no automatic rule')
    assert.equal(reports[0].status, 'pending')
    assert.equal(reports[0].target_type, 'showcase_item')
    assert.equal(reports[0].reporter_id, receipt.accounts.customer)
  })

  test('the public surfaces show the demonstration', async ({ assert, client, cleanup }) => {
    const { input, service, receipt } = await baseline(cleanup)
    // Real time, because the public agenda compares against the clock.
    await service.provisionDemoContent(input)

    const agenda = await client
      .get('/api/v1/catalog/cities/londrina/agenda')
      .header('host', host(input.tenantSlug))
    agenda.assertStatus(200)
    const today = agenda.body().happening_today.map((item: any) => item.title)
    assert.lengthOf(today, 1)
    assert.match(today[0], /^Noite de samba ao vivo — demonstração/)
    assert.lengthOf(agenda.body().upcoming, 2)
    assert.lengthOf(agenda.body().new_experiences, 2)

    const [atelier] = receipt.establishmentIds.slice(-1)
    for (const [kind, count] of [
      ['experiences', 1],
      ['showcase-items', 1],
      ['events', 1],
    ] as const) {
      const listed = await client
        .get(`/api/v1/catalog/establishments/${atelier}/${kind}`)
        .header('host', host(input.tenantSlug))
      listed.assertStatus(200)
      assert.lengthOf(listed.body().data, count, kind)
    }

    const reviews = await client
      .get(`/api/v1/catalog/establishments/${atelier}/reviews`)
      .header('host', host(input.tenantSlug))
    reviews.assertStatus(200)
    assert.lengthOf(reviews.body().data, 1)
    assert.isNotNull(reviews.body().data[0].reply)

    const detail = await client
      .get('/api/v1/catalog/cities/londrina/establishments/atelier-do-cafe-demo')
      .header('host', host(input.tenantSlug))
    detail.assertStatus(200)
    assert.deepEqual(detail.body().reviews, { count: 1, average: 5 })
  })

  test('running again creates nothing and changes nothing', async ({ assert, cleanup }) => {
    const { input, service, receipt } = await baseline(cleanup)
    const now = londrina('2026-09-23T14:00:00')
    await service.provisionDemoContent(input, now)
    const counted = async () => ({
      events: await EstablishmentEvent.query().where('tenant_id', receipt.tenantId).count('* as n'),
      reviews: await EstablishmentReview.query()
        .where('tenant_id', receipt.tenantId)
        .count('* as n'),
      markers: await AuditLog.query()
        .where('resource_id', receipt.tenantId)
        .where('action', DEMO_CONTENT_ACTION)
        .count('* as n'),
    })
    const before = JSON.stringify(await counted())

    const again = await service.provisionDemoContent(input, now.plus({ hours: 3 }))

    assert.isEmpty(again.created)
    assert.lengthOf(again.alreadyPresent, 10)
    assert.equal(JSON.stringify(await counted()), before)
  })

  test('a run on a later day adds that day’s events and nothing else', async ({
    assert,
    cleanup,
  }) => {
    const { input, service, receipt } = await baseline(cleanup)
    await service.provisionDemoContent(input, londrina('2026-09-23T14:00:00'))

    const next = await service.provisionDemoContent(input, londrina('2026-09-24T09:00:00'))

    assert.sameMembers(next.created, [
      'event:samba:2026-09-24',
      'event:degustacao:2026-09-26',
      'event:festival:2026-09-29',
    ])
    const events = await EstablishmentEvent.query().where('tenant_id', receipt.tenantId)
    assert.lengthOf(events, 6)
    // Yesterday's events were not edited to follow the calendar.
    const samba = events.filter((event) => event.title.startsWith('Noite de samba'))
    assert.sameMembers(
      samba.map((event) => event.title),
      [
        'Noite de samba ao vivo — demonstração (23/09)',
        'Noite de samba ao vivo — demonstração (24/09)',
      ]
    )
  })

  test('events sit where the city calendar says, relative to the run', async ({
    assert,
    cleanup,
  }) => {
    const { input, service, receipt } = await baseline(cleanup)
    const now = londrina('2026-09-23T14:00:00')
    await service.provisionDemoContent(input, now)

    const events = await EstablishmentEvent.query().where('tenant_id', receipt.tenantId)
    const today = events.find((event) => event.title.startsWith('Noite de samba'))!
    // With no notice, today's event is already running: it is "acontecendo hoje"
    // the moment the run ends.
    assert.isTrue(today.starts_at < now && today.ends_at > now)

    const degustacao = events.find((event) => event.title.startsWith('Tarde de degustação'))!
    const local = degustacao.starts_at.setZone('America/Sao_Paulo')
    assert.equal(local.toISODate(), '2026-09-25')
    assert.equal(local.hour, 16)
  })

  test('a minimum notice moves today’s event forward, or reports why it cannot', async ({
    assert,
    cleanup,
  }) => {
    const { input, service, receipt } = await baseline(cleanup)
    await new PartnerContentPolicyRepository().updateForTenant(receipt.tenantId, {
      min_event_notice_minutes: 60,
    })

    const morning = londrina('2026-09-23T10:00:00')
    await service.provisionDemoContent(input, morning)
    const today = await EstablishmentEvent.query()
      .where('tenant_id', receipt.tenantId)
      .whereILike('title', 'Noite de samba%')
      .firstOrFail()
    assert.isTrue(today.starts_at > morning.plus({ minutes: 60 }))

    const lateNight = await service.provisionDemoContent(input, londrina('2026-09-24T23:30:00'))
    assert.deepInclude(
      lateNight.notCreated.map((skip) => skip.key),
      'event:samba:today'
    )
  })

  test('what a moderator withdrew stays withdrawn on the next run', async ({ assert, cleanup }) => {
    const { input, service, receipt } = await baseline(cleanup)
    const now = londrina('2026-09-23T14:00:00')
    await service.provisionDemoContent(input, now)

    const oficina = await EstablishmentExperience.query()
      .where('tenant_id', receipt.tenantId)
      .where('title', 'Oficina de métodos de preparo — demonstração')
      .firstOrFail()
    const administrator = await User.findOrFail(receipt.accounts.administrator)
    const content = await app.container.make(PartnerContentService)
    await content.archive('experience', receipt.tenantId, oficina.id, administrator, {
      asModerator: true,
    })

    const again = await service.provisionDemoContent(input, now.plus({ hours: 1 }))

    assert.include(again.alreadyPresent, 'experience:atelier:oficina')
    await oficina.refresh()
    assert.equal(oficina.status, 'archived')
    const count = await EstablishmentExperience.query()
      .where('tenant_id', receipt.tenantId)
      .where('title', 'Oficina de métodos de preparo — demonstração')
    assert.lengthOf(count, 1)
  })

  test('refused outside homologation, and never without the baseline', async ({ assert }) => {
    for (const value of [undefined, 'invalid', 'production', 'development']) {
      deployment(value)
      await assert.rejects(
        () => new HomologationProvisioningService().provisionDemoContent(configuration()),
        /DEPLOYMENT_ENV/
      )
      mock.restoreAll()
    }

    deployment('homologation')
    await assert.rejects(
      () => new HomologationProvisioningService().provisionDemoContent(configuration()),
      /run homologation:provision/
    )
    const markers = await db.from('audit_logs').where('action', DEMO_CONTENT_ACTION)
    assert.lengthOf(markers, 0)
  })
})
