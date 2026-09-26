import { randomUUID } from 'node:crypto'
import app from '@adonisjs/core/services/app'
import ace from '@adonisjs/core/services/ace'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import mail from '@adonisjs/mail/services/main'
import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'

import NotifyOverdueReports from '../../../commands/notify_overdue_reports.js'
import EstablishmentReview from '#modules/reviews/models/establishment_review'
import ContentReportDeadlineRepository from '#modules/reviews/repositories/content_report_deadline_repository'
import ContentReportDeadlineService, {
  OverdueReportsMailer,
} from '#modules/reviews/services/content_report_deadline_service'
import type OverdueReportsNotification from '#modules/reviews/services/overdue_reports_notification'
import { lateness } from '#modules/reviews/services/overdue_reports_notification'
import IRoles from '#modules/roles/interfaces/role_interface'
import type User from '#modules/users/models/user'
import {
  createEstablishmentScenario,
  createPublishedEstablishment,
  type EstablishmentScenario,
} from '#tests/functional/establishments/helpers'
import { createUser } from '#tests/functional/organizations/helpers'

const DAY = 86_400_000
const tenantHeader = (tenantId: number) => ({ 'x-tenant-id': String(tenantId) })

interface Operation {
  scenario: EstablishmentScenario
  moderator: User
  reporter: User
}

async function operation(prefix: string): Promise<Operation> {
  const scenario = await createEstablishmentScenario(prefix)
  const moderator = await createUser({
    prefix: `${prefix}-moderator`,
    tenant: scenario.tenant,
    globalRole: IRoles.Slugs.MODERATOR,
  })
  const reporter = await createUser({ prefix: `${prefix}-reporter`, tenant: scenario.tenant })
  return { scenario, moderator, reporter }
}

/** Files a report through the API, as a person would, and returns its row. */
async function file(client: ApiClient, target: Operation, comment = 'Comida fria e demorada.') {
  const establishment = await createPublishedEstablishment(target.scenario)
  const author = await createUser({
    prefix: `${target.scenario.tenant.slug}-author`,
    tenant: target.scenario.tenant,
  })
  const review = await EstablishmentReview.create({
    tenant_id: target.scenario.tenant.id,
    establishment_id: establishment.id,
    user_id: author.id,
    rating: 2,
    comment,
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
  return filed.body() as { id: number; protocol_number: string; due_at: string }
}

const service = () => app.container.make(ContentReportDeadlineService)

/** The instant after every report filed in the test is past its deadline. */
const afterDeadlines = () => new Date(Date.now() + 30 * DAY)

function noticesFor(mails: { sent(): unknown[] }, operationName: string) {
  return (mails.sent() as OverdueReportsNotification[])
    .filter((notice) => notice.subject.endsWith(`— ${operationName}`))
    .map((notice) => {
      const message = notice.message.toJSON().message as Record<string, unknown>
      return {
        subject: notice.subject,
        to: JSON.stringify(message.to ?? []),
        bcc: JSON.stringify(message.bcc ?? []),
        body: `${message.html}\n${message.text}`,
      }
    })
}

async function marker(reportId: number) {
  const row = await db.from('content_reports').where('id', reportId).first()
  return row.sla_notified_at as Date | null
}

test.group('Content report deadlines (ADR-0027)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.teardown(() => mail.restore())

  test('names each overdue report once, and a second run sends nothing', async ({
    client,
    assert,
  }) => {
    const target = await operation('sla-once')
    const first = await file(client, target)
    const second = await file(client, target)
    const { mails } = mail.fake()
    const now = afterDeadlines()

    await service().then((deadlines) => deadlines.notifyOverdue(now))
    const notices = noticesFor(mails, target.scenario.tenant.name)

    assert.lengthOf(notices, 1)
    assert.include(notices[0].subject, '2 denúncias com prazo vencido')
    assert.include(notices[0].body, first.protocol_number)
    assert.include(notices[0].body, second.protocol_number)
    assert.isNotNull(await marker(first.id))
    assert.isNotNull(await marker(second.id))

    await service().then((deadlines) => deadlines.notifyOverdue(new Date(now.getTime() + DAY)))
    assert.lengthOf(noticesFor(mails, target.scenario.tenant.name), 1)
  })

  test('names protocols and lateness, never who reported or what was written', async ({
    client,
    assert,
  }) => {
    const target = await operation('sla-private')
    const filed = await file(client, target, 'Texto denunciado que não sai da plataforma.')
    const { mails } = mail.fake()

    await service().then((deadlines) => deadlines.notifyOverdue(afterDeadlines()))
    const [notice] = noticesFor(mails, target.scenario.tenant.name)

    assert.include(notice.body, filed.protocol_number)
    assert.include(notice.body, 'Conteúdo ofensivo')
    assert.include(notice.body, 'atraso de')
    assert.notInclude(notice.body, target.reporter.email)
    assert.notInclude(notice.body, target.reporter.full_name)
    assert.notInclude(notice.body, 'Texto denunciado')
    // Staff are in blind copy: one message, and nobody learns the others' addresses.
    assert.include(notice.bcc, target.moderator.email)
    assert.notInclude(notice.to, target.moderator.email)
  })

  test('decided reports and reports still within their deadline are never named', async ({
    client,
    assert,
  }) => {
    const target = await operation('sla-decided')
    const resolved = await file(client, target)
    const dismissed = await file(client, target)
    const fresh = await file(client, target)
    const headers = tenantHeader(target.scenario.tenant.id)

    for (const [report, status] of [
      [resolved, 'resolved'],
      [dismissed, 'dismissed'],
    ] as const) {
      await client
        .post(`/api/v1/admin/content-reports/${report.id}/resolve`)
        .headers(headers)
        .loginAs(target.moderator)
        .json({ status })
    }
    const { mails } = mail.fake()

    // Just after the filing: nothing is due yet.
    await service().then((deadlines) => deadlines.notifyOverdue(new Date()))
    assert.lengthOf(noticesFor(mails, target.scenario.tenant.name), 0)
    assert.isNull(await marker(fresh.id))

    await service().then((deadlines) => deadlines.notifyOverdue(afterDeadlines()))
    const [notice] = noticesFor(mails, target.scenario.tenant.name)
    assert.include(notice.body, fresh.protocol_number)
    assert.notInclude(notice.body, resolved.protocol_number)
    assert.notInclude(notice.body, dismissed.protocol_number)
    assert.isNull(await marker(resolved.id))
    assert.isNull(await marker(dismissed.id))
  })

  test('a report under review is still open, and is named when late', async ({
    client,
    assert,
  }) => {
    const target = await operation('sla-review')
    const filed = await file(client, target)
    await db.from('content_reports').where('id', filed.id).update({ status: 'under_review' })
    const { mails } = mail.fake()

    await service().then((deadlines) => deadlines.notifyOverdue(afterDeadlines()))

    assert.include(noticesFor(mails, target.scenario.tenant.name)[0].body, filed.protocol_number)
  })

  test('each operation gets one message, about its own cases, sent to its own staff', async ({
    client,
    assert,
  }) => {
    const alpha = await operation('sla-alpha')
    const beta = await operation('sla-beta')
    const inAlpha = await file(client, alpha)
    await file(client, alpha)
    const inBeta = await file(client, beta)
    const { mails } = mail.fake()

    await service().then((deadlines) => deadlines.notifyOverdue(afterDeadlines()))
    const alphaNotices = noticesFor(mails, alpha.scenario.tenant.name)
    const betaNotices = noticesFor(mails, beta.scenario.tenant.name)

    assert.lengthOf(alphaNotices, 1)
    assert.lengthOf(betaNotices, 1)
    assert.include(alphaNotices[0].body, inAlpha.protocol_number)
    assert.notInclude(alphaNotices[0].body, inBeta.protocol_number)
    assert.include(alphaNotices[0].bcc, alpha.moderator.email)
    assert.notInclude(alphaNotices[0].bcc, beta.moderator.email)
    assert.include(betaNotices[0].bcc, beta.moderator.email)
    assert.notInclude(betaNotices[0].bcc, alpha.moderator.email)
  })

  test('with nobody who can act, nothing is marked, so the case is named once someone can', async ({
    client,
    assert,
  }) => {
    const target = await operation('sla-nobody')
    const filed = await file(client, target)
    // The only staff member leaves the operation.
    await db
      .from('user_tenants')
      .where('user_id', target.moderator.id)
      .where('tenant_id', target.scenario.tenant.id)
      .delete()
    const { mails } = mail.fake()

    const result = await service().then((deadlines) => deadlines.notifyOverdue(afterDeadlines()))

    assert.isTrue(
      result.operations.some(
        (entry) => entry.tenant_id === target.scenario.tenant.id && entry.without_recipients
      )
    )
    assert.lengthOf(noticesFor(mails, target.scenario.tenant.name), 0)
    assert.isNull(await marker(filed.id))
  })

  test('a notice that could not be sent gives its claim back for the next run', async ({
    client,
    assert,
  }) => {
    const target = await operation('sla-retry')
    const filed = await file(client, target)
    const now = afterDeadlines()

    app.container.swap(OverdueReportsMailer, () => {
      const failing = new OverdueReportsMailer()
      failing.send = async () => {
        throw new Error('SMTP unavailable')
      }
      return failing
    })
    try {
      const failed = await service().then((deadlines) => deadlines.notifyOverdue(now))
      assert.isTrue(
        failed.operations.some(
          (entry) => entry.tenant_id === target.scenario.tenant.id && entry.failed
        )
      )
      assert.isNull(await marker(filed.id), 'the claim must be given back')
    } finally {
      app.container.restore(OverdueReportsMailer)
    }

    const { mails } = mail.fake()
    await service().then((deadlines) => deadlines.notifyOverdue(now))
    assert.include(noticesFor(mails, target.scenario.tenant.name)[0].body, filed.protocol_number)
    assert.isNotNull(await marker(filed.id))
  })

  test('the command runs the same sweep and exits 1 when a notice could not be sent', async ({
    client,
    assert,
  }) => {
    // The command's own logic is its exit code: a scheduler that watches it
    // must see a notice that did not go out, and the next run retries it.
    const target = await operation('sla-command')
    const filed = await file(client, target)
    await db
      .from('content_reports')
      .where('id', filed.id)
      .update({ due_at: new Date(Date.now() - 2 * DAY) })

    app.container.swap(OverdueReportsMailer, () => {
      const failing = new OverdueReportsMailer()
      failing.send = async () => {
        throw new Error('SMTP unavailable')
      }
      return failing
    })
    try {
      const failing = await ace.create(NotifyOverdueReports, [])
      await failing.exec()
      assert.equal(failing.exitCode, 1)
      assert.isNull(await marker(filed.id))
    } finally {
      app.container.restore(OverdueReportsMailer)
    }

    mail.fake()
    const succeeding = await ace.create(NotifyOverdueReports, [])
    await succeeding.exec()
    succeeding.assertSucceeded()
    assert.isNotNull(await marker(filed.id))
  })

  test('the queue shows the overdue total of the whole operation, not of one page', async ({
    client,
    assert,
  }) => {
    const target = await operation('sla-page')
    const late = [
      await file(client, target),
      await file(client, target),
      await file(client, target),
    ]
    await file(client, target)
    await db
      .from('content_reports')
      .whereIn(
        'id',
        late.map((report) => report.id)
      )
      .update({ due_at: new Date(Date.now() - DAY) })

    const page = await client
      .get('/backoffice/reports?per_page=1')
      .headers(tenantHeader(target.scenario.tenant.id))
      .loginAs(target.moderator)

    page.assertStatus(200)
    assert.include(page.text(), '"overdue_total":3')
  })

  test('says how late in words a moderator reads at a glance', ({ assert }) => {
    const now = new Date('2026-09-23T12:00:00Z')
    assert.equal(lateness(new Date('2026-09-23T11:30:00Z'), now), 'menos de uma hora')
    assert.equal(lateness(new Date('2026-09-23T11:00:00Z'), now), '1 hora')
    assert.equal(lateness(new Date('2026-09-23T07:00:00Z'), now), '5 horas')
    assert.equal(lateness(new Date('2026-09-22T11:00:00Z'), now), '1 dia')
    assert.equal(lateness(new Date('2026-09-20T12:00:00Z'), now), '3 dias')
  })
})

/**
 * Two runs at once — independent transactions, like the purchase suites.
 *
 * The group above runs inside one global transaction, where two runs share a
 * connection and cannot contend at all. Here the fixtures are committed to the
 * disposable test database and the second claim is made to wait on the first
 * one's row locks, so the test proves what the single conditional UPDATE is for.
 */
test.group('Content report deadlines under concurrency (independent transactions)', () => {
  // Committed fixtures outlive the run, so a fixed prefix collides on the next one.
  const committed = (prefix: string) => operation(`${prefix}-${randomUUID().slice(0, 8)}`)

  async function waitForLockWaiter() {
    for (let attempt = 0; attempt < 100; attempt++) {
      const { rows } = await db.rawQuery(
        `SELECT count(*) AS total FROM pg_stat_activity
         WHERE datname = current_database() AND wait_event_type = 'Lock'
         AND query LIKE '%content_reports%' AND cardinality(pg_blocking_pids(pid)) > 0`
      )
      if (Number(rows[0].total) > 0) return
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
    throw new Error('Expected the second claim to wait on the first one')
  }

  test('a claim that waits on another run finds nothing left to claim', async ({
    client,
    assert,
    cleanup,
  }) => {
    assert.equal(db.connectionGlobalTransactions.size, 0)
    const target = await committed('sla-race')
    const filed = [await file(client, target), await file(client, target)]
    cleanup(async () => {
      await db
        .from('content_reports')
        .whereIn(
          'id',
          filed.map((report) => report.id)
        )
        .update({ sla_notified_at: new Date() })
    })

    const repository = new ContentReportDeadlineRepository()
    const now = afterDeadlines()
    const first = await db.transaction()
    let firstClaimed: number
    let secondClaimed: number
    try {
      const claimedByFirst = await repository.claimOverdue(target.scenario.tenant.id, now, first)
      firstClaimed = claimedByFirst.length
      const second = db.transaction((trx) =>
        repository.claimOverdue(target.scenario.tenant.id, now, trx)
      )
      await waitForLockWaiter()
      await first.commit()
      const claimedBySecond = await second
      secondClaimed = claimedBySecond.length
    } catch (error) {
      await first.rollback().catch(() => {})
      throw error
    }

    assert.equal(firstClaimed, 2)
    assert.equal(secondClaimed, 0)
  })

  test('two sweeps at once send one message for the operation', async ({ client, assert }) => {
    assert.equal(db.connectionGlobalTransactions.size, 0)
    const target = await committed('sla-sweeps')
    await file(client, target)
    await file(client, target)
    const { mails } = mail.fake()
    try {
      const now = afterDeadlines()
      const [left, right] = await Promise.all([
        service().then((deadlines) => deadlines.notifyOverdue(now)),
        service().then((deadlines) => deadlines.notifyOverdue(now)),
      ])
      const named = [...left.operations, ...right.operations]
        .filter((entry) => entry.tenant_id === target.scenario.tenant.id)
        .reduce((total, entry) => total + entry.noticed, 0)

      assert.equal(named, 2)
      assert.lengthOf(noticesFor(mails, target.scenario.tenant.name), 1)
    } finally {
      mail.restore()
    }
  })
})
