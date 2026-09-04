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

function parseInertiaPage(response: ApiResponse): {
  component: string
  props: Record<string, unknown>
} {
  const match = response
    .text()
    .match(/<script data-page="app" type="application\/json">([\s\S]*?)<\/script>/)
  if (!match?.[1]) {
    throw new Error('The response does not contain an Inertia page payload')
  }

  return JSON.parse(match[1])
}

function parsePresentationPage(response: ApiResponse): {
  token: string
  validation_url: string
} {
  const page = parseInertiaPage(response)
  if (page.component !== 'wallet/present') {
    throw new Error(`Unexpected Inertia component: ${page.component}`)
  }
  return page.props.presentation as { token: string; validation_url: string }
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

    const issuedToken = presentation.body().token as string
    const extraInput = await client
      .post('/api/v1/benefit-redemptions/preview')
      .header('x-tenant-id', tenantHeader)
      .loginAs(scenario.users.partner)
      .json({ token: issuedToken, ignored_transport_metadata: true })
    extraInput.assertStatus(200)
    assertPrivateMobileResponse(extraInput)
    assert.notProperty(extraInput.body(), 'ignored_transport_metadata')

    const bodyWinsOverQuery = await client
      .post('/api/v1/benefit-redemptions/preview')
      .qs({ token: 'query-must-not-override-the-body' })
      .header('x-tenant-id', tenantHeader)
      .loginAs(scenario.users.partner)
      .json({ token: issuedToken })
    bodyWinsOverQuery.assertStatus(200)
    assert.equal(bodyWinsOverQuery.body().token, issuedToken)
    assertPrivateMobileResponse(bodyWinsOverQuery)

    const queryOnly = await client
      .post('/api/v1/benefit-redemptions/preview')
      .qs({ token: issuedToken })
      .header('x-tenant-id', tenantHeader)
      .loginAs(scenario.users.partner)
      .json({})
    queryOnly.assertStatus(422)
    queryOnly.assertBodyContains({ errors: [{ field: 'token', rule: 'required' }] })
    assertPrivateMobileResponse(queryOnly)

    const signature = 'A'.repeat(43)
    const nonCanonicalTokens = [
      { token: `A.${signature}`, rule: 'minLength' },
      { token: `AAAAA.${signature}`, rule: 'regex' },
      { token: `AR.${signature}`, rule: 'regex' },
      { token: `AQ.${'A'.repeat(42)}B`, rule: 'regex' },
    ]
    for (const { token, rule } of nonCanonicalTokens) {
      for (const path of ['/api/v1/benefit-redemptions/preview', '/api/v1/benefit-redemptions']) {
        const nonCanonical = await client
          .post(path)
          .header('x-tenant-id', tenantHeader)
          .loginAs(scenario.users.partner)
          .json({ token })

        nonCanonical.assertStatus(422)
        nonCanonical.assertBodyContains({ errors: [{ field: 'token', rule }] })
        assertPrivateMobileResponse(nonCanonical)
      }
    }

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

    const rawOversizedPaddedToken = `${' '.repeat(
      BENEFIT_PRESENTATION_TOKEN_MAX_LENGTH - issuedToken.length + 1
    )}${issuedToken}`
    assert.lengthOf(rawOversizedPaddedToken, BENEFIT_PRESENTATION_TOKEN_MAX_LENGTH + 1)
    for (const path of ['/api/v1/benefit-redemptions/preview', '/api/v1/benefit-redemptions']) {
      const oversizedAfterTrim = await client
        .post(path)
        .header('x-tenant-id', tenantHeader)
        .loginAs(scenario.users.partner)
        .json({ token: rawOversizedPaddedToken })

      oversizedAfterTrim.assertStatus(422)
      oversizedAfterTrim.assertBodyContains({
        errors: [{ field: 'token', rule: 'maxLength' }],
      })
      assertPrivateMobileResponse(oversizedAfterTrim)
    }
    const oversizedUrlEncoded = await client
      .post('/api/v1/benefit-redemptions/preview')
      .header('x-tenant-id', tenantHeader)
      .loginAs(scenario.users.partner)
      .accept('json')
      .form({ token: rawOversizedPaddedToken })
    oversizedUrlEncoded.assertStatus(422)
    oversizedUrlEncoded.assertBodyContains({
      errors: [{ field: 'token', rule: 'maxLength' }],
    })
    assertPrivateMobileResponse(oversizedUrlEncoded)

    const duplicateUrlEncoded = await client
      .post('/api/v1/benefit-redemptions/preview')
      .header('x-tenant-id', tenantHeader)
      .loginAs(scenario.users.partner)
      .accept('json')
      .unsafeForm(
        `token=${encodeURIComponent(issuedToken)}&token=${encodeURIComponent(issuedToken)}`
      )
    duplicateUrlEncoded.assertStatus(422)
    duplicateUrlEncoded.assertBodyContains({ errors: [{ field: 'token', rule: 'string' }] })
    assertPrivateMobileResponse(duplicateUrlEncoded)

    const malformed = await client
      .post('/api/v1/benefit-redemptions/preview')
      .header('x-tenant-id', tenantHeader)
      .loginAs(scenario.users.partner)
      .json({ token: `payload!.${'A'.repeat(43)}` })
    malformed.assertStatus(422)
    malformed.assertBodyContains({ errors: [{ field: 'token', rule: 'regex' }] })
    assertPrivateMobileResponse(malformed)

    const paddedToken = ` ${issuedToken} `
    const paddedApi = await client
      .post('/api/v1/benefit-redemptions/preview')
      .header('x-tenant-id', tenantHeader)
      .loginAs(scenario.users.partner)
      .json({ token: paddedToken })
    paddedApi.assertStatus(200)
    assertPrivateMobileResponse(paddedApi)
    assert.equal(paddedApi.body().token, issuedToken)

    const paddedWeb = await client
      .get(`/portal/redemptions/validate?token=${encodeURIComponent(paddedToken)}`)
      .header('x-tenant-id', tenantHeader)
      .loginAs(scenario.users.partner)
    paddedWeb.assertStatus(200)
    assert.notInclude(paddedWeb.text(), INVALID_BENEFIT_PRESENTATION_MESSAGE)
    assert.include(paddedWeb.text(), 'Apresentação válida')
    const paddedWebPage = parseInertiaPage(paddedWeb)
    assert.equal(paddedWebPage.component, 'portal/redemptions/validate')
    assert.equal(paddedWebPage.props.token, issuedToken)

    const oversizedWebQuery = await client
      .get(`/portal/redemptions/validate?token=${encodeURIComponent(rawOversizedPaddedToken)}`)
      .header('x-tenant-id', tenantHeader)
      .loginAs(scenario.users.partner)
    oversizedWebQuery.assertStatus(200)
    assert.include(oversizedWebQuery.text(), INVALID_BENEFIT_PRESENTATION_MESSAGE)
    assert.notInclude(oversizedWebQuery.text(), 'Apresentação válida')

    const oversizedWebPost = await client
      .post('/portal/redemptions')
      .withCsrfToken()
      .header('x-tenant-id', tenantHeader)
      .loginAs(scenario.users.partner)
      .header('referer', '/')
      .accept('html')
      .redirects(0)
      .form({ token: rawOversizedPaddedToken })
    oversizedWebPost.assertStatus(302)
    oversizedWebPost.assertHeader('location', '/')

    const signatureStart = issuedToken.indexOf('.') + 1
    const replacement = issuedToken[signatureStart] === 'A' ? 'B' : 'A'
    const tamperedToken = `${issuedToken.slice(0, signatureStart)}${replacement}${issuedToken.slice(signatureStart + 1)}`
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
