import { randomUUID } from 'node:crypto'
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { createPurchaseFixture } from '#database/factories/scenarios/purchase_flow_factory'
import { useFakePayments } from '#tests/helpers/fake_payments'
import PurchaseRepository from '#modules/purchases/repositories/purchase_repository'
import PurchaseProcessingService from '#modules/purchases/services/purchase_processing_service'
import PurchaseOperationsService from '#modules/purchases/services/purchase_operations_service'
import PurchaseService from '#modules/purchases/services/purchase_service'
import FakePaymentAdapter from '#modules/purchases/adapters/fake_payment_adapter'
import BenefitRedemptionRepository from '#modules/benefits/repositories/benefit_redemption_repository'
import BenefitRedemptionService from '#modules/benefits/services/benefit_redemption_service'
import BenefitPresentationTokenService from '#modules/benefits/services/benefit_presentation_token_service'
import BenefitAuditService from '#modules/benefits/services/benefit_audit_service'
import OrganizationPolicyService from '#modules/organizations/services/organization_policy_service'
import OrganizationResourceAuthorizationService from '#modules/organizations/services/organization_resource_authorization_service'
import PublicOperationResolver from '#modules/tenants/services/public_operation_resolver'
import PaymentMethodsService from '#modules/purchases/services/payment_methods_service'

// Like create_concurrency.spec.ts, repositories synchronize real independent transactions.
// This two-phase barrier also lets the test inspect the database while the worker is paused.
function barrier() {
  let arrive!: () => void
  let release!: () => void
  const reached = new Promise<void>((resolve) => (arrive = resolve))
  const gate = new Promise<void>((resolve) => (release = resolve))
  return {
    reached,
    release,
    wait: async () => {
      arrive()
      await gate
    },
  }
}

// Keep the real PostgreSQL claim/fencing implementation, but never drain another spec's ledger.
class ScopedRepository extends PurchaseRepository {
  constructor(readonly purchaseId: string) {
    super()
  }
  override commands(client?: TransactionClientContract) {
    return super.commands(client).where('purchase_id', this.purchaseId)
  }
}

class PausedWorkerRepository extends ScopedRepository {
  readonly gate = barrier()
  private paused = false
  override async get(...args: Parameters<PurchaseRepository['get']>) {
    const purchase = await super.get(...args)
    if (!args[1] && !this.paused) {
      this.paused = true
      await this.gate.wait()
    }
    return purchase
  }
}

function worker(repo: PurchaseRepository, adapter = new FakePaymentAdapter()) {
  return new PurchaseProcessingService(repo, { get: () => adapter })
}

async function enqueue(repo: ScopedRepository, key = randomUUID()) {
  await db.transaction((trx) => repo.enqueue(repo.purchaseId, 'reconcile', key, trx))
}

// Independent transactions cannot roll back immutable financial facts. Retire only these
// fixtures' accounts afterward so global user discovery is not polluted by this spec.
const fixtureUsers = new Set<number>()
async function isolatedFixture(...args: Parameters<typeof createPurchaseFixture>) {
  const fixture = await createPurchaseFixture(...args)
  for (const user of Object.values(fixture.s.users)) fixtureUsers.add(user.id)
  return fixture
}

async function setupPurchase(paid = false) {
  const f = await isolatedFixture({ product: 'offer', maxRedemptionsPerAccess: 1 })
  const initial = await f.create()
  const repo = new ScopedRepository(initial.id)
  await worker(repo).drain()
  await f.fake.simulate('fake_' + initial.id, { state: 'paid', paidAt: new Date().toISOString() })
  await enqueue(repo)
  if (paid) await worker(repo).drain()
  return { ...f, repo, purchase: (await repo.get(initial.id))! }
}

async function grantEvents(repo: ScopedRepository) {
  return repo.events().where({ purchase_id: repo.purchaseId, action: 'access_granted' })
}

async function purchaseService(repo: PurchaseRepository) {
  return new PurchaseService(
    repo,
    { get: () => new FakePaymentAdapter() },
    await app.container.make(OrganizationPolicyService),
    await app.container.make(PublicOperationResolver),
    await app.container.make(PaymentMethodsService)
  )
}

async function redemptionService(repo: BenefitRedemptionRepository) {
  return new BenefitRedemptionService(
    repo,
    await app.container.make(BenefitPresentationTokenService),
    await app.container.make(OrganizationPolicyService),
    await app.container.make(OrganizationResourceAuthorizationService),
    await app.container.make(BenefitAuditService)
  )
}

// Observe actual PostgreSQL contenders before releasing a repository barrier. No timers:
// a missing mutex must fail the test, not silently run the scenario sequentially.
async function waitForAccessContenders(count: number) {
  for (let attempt = 0; attempt < 500; attempt++) {
    const { rows } = await db.rawQuery(
      `SELECT count(*) AS total FROM pg_stat_activity
       WHERE datname = current_database() AND wait_event_type = 'Lock'
       AND query LIKE '%benefit_accesses%' AND cardinality(pg_blocking_pids(pid)) > 0`
    )
    if (Number(rows[0].total) >= count) return
  }
  throw new Error('Expected concurrent PostgreSQL access mutex contenders')
}

test.group('Purchase command concurrency and fencing (independent transactions)', (group) => {
  group.each.setup(() => {
    const restore = useFakePayments({ autoRefundUnused: true })
    return async () => {
      try {
        if (fixtureUsers.size)
          await db
            .from('users')
            .whereIn('id', [...fixtureUsers])
            .update({ is_deleted: true })
      } finally {
        fixtureUsers.clear()
        restore()
      }
    }
  })
  // Financial facts are immutable: committed fixtures live only in the disposable test database.
  test('reclaims an expired processing lease while its old worker is in flight and grants once', async ({
    assert,
    cleanup,
  }) => {
    assert.equal(db.connectionGlobalTransactions.size, 0)
    const f = await setupPurchase()
    const oldRepo = new PausedWorkerRepository(f.purchase.id)
    const oldWork = worker(oldRepo).drain(1)
    cleanup(async () => {
      oldRepo.gate.release()
      await Promise.allSettled([oldWork])
    })
    await oldRepo.gate.reached
    const leased = await f.repo.commands().where('status', 'processing').firstOrFail()
    // Change persisted clock input, never wait for a wall-clock timeout.
    await f.repo
      .commands()
      .where('id', leased.id)
      .update({ lease_until: new Date(0) })
    assert.deepEqual(await worker(f.repo).drain(1), { processed: 1, deferred: 0 })
    const successor = await f.repo.commands().where('id', leased.id).firstOrFail()
    assert.notEqual(successor.lease_token, leased.lease_token)
    assert.equal(successor.attempts, leased.attempts + 1)
    assert.equal(successor.status, 'done')
    oldRepo.gate.release()
    await oldWork
    const paid = (await f.repo.get(f.purchase.id))!
    assert.equal(paid.status, 'paid')
    assert.isNotNull(paid.access_id)
    assert.lengthOf(
      await db
        .from('benefit_accesses')
        .where({ tenant_id: f.s.tenant.id, user_id: f.s.users.holder.id }),
      1
    )
    assert.lengthOf(await grantEvents(f.repo), 1)
    assert.deepEqual(await f.repo.commands().where('id', leased.id).first(), successor)
  })

  for (const outcome of ['paid', 'mismatch', 'timeout-retry', 'timeout-review'] as const) {
    test(
      'fences a stale worker on ' + outcome + ' without mutation or hold release',
      async ({ assert, cleanup }) => {
        const f = await setupPurchase()
        await f.repo
          .commands()
          .where('status', 'pending')
          .update({
            dedupe_key: 'operator:' + randomUUID(),
            attempts: outcome === 'timeout-review' ? 9 : 0,
          })
        await db.transaction((trx) => f.repo.hold(f.purchase, 'reconciliation', trx))
        class ObservationAdapter extends FakePaymentAdapter {
          override async get(...args: Parameters<FakePaymentAdapter['get']>) {
            const observed = await super.get(...args)
            if (outcome.startsWith('timeout')) throw new Error('Simulated lost response')
            return outcome === 'mismatch'
              ? { ...observed, amountCents: observed.amountCents + 1 }
              : observed
          }
        }
        const oldRepo = new PausedWorkerRepository(f.purchase.id)
        const oldWork = worker(oldRepo, new ObservationAdapter()).drain(1)
        cleanup(async () => {
          oldRepo.gate.release()
          await Promise.allSettled([oldWork])
        })
        await oldRepo.gate.reached
        const old = await f.repo.commands().where('status', 'processing').firstOrFail()
        await f.repo
          .commands()
          .where('id', old.id)
          .update({ lease_until: new Date(0) })
        const successor = await f.repo.claim()
        assert.isNotNull(successor)
        assert.notEqual(successor!.lease_token, old.lease_token)
        const before = await f.repo.commands().where('id', old.id).firstOrFail()
        const holdsBefore = await f.repo.holds().where('purchase_id', f.purchase.id)
        const eventsBefore = await f.repo.events().where('purchase_id', f.purchase.id).orderBy('id')
        oldRepo.gate.release()
        await oldWork
        assert.deepEqual(await f.repo.commands().where('id', old.id).first(), before)
        assert.deepEqual(await f.repo.get(f.purchase.id), f.purchase)
        assert.deepEqual(await f.repo.holds().where('purchase_id', f.purchase.id), holdsBefore)
        assert.deepEqual(
          await f.repo.events().where('purchase_id', f.purchase.id).orderBy('id'),
          eventsBefore
        )
        assert.lengthOf(await grantEvents(f.repo), 0)
        // The successor, unlike the stale worker, can complete and release reconciliation.
        await f.repo
          .commands()
          .where('id', old.id)
          .update({ lease_until: new Date(0) })
        await worker(f.repo).drain(1)
        assert.equal((await f.repo.get(f.purchase.id))!.status, 'paid')
        const releasedHold = await f.repo.holds().where('purchase_id', f.purchase.id).firstOrFail()
        assert.isNotNull(releasedHold.released_at)
        assert.lengthOf(await grantEvents(f.repo), 1)
      }
    )
  }

  test('lost create response retains the hold and grants only after authenticated recovery', async ({
    assert,
  }) => {
    const f = await isolatedFixture({ product: 'offer' })
    const p = await f.create()
    const repo = new ScopedRepository(p.id)
    const purchase = (await repo.get(p.id))!
    await db.transaction((trx) => repo.hold(purchase, 'reconciliation', trx))
    class LostCreateResponse extends FakePaymentAdapter {
      calls = 0
      override async create(
        ...args: Parameters<FakePaymentAdapter['create']>
      ): ReturnType<FakePaymentAdapter['create']> {
        this.calls++
        const observed = await super.create(...args)
        await this.simulate(observed.id, { state: 'paid', paidAt: new Date().toISOString() })
        throw new Error('Simulated response lost after provider accepted payment')
      }
    }
    const adapter = new LostCreateResponse()
    assert.deepEqual(await worker(repo, adapter).drain(1), { processed: 0, deferred: 1 })
    const providerPayment = await f.fake.get('fake_' + p.id)
    assert.equal(providerPayment.state, 'paid')
    const unknown = (await repo.get(p.id))!
    assert.equal(unknown.status, 'pending')
    assert.isNull(unknown.access_id)
    assert.lengthOf(await grantEvents(repo), 0)
    const command = await repo.commands().firstOrFail()
    assert.equal(command.status, 'pending')
    assert.isNull(command.lease_until)
    assert.equal(command.last_error, 'provider_or_processing_unavailable')
    assert.isAbove(command.available_at.getTime(), unknown.created_at.getTime())
    const heldAfterTimeout = await repo.holds().where('purchase_id', p.id).firstOrFail()
    assert.isNull(heldAfterTimeout.released_at)
    await repo
      .commands()
      .where('id', command.id)
      .update({ available_at: new Date(0) })
    assert.deepEqual(await worker(repo, adapter).drain(1), { processed: 1, deferred: 0 })
    assert.equal(adapter.calls, 1)
    assert.equal((await repo.get(p.id))!.status, 'paid')
    assert.lengthOf(await grantEvents(repo), 1)
    // Recovery of creation alone does not authorize removal of an operator reconciliation hold.
    const heldAfterRecovery = await repo.holds().where('purchase_id', p.id).firstOrFail()
    assert.isNull(heldAfterRecovery.released_at)
  })

  test('lost refund response retains the hold until recovery and releases it only once', async ({
    assert,
  }) => {
    const f = await setupPurchase(true)
    const r = await f.service.refund(
      f.s.tenant.id,
      f.s.users.holder,
      f.purchase.id,
      randomUUID(),
      'Refund response loss'
    )
    class LostRefundResponse extends FakePaymentAdapter {
      calls = 0
      override async refund(...args: Parameters<FakePaymentAdapter['refund']>) {
        this.calls++
        await super.refund(...args)
        throw new Error('Simulated response lost after provider refunded')
      }
    }
    const adapter = new LostRefundResponse()
    assert.deepEqual(await worker(f.repo, adapter).drain(1), { processed: 0, deferred: 1 })
    const providerRefund = await f.fake.get('fake_' + f.purchase.id)
    assert.equal(providerRefund.refundedCents, f.purchase.amount_cents)
    assert.equal((await f.repo.get(f.purchase.id))!.status, 'paid')
    assert.equal((await f.repo.refund(r.id))!.status, 'processing')
    const hold = await f.repo
      .holds()
      .where({ purchase_id: f.purchase.id, reason: 'refund:' + r.id })
      .firstOrFail()
    assert.isNull(hold.released_at)
    assert.lengthOf(await grantEvents(f.repo), 1)
    const command = await f.repo.commands().where('kind', 'refund').firstOrFail()
    assert.equal(command.status, 'pending')
    assert.isNull(command.lease_until)
    await f.repo
      .commands()
      .where('id', command.id)
      .update({ available_at: new Date(0) })
    await worker(f.repo, adapter).drain(1)
    assert.equal(adapter.calls, 1)
    assert.equal((await f.repo.refund(r.id))!.status, 'succeeded')
    const released = await f.repo.holds().where('id', hold.id).firstOrFail()
    assert.isNotNull(released.released_at)
    await enqueue(f.repo)
    await worker(f.repo).drain(1)
    assert.deepEqual(await f.repo.holds().where('id', hold.id).first(), released)
    assert.lengthOf(
      await f.repo.events().where({ purchase_id: f.purchase.id, action: 'refund_confirmed' }),
      1
    )
    assert.lengthOf(await grantEvents(f.repo), 1)
  })

  test('refund rereads uses under the access mutex while duplicate redemptions race', async ({
    assert,
    cleanup,
  }) => {
    assert.equal(db.connectionGlobalTransactions.size, 0)
    const f = await setupPurchase(true)
    class PausedRedemptionRepository extends BenefitRedemptionRepository {
      readonly gate = barrier()
      override async create(...args: Parameters<BenefitRedemptionRepository['create']>) {
        await this.gate.wait() // Access mutex already held; no redemption row exists yet.
        return super.create(...args)
      }
    }
    class ArrivingRefundRepository extends ScopedRepository {
      readonly gate = barrier()
      override async get(...args: Parameters<PurchaseRepository['get']>) {
        if (args[2]) await this.gate.wait()
        return super.get(...args)
      }
    }
    const redeemRepo = new PausedRedemptionRepository()
    const redeem = await redemptionService(redeemRepo)
    const token = await redeem.present(
      f.s.tenant.id,
      f.purchase.access_id!,
      f.s.offer.id,
      f.s.users.holder,
      'http://localhost'
    )
    const otherToken = await redeem.present(
      f.s.tenant.id,
      f.purchase.access_id!,
      f.s.offer.id,
      f.s.users.holder,
      'http://localhost'
    )
    const running: Promise<unknown>[] = []
    const refundRepo = new ArrivingRefundRepository(f.purchase.id)
    cleanup(async () => {
      redeemRepo.gate.release()
      refundRepo.gate.release()
      await Promise.allSettled(running)
    })
    const first = redeem.redeem(f.s.tenant.id, token.token, f.s.users.partner)
    running.push(first)
    await redeemRepo.gate.reached
    const service = await purchaseService(refundRepo)
    const key = randomUUID()
    const request = () =>
      service.refund(f.s.tenant.id, f.s.users.holder, f.purchase.id, key, 'Concurrent refund')
    const refund = request()
    running.push(refund)
    await refundRepo.gate.reached
    const duplicate = redeem.redeem(f.s.tenant.id, token.token, f.s.users.partner)
    running.push(duplicate)
    const competingUse = Promise.allSettled([
      redeem.redeem(f.s.tenant.id, otherToken.token, f.s.users.partner),
    ])
    running.push(competingUse)
    refundRepo.gate.release()
    await waitForAccessContenders(3)
    redeemRepo.gate.release()
    const [receipt, replay, r] = await Promise.all([first, duplicate, refund])
    assert.deepEqual(replay, receipt)
    const competingResults = await competingUse
    assert.equal(competingResults[0].status, 'rejected')
    assert.equal((await f.repo.refund(r.id))!.status, 'review')
    assert.deepEqual(await request(), r)
    assert.lengthOf(
      await db.from('benefit_redemptions').where('access_id', f.purchase.access_id!),
      1
    )
    const hold = await f.repo
      .holds()
      .where({ purchase_id: f.purchase.id, reason: 'refund:' + r.id })
      .firstOrFail()
    assert.isNull(hold.released_at)
    assert.lengthOf(await f.repo.refunds().where('purchase_id', f.purchase.id), 1)
    assert.lengthOf(await f.repo.commands().where('kind', 'refund'), 0)
    await f.service.decideRefund(f.s.tenant.id, f.s.users.admin, f.purchase.id, r.id, {
      approve: true,
      amount_cents: f.purchase.amount_cents,
      reason: 'Explicit review of consumed voucher',
    })
    // Both workers reach claim together; the real dispatcher must lease the refund just once.
    let arrivals = 0
    const claims = barrier()
    class ConcurrentClaimsRepository extends ScopedRepository {
      override async claim() {
        if (++arrivals === 2) claims.release()
        await claims.wait()
        return super.claim()
      }
    }
    cleanup(() => claims.release())
    const results = await Promise.all([
      worker(new ConcurrentClaimsRepository(f.purchase.id)).drain(1),
      worker(new ConcurrentClaimsRepository(f.purchase.id)).drain(1),
    ])
    assert.equal(
      results.reduce((sum, result) => sum + result.processed, 0),
      1
    )
    assert.equal(
      results.reduce((sum, result) => sum + result.deferred, 0),
      0
    )
    const providerRefund = await f.fake.get('fake_' + f.purchase.id)
    assert.equal(providerRefund.refundedCents, f.purchase.amount_cents)
    assert.lengthOf(
      await db.from('benefit_redemptions').where('access_id', f.purchase.access_id!),
      1
    )
    assert.lengthOf(
      await f.repo.events().where({ purchase_id: f.purchase.id, action: 'refund_confirmed' }),
      1
    )
    const released = await f.repo.holds().where('id', hold.id).firstOrFail()
    assert.isNotNull(released.released_at)
    await enqueue(f.repo)
    await worker(f.repo).drain(1)
    assert.deepEqual(await f.repo.holds().where('id', hold.id).first(), released)
  })
  test('operator retry refuses a live lease and queues idempotent recovery after expiry', async ({
    assert,
    cleanup,
  }) => {
    const f = await setupPurchase()
    await db.transaction((trx) => f.repo.hold(f.purchase, 'reconciliation', trx))
    const oldRepo = new PausedWorkerRepository(f.purchase.id)
    const oldWork = worker(oldRepo).drain(1)
    cleanup(async () => {
      oldRepo.gate.release()
      await Promise.allSettled([oldWork])
    })
    await oldRepo.gate.reached
    const operations = new PurchaseOperationsService(
      f.repo,
      await app.container.make(OrganizationPolicyService),
      { get: () => f.fake }
    )
    const key = randomUUID()
    const retry = () =>
      operations.retry(f.s.tenant.id, f.s.users.admin, f.purchase.id, key, {
        reason: 'Recover expired dispatch',
      })
    await assert.rejects(retry, 'Wait for the active payment command')
    const command = await f.repo.commands().where('status', 'processing').firstOrFail()
    await f.repo
      .commands()
      .where('id', command.id)
      .update({ lease_until: new Date(0) })
    assert.deepEqual(await retry(), await retry())
    assert.lengthOf(await f.repo.commands().where('dedupe_key', 'like', 'operator:%'), 1)
    assert.lengthOf(
      await f.repo
        .events()
        .where({ purchase_id: f.purchase.id, action: 'operator_reconciliation' }),
      1
    )
    assert.isNull((await f.repo.get(f.purchase.id))!.access_id)
    const heldBeforeRecovery = await f.repo
      .holds()
      .where('purchase_id', f.purchase.id)
      .firstOrFail()
    assert.isNull(heldBeforeRecovery.released_at)
    await worker(f.repo).drain()
    oldRepo.gate.release()
    await oldWork
    assert.lengthOf(await grantEvents(f.repo), 1)
    const releasedAfterRecovery = await f.repo
      .holds()
      .where('purchase_id', f.purchase.id)
      .firstOrFail()
    assert.isNotNull(releasedAfterRecovery.released_at)
  })

  test('refund winning the mutex blocks both redemption attempts and repeated refund dispatch', async ({
    assert,
    cleanup,
  }) => {
    const f = await setupPurchase(true)
    class PausedHoldRepository extends ScopedRepository {
      readonly gate = barrier()
      override async hold(...args: Parameters<PurchaseRepository['hold']>) {
        await super.hold(...args)
        await this.gate.wait() // Refund owns the access mutex and its hold is not committed yet.
      }
    }
    const repo = new PausedHoldRepository(f.purchase.id)
    const service = await purchaseService(repo)
    const redeem = await app.container.make(BenefitRedemptionService)
    const token = await redeem.present(
      f.s.tenant.id,
      f.purchase.access_id!,
      f.s.offer.id,
      f.s.users.holder,
      'http://localhost'
    )
    const key = randomUUID()
    const request = () =>
      service.refund(f.s.tenant.id, f.s.users.holder, f.purchase.id, key, 'Refund before use')
    const refund = request()
    const running: Promise<unknown>[] = [refund]
    cleanup(async () => {
      repo.gate.release()
      await Promise.allSettled(running)
    })
    await repo.gate.reached
    const attempt = () => redeem.redeem(f.s.tenant.id, token.token, f.s.users.partner)
    const outcomes = Promise.allSettled([attempt(), attempt()])
    running.push(outcomes)
    await waitForAccessContenders(2)
    repo.gate.release()
    const r = await refund
    for (const outcome of await outcomes) {
      assert.equal(outcome.status, 'rejected')
      if (outcome.status === 'rejected')
        assert.equal(outcome.reason.message, 'Benefit access is financially blocked')
    }
    assert.deepEqual(await request(), r)
    assert.equal((await f.repo.refund(r.id))!.status, 'approved')
    assert.lengthOf(
      await db.from('benefit_redemptions').where('access_id', f.purchase.access_id!),
      0
    )
    const hold = await f.repo
      .holds()
      .where({ purchase_id: f.purchase.id, reason: 'refund:' + r.id })
      .firstOrFail()
    assert.isNull(hold.released_at)
    await worker(f.repo).drain(1)
    const released = await f.repo.holds().where('id', hold.id).firstOrFail()
    assert.isNotNull(released.released_at)
    await enqueue(f.repo)
    await Promise.all([worker(f.repo).drain(1), worker(f.repo).drain(1)])
    assert.deepEqual(await f.repo.holds().where('id', hold.id).first(), released)
    assert.lengthOf(
      await f.repo.events().where({ purchase_id: f.purchase.id, action: 'refund_confirmed' }),
      1
    )
    assert.equal((await f.repo.get(f.purchase.id))!.status, 'refunded')
    assert.lengthOf(
      await db.from('benefit_redemptions').where('access_id', f.purchase.access_id!),
      0
    )
  })
})
