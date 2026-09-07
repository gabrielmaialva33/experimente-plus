import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import {
  createPurchaseFlowScenario,
  createFinancialHoldScenario,
  createPurchaseRefundScenario,
} from '#database/factories/scenarios/purchase_flow_factory'
import BenefitAccessService from '#modules/benefits/services/benefit_access_service'

test.group('EP-14 aggregate factories', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  for (const state of ['pending', 'paid', 'failed', 'cancelled', 'review', 'refunded'] as const) {
    test('builds consistent purchase state: ' + state, async ({ assert }) => {
      const f = await createPurchaseFlowScenario({ state })
      assert.equal(f.purchase.status, state)
      assert.equal(f.purchase.tenant_id, f.s.tenant.id)
      assert.equal(f.purchase.edition_id, f.s.edition.id)
      assert.equal(f.purchase.user_id, f.s.users.holder.id)
      assert.isAbove(f.purchase.amount_cents, 0)
      assert.equal(f.purchase.currency, 'BRL')
      if (state === 'paid' || state === 'refunded') {
        assert.equal(f.access!.id, f.purchase.access_id)
        assert.equal(f.access!.tenant_id, f.purchase.tenant_id)
        assert.equal(f.access!.source, 'payment')
        assert.isNotEmpty(f.access!.external_reference!)
        assert.equal(f.access!.status, state === 'paid' ? 'active' : 'revoked')
        const events = await f.repo
          .events()
          .where({ purchase_id: f.purchase.id, action: 'access_granted' })
        assert.lengthOf(events, 1)
      } else {
        assert.isNull(f.purchase.access_id)
        assert.isNull(f.access)
      }
      if (state === 'review') {
        const command = await f.repo
          .commands()
          .where({ purchase_id: f.purchase.id, kind: 'refund', status: 'pending' })
          .first()
        assert.isDefined(command)
      }
    })
  }

  for (const released of [false, true]) {
    test('builds reversible financial hold; released=' + released, async ({ assert }) => {
      const f = await createFinancialHoldScenario({ released })
      assert.equal(f.hold.access_id, f.access!.id)
      assert.equal(f.hold.purchase_id, f.purchase.id)
      assert.equal(f.hold.tenant_id, f.s.tenant.id)
      assert.equal(Boolean(f.hold.released_at), released)
      const service = await app.container.make(BenefitAccessService)
      const wallet = await service.wallet(f.s.tenant.id, f.s.users.holder)
      assert.equal(wallet.passes[0].access.financially_blocked, !released)
    })
  }

  for (const kind of ['total', 'partial'] as const) {
    test('builds confirmed ' + kind + ' refund preserving consumed quota', async ({ assert }) => {
      const f = await createPurchaseRefundScenario({ kind })
      assert.equal(f.refund.status, 'succeeded')
      assert.equal(f.refund.purchase_id, f.purchase.id)
      assert.equal(f.refund.tenant_id, f.s.tenant.id)
      assert.equal(f.purchase.refunded_cents, f.refund.amount_cents)
      assert.equal(f.access.status, kind === 'total' ? 'revoked' : 'active')
      assert.equal(f.purchase.status, kind === 'total' ? 'refunded' : 'paid')
      assert.isNotNull(f.hold.released_at)
      assert.lengthOf(await db.from('benefit_redemptions').where('access_id', f.access.id), 1)
      assert.equal(f.receipt.redemption_number, 1)
      if (kind === 'partial') assert.isBelow(f.refund.amount_cents, f.purchase.amount_cents)
    })
  }

  for (const refundState of ['review', 'approved', 'rejected'] as const) {
    test('builds refund decision stage: ' + refundState, async ({ assert }) => {
      const f = await createPurchaseRefundScenario({ refundState })
      assert.equal(f.refund.status, refundState)
      assert.equal(f.purchase.refunded_cents, 0)
      assert.equal(f.access.status, 'active')
      assert.equal(Boolean(f.hold.released_at), refundState === 'rejected')
    })
  }
})
