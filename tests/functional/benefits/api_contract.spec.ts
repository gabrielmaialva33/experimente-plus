import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

import { createBenefitFlowScenario } from '#database/factories/scenarios/benefit_flow_factory'

test.group('Benefits API contract', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('covers the holder and partner redemption contract end to end', async ({
    assert,
    client,
  }) => {
    const scenario = await createBenefitFlowScenario({ suffix: 'api-contract' })
    const tenantHeader = String(scenario.tenant.id)

    const walletBefore = await client
      .get('/api/v1/me/wallet')
      .header('x-tenant-id', tenantHeader)
      .loginAs(scenario.users.holder)
    walletBefore.assertStatus(200)
    assert.equal(walletBefore.body().summary.passes, 1)
    assert.equal(walletBefore.body().summary.benefits, 1)
    assert.equal(walletBefore.body().summary.available, 1)
    assert.equal(walletBefore.body().passes[0].benefits[0].offer_id, scenario.offer.id)

    const presented = await client
      .post('/api/v1/me/benefits/presentations')
      .header('x-tenant-id', tenantHeader)
      .loginAs(scenario.users.holder)
      .json({ access_id: scenario.access.id, offer_id: scenario.offer.id })
    presented.assertStatus(201)
    assert.isAbove(presented.body().token.length, 40)
    assert.match(presented.body().validation_url, /\/portal\/redemptions\/validate\?token=/)
    assert.match(presented.body().qr_data_url, /^data:image\/png;base64,/)
    assert.equal(presented.body().expires_in_seconds, 300)
    assert.equal(presented.body().benefit.remaining_redemptions, 1)

    const previewed = await client
      .post('/api/v1/benefit-redemptions/preview')
      .header('x-tenant-id', tenantHeader)
      .loginAs(scenario.users.partner)
      .json({ token: presented.body().token })
    previewed.assertStatus(200)
    assert.equal(previewed.body().holder.id, scenario.users.holder.id)
    assert.equal(previewed.body().benefit.offer_id, scenario.offer.id)

    const redeemed = await client
      .post('/api/v1/benefit-redemptions')
      .header('x-tenant-id', tenantHeader)
      .loginAs(scenario.users.partner)
      .json({ token: presented.body().token })
    redeemed.assertStatus(200)
    assert.equal(redeemed.body().redemption_number, 1)
    assert.equal(redeemed.body().offer.id, scenario.offer.id)
    assert.equal(redeemed.body().offer.terms, scenario.offer.terms)
    assert.equal(redeemed.body().holder.id, scenario.users.holder.id)

    const repeated = await client
      .post('/api/v1/benefit-redemptions')
      .header('x-tenant-id', tenantHeader)
      .loginAs(scenario.users.partner)
      .json({ token: presented.body().token })
    repeated.assertStatus(200)
    assert.equal(repeated.body().id, redeemed.body().id)
    assert.equal(repeated.body().receipt_code, redeemed.body().receipt_code)

    const holderHistory = await client
      .get('/api/v1/me/benefits/redemptions')
      .header('x-tenant-id', tenantHeader)
      .loginAs(scenario.users.holder)
    holderHistory.assertStatus(200)
    assert.equal(holderHistory.body().total, 1)
    assert.equal(holderHistory.body().redemptions[0].receipt_code, redeemed.body().receipt_code)

    const holderReceipt = await client
      .get(`/api/v1/me/benefits/redemptions/${redeemed.body().receipt_code}`)
      .header('x-tenant-id', tenantHeader)
      .loginAs(scenario.users.holder)
    holderReceipt.assertStatus(200)
    assert.equal(holderReceipt.body().id, redeemed.body().id)

    const partnerHistory = await client
      .get('/api/v1/benefit-redemptions')
      .header('x-tenant-id', tenantHeader)
      .loginAs(scenario.users.partner)
    partnerHistory.assertStatus(200)
    assert.equal(partnerHistory.body().total, 1)
    assert.equal(partnerHistory.body().redemptions[0].receipt_code, redeemed.body().receipt_code)

    const walletAfter = await client
      .get('/api/v1/me/wallet')
      .header('x-tenant-id', tenantHeader)
      .loginAs(scenario.users.holder)
    walletAfter.assertStatus(200)
    assert.equal(walletAfter.body().summary.available, 0)
    assert.equal(walletAfter.body().summary.redeemed, 1)
    assert.equal(walletAfter.body().passes[0].benefits[0].availability, 'redeemed')
    assert.equal(
      walletAfter.body().passes[0].benefits[0].latest_redemption.receipt_code,
      redeemed.body().receipt_code
    )
  })

  test('keeps holder data and partner operations behind organization boundaries', async ({
    assert,
    client,
  }) => {
    const scenario = await createBenefitFlowScenario({ suffix: 'api-boundaries' })
    const tenantHeader = String(scenario.tenant.id)

    const foreignPresentation = await client
      .post('/api/v1/me/benefits/presentations')
      .header('x-tenant-id', tenantHeader)
      .loginAs(scenario.users.outsider)
      .json({ access_id: scenario.access.id, offer_id: scenario.offer.id })
    foreignPresentation.assertStatus(404)

    const presented = await client
      .post('/api/v1/me/benefits/presentations')
      .header('x-tenant-id', tenantHeader)
      .loginAs(scenario.users.holder)
      .json({ access_id: scenario.access.id, offer_id: scenario.offer.id })
    presented.assertStatus(201)

    const foreignPreview = await client
      .post('/api/v1/benefit-redemptions/preview')
      .header('x-tenant-id', tenantHeader)
      .loginAs(scenario.users.outsider)
      .json({ token: presented.body().token })
    foreignPreview.assertStatus(404)

    const foreignPartnerHistory = await client
      .get('/api/v1/benefit-redemptions')
      .header('x-tenant-id', tenantHeader)
      .loginAs(scenario.users.outsider)
    foreignPartnerHistory.assertStatus(200)
    assert.equal(foreignPartnerHistory.body().total, 0)
    assert.deepEqual(foreignPartnerHistory.body().redemptions, [])
  })

  test('renders the administrative edition projection with offers and accesses', async ({
    assert,
    client,
  }) => {
    const scenario = await createBenefitFlowScenario({ suffix: 'admin-projection' })

    const response = await client
      .get('/backoffice/benefits')
      .header('x-tenant-id', String(scenario.tenant.id))
      .loginAs(scenario.users.admin)

    response.assertStatus(200)
    assert.include(response.text(), scenario.edition.name)
    assert.include(response.text(), scenario.offer.title)
    assert.include(response.text(), 'backoffice/benefits/index')
  })
})
