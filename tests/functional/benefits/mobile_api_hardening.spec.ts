import testUtils from '@adonisjs/core/services/test_utils'
import type { ApiResponse } from '@japa/api-client'
import { test } from '@japa/runner'
import limiter from '@adonisjs/limiter/services/main'

import { createBenefitFlowScenario } from '#database/factories/scenarios/benefit_flow_factory'
import { INVALID_BENEFIT_PRESENTATION_MESSAGE } from '#exceptions/invalid_benefit_presentation_exception'
import {
  BENEFIT_PRESENTATION_TOKEN_MAX_LENGTH,
  BENEFIT_PRESENTATION_TOKEN_PATTERN,
} from '#modules/benefits/constants/benefit_redemption'
import IRole from '#modules/roles/interfaces/role_interface'
import { BENEFIT_PRESENTATION_BASE_URL_KEY } from '#shared/utils/benefit_presentation_origin'
import env from '#start/env'
import {
  addOrganizationMember,
  createOrganization,
  createUser,
} from '#tests/functional/organizations/helpers'

function assertPrivateMobileResponse(response: ApiResponse): void {
  response.assertHeader('cache-control', 'private, no-store')
  response.assertHeader('x-robots-tag', 'noindex, nofollow')
  response.assertHeader('referrer-policy', 'no-referrer')
}

function parsePresentationPage(response: ApiResponse): {
  token: string
  validation_url: string
} {
  const match = response
    .text()
    .match(/<script data-page="app" type="application\/json">([\s\S]*?)<\/script>/)
  if (!match?.[1]) {
    throw new Error('The response does not contain an Inertia page payload')
  }

  const page = JSON.parse(match[1]) as {
    component: string
    props: { presentation: { token: string; validation_url: string } }
  }
  if (page.component !== 'wallet/present') {
    throw new Error(`Unexpected Inertia component: ${page.component}`)
  }
  return page.props.presentation
}

test.group('Benefits mobile API hardening', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(async () => {
    await limiter.clear()
    return () => limiter.clear()
  })

  test('serves partner receipts only within the tenant and organization policy boundary', async ({
    assert,
    client,
  }) => {
    const scenario = await createBenefitFlowScenario({
      suffix: 'receipt-api',
      withRedemption: true,
    })
    const receiptCode = scenario.redemption!.receipt_code
    const tenantHeader = String(scenario.tenant.id)
    const organizationAdmin = await createUser({
      prefix: 'partner-receipt-admin',
      tenant: scenario.tenant,
    })
    const editor = await createUser({
      prefix: 'partner-receipt-editor',
      tenant: scenario.tenant,
    })
    const analyst = await createUser({
      prefix: 'partner-receipt-analyst',
      tenant: scenario.tenant,
    })

    for (const [actor, role] of [
      [organizationAdmin, 'admin'],
      [editor, 'editor'],
      [analyst, 'analyst'],
    ] as const) {
      await addOrganizationMember({
        tenant: scenario.tenant,
        organization: scenario.organization,
        user: actor,
        role,
      })
    }

    const root = await createUser({
      prefix: 'partner-receipt-root',
      tenant: scenario.tenant,
      globalRole: IRole.Slugs.ROOT,
    })
    const allowedActors = [
      scenario.users.partner,
      organizationAdmin,
      editor,
      analyst,
      scenario.users.admin,
      root,
    ]

    for (const actor of allowedActors) {
      const response = await client
        .get(`/api/v1/benefit-redemptions/${receiptCode}`)
        .header('x-tenant-id', tenantHeader)
        .loginAs(actor)

      response.assertStatus(200)
      assertPrivateMobileResponse(response)
      assert.equal(response.body().receipt_code, receiptCode)
    }

    const otherOrganizationActor = await createUser({
      prefix: 'partner-receipt-other-organization',
      tenant: scenario.tenant,
    })
    await createOrganization({
      tenant: scenario.tenant,
      owner: otherOrganizationActor,
      status: 'active',
      prefix: 'Other receipt organization',
    })
    const moderator = await createUser({
      prefix: 'partner-receipt-moderator',
      tenant: scenario.tenant,
      globalRole: IRole.Slugs.MODERATOR,
    })

    for (const actor of [scenario.users.outsider, otherOrganizationActor, moderator]) {
      const response = await client
        .get(`/api/v1/benefit-redemptions/${receiptCode}`)
        .header('x-tenant-id', tenantHeader)
        .loginAs(actor)

      response.assertStatus(404)
      assertPrivateMobileResponse(response)
    }

    const foreignScenario = await createBenefitFlowScenario({
      suffix: 'partner-receipt-foreign-tenant',
    })
    const hiddenAcrossTenant = await client
      .get(`/api/v1/benefit-redemptions/${receiptCode}`)
      .header('x-tenant-id', String(foreignScenario.tenant.id))
      .loginAs(foreignScenario.users.partner)
    hiddenAcrossTenant.assertStatus(404)
    assertPrivateMobileResponse(hiddenAcrossTenant)

    const rejectedTenantOverride = await client
      .get(`/api/v1/benefit-redemptions/${receiptCode}`)
      .header('x-tenant-id', tenantHeader)
      .loginAs(foreignScenario.users.partner)
    rejectedTenantOverride.assertStatus(403)
    assertPrivateMobileResponse(rejectedTenantOverride)
  })

  test('hides malformed receipt codes on both consumer and partner endpoints', async ({
    client,
  }) => {
    const scenario = await createBenefitFlowScenario({
      suffix: 'malformed-receipt-api',
      withRedemption: true,
    })
    const tenantHeader = String(scenario.tenant.id)
    const requests = [
      {
        path: '/api/v1/me/benefits/redemptions',
        actor: scenario.users.holder,
      },
      {
        path: '/api/v1/benefit-redemptions',
        actor: scenario.users.partner,
      },
    ]
    const malformedCodes = [
      'not-a-receipt',
      `EXP-${'A'.repeat(15)}`,
      `EXP-${'A'.repeat(17)}`,
      `EXP-${'A'.repeat(15)}Z`,
      `exp-${'a'.repeat(16)}`,
    ]

    for (const request of requests) {
      for (const receiptCode of malformedCodes) {
        const response = await client
          .get(`${request.path}/${receiptCode}`)
          .header('x-tenant-id', tenantHeader)
          .loginAs(request.actor)

        response.assertStatus(404)
        response.assertBody({ status: 404, message: 'Redemption receipt not found' })
        assertPrivateMobileResponse(response)
      }
    }
  })

  test('uses the configured canonical origin in both JSON and Inertia presentations', async ({
    assert,
    cleanup,
    client,
  }) => {
    const previousBaseUrl = env.get(BENEFIT_PRESENTATION_BASE_URL_KEY)
    env.set(BENEFIT_PRESENTATION_BASE_URL_KEY, 'https://Mobile.Experimente.Example:443/')
    cleanup(() => env.set(BENEFIT_PRESENTATION_BASE_URL_KEY, previousBaseUrl ?? ''))

    const scenario = await createBenefitFlowScenario({ suffix: 'canonical-presentation-origin' })
    const tenantHeader = String(scenario.tenant.id)
    const apiPresentation = await client
      .post('/api/v1/me/benefits/presentations')
      .header('x-tenant-id', tenantHeader)
      .header('x-forwarded-host', 'internal-api:3333')
      .header('x-forwarded-proto', 'http')
      .loginAs(scenario.users.holder)
      .json({ access_id: scenario.access.id, offer_id: scenario.offer.id })

    apiPresentation.assertStatus(201)
    assertPrivateMobileResponse(apiPresentation)
    const apiValidationUrl = new URL(apiPresentation.body().validation_url)
    assert.equal(apiValidationUrl.origin, 'https://mobile.experimente.example')
    assert.equal(apiValidationUrl.pathname, '/portal/redemptions/validate')
    assert.equal(apiValidationUrl.searchParams.get('token'), apiPresentation.body().token)

    const inertiaPresentation = await client
      .get(`/wallet/accesses/${scenario.access.id}/offers/${scenario.offer.id}/use`)
      .header('x-tenant-id', tenantHeader)
      .header('x-forwarded-host', 'internal-web:3333')
      .header('x-forwarded-proto', 'http')
      .loginAs(scenario.users.holder)

    inertiaPresentation.assertStatus(200)
    const pagePresentation = parsePresentationPage(inertiaPresentation)
    const pageValidationUrl = new URL(pagePresentation.validation_url)
    assert.equal(pageValidationUrl.origin, 'https://mobile.experimente.example')
    assert.equal(pageValidationUrl.pathname, '/portal/redemptions/validate')
    assert.equal(pageValidationUrl.searchParams.get('token'), pagePresentation.token)
  })

  test('bounds token input at HTTP entry and keeps cryptographic failures generic', async ({
    assert,
    client,
  }) => {
    const scenario = await createBenefitFlowScenario({ suffix: 'bounded-presentation-token' })
    const tenantHeader = String(scenario.tenant.id)
    const presentation = await client
      .post('/api/v1/me/benefits/presentations')
      .header('x-tenant-id', tenantHeader)
      .loginAs(scenario.users.holder)
      .json({ access_id: scenario.access.id, offer_id: scenario.offer.id })

    presentation.assertStatus(201)
    assert.match(presentation.body().token, BENEFIT_PRESENTATION_TOKEN_PATTERN)
    assert.isAtMost(presentation.body().token.length, BENEFIT_PRESENTATION_TOKEN_MAX_LENGTH)

    const oversizedToken = `${'A'.repeat(BENEFIT_PRESENTATION_TOKEN_MAX_LENGTH - 43)}.${'A'.repeat(43)}`
    for (const path of ['/api/v1/benefit-redemptions/preview', '/api/v1/benefit-redemptions']) {
      const oversized = await client
        .post(path)
        .header('x-tenant-id', tenantHeader)
        .loginAs(scenario.users.partner)
        .json({ token: oversizedToken })

      oversized.assertStatus(422)
      oversized.assertBodyContains({ errors: [{ field: 'token', rule: 'maxLength' }] })
      assertPrivateMobileResponse(oversized)
    }

    const malformed = await client
      .post('/api/v1/benefit-redemptions/preview')
      .header('x-tenant-id', tenantHeader)
      .loginAs(scenario.users.partner)
      .json({ token: `payload!.${'A'.repeat(43)}` })
    malformed.assertStatus(422)
    malformed.assertBodyContains({ errors: [{ field: 'token', rule: 'regex' }] })
    assertPrivateMobileResponse(malformed)

    const issuedToken = presentation.body().token as string
    const replacement = issuedToken.endsWith('A') ? 'B' : 'A'
    const tamperedToken = `${issuedToken.slice(0, -1)}${replacement}`
    for (const path of ['/api/v1/benefit-redemptions/preview', '/api/v1/benefit-redemptions']) {
      const tampered = await client
        .post(path)
        .header('x-tenant-id', tenantHeader)
        .loginAs(scenario.users.partner)
        .json({ token: tamperedToken })

      tampered.assertStatus(400)
      tampered.assertBody({ status: 400, message: INVALID_BENEFIT_PRESENTATION_MESSAGE })
      assertPrivateMobileResponse(tampered)
    }
  })

  test('enforces the authenticated API throttle on private benefit routes', async ({
    assert,
    client,
  }) => {
    const scenario = await createBenefitFlowScenario({ suffix: 'benefit-api-throttle' })
    const tenantHeader = String(scenario.tenant.id)
    const limiterKey = `api_api_user_${scenario.users.holder.id}`
    const apiLimiter = limiter.use({ requests: 100, duration: '1 minute' })

    const firstResponse = await client
      .get('/api/v1/me/wallet')
      .header('x-tenant-id', tenantHeader)
      .loginAs(scenario.users.holder)
    firstResponse.assertStatus(200)
    firstResponse.assertHeader('x-ratelimit-limit', '100')
    assertPrivateMobileResponse(firstResponse)
    const limiterState = await apiLimiter.get(limiterKey)
    assert.equal(limiterState?.consumed, 1)

    await apiLimiter.set(limiterKey, 100, '1 minute')

    const limitedResponse = await client
      .get('/api/v1/me/wallet')
      .header('x-tenant-id', tenantHeader)
      .loginAs(scenario.users.holder)
    limitedResponse.assertStatus(429)
    assertPrivateMobileResponse(limitedResponse)
  })
})
