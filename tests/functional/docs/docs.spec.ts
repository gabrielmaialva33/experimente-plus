import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import router from '@adonisjs/core/services/router'
import { test } from '@japa/runner'
import { parse } from 'yaml'

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace'] as const
type HttpMethod = (typeof HTTP_METHODS)[number]

type OpenApiSchema = {
  $ref?: string
  additionalProperties?: boolean
  const?: unknown
  description?: string
  maxLength?: number
  maximum?: number
  minLength?: number
  minimum?: number
  oneOf?: OpenApiSchema[]
  pattern?: string
  properties?: Record<string, OpenApiSchema>
  required?: string[]
  type?: unknown
}

type OpenApiHeader = {
  $ref?: string
  schema?: OpenApiSchema
}

type OpenApiParameter = {
  name?: string
  schema?: OpenApiSchema
}

type OpenApiResponse = {
  $ref?: string
  description?: string
  headers?: Record<string, OpenApiHeader>
  content?: Record<
    string,
    {
      schema?: OpenApiSchema
      example?: Record<string, unknown>
      examples?: Record<string, { value?: Record<string, unknown> }>
    }
  >
}

type OpenApiOperation = {
  operationId?: string
  parameters?: OpenApiParameter[]
  requestBody?: {
    content?: Record<string, { schema?: OpenApiSchema }>
  }
  responses?: Record<string, OpenApiResponse>
}

type OpenApiPathItem = Partial<Record<HttpMethod, OpenApiOperation>>

type OpenApiDocument = {
  openapi?: string
  paths?: Record<string, OpenApiPathItem>
  components?: {
    headers?: Record<string, OpenApiHeader>
    responses?: Record<string, OpenApiResponse>
    schemas?: Record<string, OpenApiSchema>
  }
}

const MOBILE_OPERATIONS: ReadonlyArray<{
  method: HttpMethod
  runtimePath: string
  openApiPath: string
}> = [
  {
    method: 'post',
    runtimePath: '/api/v1/sessions/sign-in',
    openApiPath: '/api/v1/sessions/sign-in',
  },
  {
    method: 'post',
    runtimePath: '/api/v1/sessions/sign-up',
    openApiPath: '/api/v1/sessions/sign-up',
  },
  {
    method: 'post',
    runtimePath: '/api/v1/sessions/refresh',
    openApiPath: '/api/v1/sessions/refresh',
  },
  { method: 'get', runtimePath: '/api/v1/me', openApiPath: '/api/v1/me' },
  { method: 'patch', runtimePath: '/api/v1/me', openApiPath: '/api/v1/me' },
  {
    method: 'get',
    runtimePath: '/api/v1/me/context',
    openApiPath: '/api/v1/me/context',
  },
  {
    method: 'get',
    runtimePath: '/api/v1/catalog/cities',
    openApiPath: '/api/v1/catalog/cities',
  },
  {
    method: 'get',
    runtimePath: '/api/v1/catalog/cities/:citySlug/categories',
    openApiPath: '/api/v1/catalog/cities/{citySlug}/categories',
  },
  {
    method: 'get',
    runtimePath: '/api/v1/catalog/cities/:citySlug/establishments',
    openApiPath: '/api/v1/catalog/cities/{citySlug}/establishments',
  },
  {
    method: 'get',
    runtimePath: '/api/v1/catalog/cities/:citySlug/establishments/:establishmentSlug',
    openApiPath: '/api/v1/catalog/cities/{citySlug}/establishments/{establishmentSlug}',
  },
  {
    method: 'get',
    runtimePath: '/api/v1/me/wallet',
    openApiPath: '/api/v1/me/wallet',
  },
  {
    method: 'post',
    runtimePath: '/api/v1/me/benefits/presentations',
    openApiPath: '/api/v1/me/benefits/presentations',
  },
  {
    method: 'get',
    runtimePath: '/api/v1/me/benefits/redemptions',
    openApiPath: '/api/v1/me/benefits/redemptions',
  },
  {
    method: 'get',
    runtimePath: '/api/v1/me/benefits/redemptions/:receiptCode',
    openApiPath: '/api/v1/me/benefits/redemptions/{receiptCode}',
  },
  {
    method: 'post',
    runtimePath: '/api/v1/benefit-redemptions/preview',
    openApiPath: '/api/v1/benefit-redemptions/preview',
  },
  {
    method: 'post',
    runtimePath: '/api/v1/benefit-redemptions',
    openApiPath: '/api/v1/benefit-redemptions',
  },
  {
    method: 'get',
    runtimePath: '/api/v1/benefit-redemptions',
    openApiPath: '/api/v1/benefit-redemptions',
  },
  {
    method: 'get',
    runtimePath: '/api/v1/benefit-redemptions/:receiptCode',
    openApiPath: '/api/v1/benefit-redemptions/{receiptCode}',
  },
  {
    method: 'post',
    runtimePath: '/api/v1/tenants',
    openApiPath: '/api/v1/tenants',
  },
  {
    method: 'post',
    runtimePath: '/api/v1/tenants/switch',
    openApiPath: '/api/v1/tenants/switch',
  },
]

async function readOpenApi(): Promise<OpenApiDocument> {
  const source = await readFile(join(process.cwd(), 'docs/openapi.yaml'), 'utf8')
  return parse(source) as OpenApiDocument
}

function operationAt(
  specification: OpenApiDocument,
  path: string,
  method: HttpMethod
): OpenApiOperation | undefined {
  return specification.paths?.[path]?.[method]
}

test.group('Documentation', () => {
  test('should serve the Redoc documentation page', async ({ client, assert }) => {
    const response = await client.get('/docs')

    response.assertStatus(200)
    assert.include(response.header('content-type') ?? '', 'text/html')
    assert.include(response.text(), 'Experimente+ API Documentation')
    assert.include(response.text(), '/docs/openapi.yaml')
  })

  test('should serve the OpenAPI specification', async ({ client, assert }) => {
    const response = await client.get('/docs/openapi.yaml')

    response.assertStatus(200)
    assert.include(response.header('content-type') ?? '', 'yaml')
    assert.include(response.text(), 'title: Experimente+ API')
    assert.include(response.text(), '/api/v1/me/benefits/presentations:')
  })

  test('parses OpenAPI 3.1 and keeps every operationId globally unique', async ({ assert }) => {
    const specification = await readOpenApi()
    const seen = new Map<string, string>()

    assert.equal(specification.openapi, '3.1.0')

    for (const [path, pathItem] of Object.entries(specification.paths ?? {})) {
      for (const method of HTTP_METHODS) {
        const operation = pathItem[method]
        if (!operation) continue

        assert.isString(operation.operationId, `${method.toUpperCase()} ${path} needs operationId`)
        assert.isNotEmpty(operation.operationId)
        const existing = seen.get(operation.operationId!)
        assert.isUndefined(
          existing,
          `operationId ${operation.operationId} is duplicated by ${existing} and ${method.toUpperCase()} ${path}`
        )
        seen.set(operation.operationId!, `${method.toUpperCase()} ${path}`)
      }
    }
  })

  test('keeps the selected mobile surface in both the router and OpenAPI', async ({ assert }) => {
    const specification = await readOpenApi()
    const runtimeOperations = new Set(
      Object.values(router.toJSON())
        .flatMap((routes) => routes)
        .flatMap((route) =>
          route.methods.map((method) => `${method.toLowerCase()} ${route.pattern}`)
        )
    )

    for (const expected of MOBILE_OPERATIONS) {
      assert.isTrue(
        runtimeOperations.has(`${expected.method} ${expected.runtimePath}`),
        `${expected.method.toUpperCase()} ${expected.runtimePath} is missing from the runtime router`
      )
      assert.exists(
        operationAt(specification, expected.openApiPath, expected.method),
        `${expected.method.toUpperCase()} ${expected.openApiPath} is missing from OpenAPI`
      )
    }
  })

  test('locks mobile metadata and corrected runtime semantics', async ({ assert }) => {
    const specification = await readOpenApi()
    const schemas = specification.components?.schemas ?? {}
    const tokenFields = [
      'access_token',
      'refresh_token',
      'token_type',
      'expires_in',
      'refresh_expires_in',
    ]

    assert.sameMembers(schemas.AuthTokens?.required ?? [], tokenFields)
    assert.equal(schemas.AuthTokens?.properties?.token_type?.const, 'Bearer')
    assert.equal(schemas.AuthTokens?.properties?.expires_in?.const, 900)
    assert.equal(schemas.AuthTokens?.properties?.refresh_expires_in?.const, 259200)
    assert.equal(
      schemas.AuthTokens?.properties?.refresh_token?.$ref,
      '#/components/schemas/RefreshToken'
    )
    assert.include(schemas.AuthResponse?.required ?? [], 'auth')
    assert.deepEqual(schemas.AuthResponse?.properties?.username?.type, ['string', 'null'])

    assert.equal(schemas.RefreshToken?.minLength, 43)
    assert.equal(schemas.RefreshToken?.maxLength, 43)
    assert.equal(schemas.RefreshToken?.pattern, '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$')
    assert.include(schemas.RefreshToken?.description ?? '', 'never normalized')

    for (const requestSchema of [
      schemas.RefreshTokenRequest,
      schemas.CreateTenantRequest,
      schemas.SwitchTenantRequest,
    ]) {
      assert.isUndefined(requestSchema?.additionalProperties)
      assert.include(requestSchema?.description ?? '', 'accepted and discarded')
      assert.include(requestSchema?.required ?? [], 'refresh_token')
      assert.equal(
        requestSchema?.properties?.refresh_token?.$ref,
        '#/components/schemas/RefreshToken'
      )
    }
    assert.sameMembers(schemas.CreateTenantRequest?.required ?? [], ['name', 'refresh_token'])
    assert.sameMembers(schemas.SwitchTenantRequest?.required ?? [], ['tenant_id', 'refresh_token'])
    assert.equal(schemas.SwitchTenantRequest?.properties?.tenant_id?.minimum, 1)
    assert.equal(schemas.SwitchTenantRequest?.properties?.tenant_id?.maximum, 2_147_483_647)
    assert.isFalse(schemas.Tenant?.additionalProperties)

    assert.equal(schemas.BenefitPresentationToken?.minLength, 46)
    assert.equal(schemas.BenefitPresentationToken?.maxLength, 512)
    assert.equal(
      schemas.BenefitPresentationToken?.pattern,
      '^(?:(?:[A-Za-z0-9_-]{4})+|(?:[A-Za-z0-9_-]{4})*[A-Za-z0-9_-][AQgw]|(?:[A-Za-z0-9_-]{4})*[A-Za-z0-9_-]{2}[AEIMQUYcgkosw048])\\.[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'
    )
    assert.equal(schemas.BenefitPresentationTokenInput?.minLength, 46)
    assert.equal(schemas.BenefitPresentationTokenInput?.maxLength, 512)
    assert.equal(
      schemas.BenefitPresentationTokenInput?.pattern,
      '^\\s*(?:(?:[A-Za-z0-9_-]{4})+|(?:[A-Za-z0-9_-]{4})*[A-Za-z0-9_-][AQgw]|(?:[A-Za-z0-9_-]{4})*[A-Za-z0-9_-]{2}[AEIMQUYcgkosw048])\\.[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]\\s*$'
    )
    assert.isUndefined(schemas.BenefitPresentationRequest?.additionalProperties)
    assert.include(
      schemas.BenefitPresentationRequest?.description ?? '',
      'Unknown request properties are accepted and discarded'
    )
    for (const identifier of ['access_id', 'offer_id']) {
      assert.equal(schemas.BenefitPresentationRequest?.properties?.[identifier]?.minimum, 1)
      assert.equal(
        schemas.BenefitPresentationRequest?.properties?.[identifier]?.maximum,
        2_147_483_647
      )
    }
    assert.isUndefined(schemas.BenefitPresentationTokenRequest?.additionalProperties)
    assert.include(
      schemas.BenefitPresentationTokenRequest?.description ?? '',
      'Surrounding whitespace in the HTTP token field is normalized'
    )
    assert.include(
      schemas.BenefitPresentationTokenRequest?.description ?? '',
      'Unknown request properties are accepted and discarded'
    )
    assert.equal(
      schemas.BenefitPresentationTokenRequest?.properties?.token?.$ref,
      '#/components/schemas/BenefitPresentationTokenInput'
    )
    for (const responseSchema of [
      'BenefitPresentation',
      'BenefitRedemptionPreview',
      'BenefitRedemptionReceipt',
    ]) {
      assert.isFalse(schemas[responseSchema]?.additionalProperties)
    }
    for (const responseSchema of ['BenefitPresentation', 'BenefitRedemptionPreview']) {
      assert.equal(
        schemas[responseSchema]?.properties?.token?.$ref,
        '#/components/schemas/BenefitPresentationToken'
      )
    }
    assert.equal(schemas.BenefitReceiptCode?.minLength, 20)
    assert.equal(schemas.BenefitReceiptCode?.maxLength, 20)
    assert.equal(schemas.BenefitReceiptCode?.pattern, '^EXP-[0-9A-F]{16}$')

    for (const receiptPath of [
      '/api/v1/me/benefits/redemptions/{receiptCode}',
      '/api/v1/benefit-redemptions/{receiptCode}',
    ]) {
      const operation = operationAt(specification, receiptPath, 'get')
      const receiptParameter = operation?.parameters?.find(
        (parameter) => parameter.name === 'receiptCode'
      )
      assert.equal(receiptParameter?.schema?.$ref, '#/components/schemas/BenefitReceiptCode')
      assert.equal(
        operation?.responses?.['404']?.$ref,
        '#/components/responses/PrivateRedemptionReceiptNotFoundError'
      )
    }

    for (const tokenPath of [
      '/api/v1/benefit-redemptions/preview',
      '/api/v1/benefit-redemptions',
    ]) {
      const operation = operationAt(specification, tokenPath, 'post')
      assert.equal(
        operation?.requestBody?.content?.['application/json']?.schema?.$ref,
        '#/components/schemas/BenefitPresentationTokenRequest'
      )
      assert.equal(
        operation?.responses?.['400']?.$ref,
        '#/components/responses/PrivateBenefitRedemptionBadRequest'
      )
    }

    const redemptionBadRequest =
      specification.components?.responses?.PrivateBenefitRedemptionBadRequest
    assert.include(redemptionBadRequest?.description ?? '', 'invalid or expired')
    assert.include(redemptionBadRequest?.description ?? '', 'redemption limit')
    assert.deepInclude(
      redemptionBadRequest?.content?.['application/json']?.examples?.invalidPresentation?.value ??
        {},
      {
        status: 400,
        message:
          'Esta apresentação é inválida ou expirou. Peça ao cliente para gerar uma nova apresentação e tente novamente.',
      }
    )
    assert.deepInclude(
      redemptionBadRequest?.content?.['application/json']?.examples?.benefitNotRedeemable?.value ??
        {},
      { status: 400, message: 'Benefit offer is not active' }
    )

    const refreshSchema = operationAt(specification, '/api/v1/sessions/refresh', 'post')
      ?.responses?.['200']?.content?.['application/json']?.schema
    assert.include(refreshSchema?.required ?? [], 'auth')

    assert.equal(specification.components?.headers?.PrivatePragma?.schema?.const, 'no-cache')
    assert.equal(specification.components?.headers?.GuestRateLimitLimit?.schema?.const, 10)

    const privateHeaderRefs = {
      'Cache-Control': '#/components/headers/PrivateCacheControl',
      'Pragma': '#/components/headers/PrivatePragma',
      'X-Robots-Tag': '#/components/headers/PrivateRobotsTag',
      'Referrer-Policy': '#/components/headers/PrivateReferrerPolicy',
    }
    const malformedJsonResponse = specification.components?.responses?.PrivateMalformedJsonError
    for (const [header, reference] of Object.entries(privateHeaderRefs)) {
      assert.equal(malformedJsonResponse?.headers?.[header]?.$ref, reference)
    }
    assert.equal(
      malformedJsonResponse?.content?.['application/json']?.schema?.$ref,
      '#/components/schemas/ApiMessageError'
    )
    assert.deepEqual(malformedJsonResponse?.content?.['application/json']?.example, {
      status: 400,
      message: 'Malformed JSON request body',
    })

    for (const path of [
      '/api/v1/sessions/sign-up',
      '/api/v1/sessions/refresh',
      '/api/v1/sessions/logout',
      '/api/v1/tenants',
      '/api/v1/tenants/switch',
    ]) {
      assert.equal(
        operationAt(specification, path, 'post')?.responses?.['400']?.$ref,
        '#/components/responses/PrivateMalformedJsonError'
      )
    }

    const signInBadRequest = operationAt(specification, '/api/v1/sessions/sign-in', 'post')
      ?.responses?.['400']
    for (const [header, reference] of Object.entries(privateHeaderRefs)) {
      assert.equal(signInBadRequest?.headers?.[header]?.$ref, reference)
    }
    assert.deepEqual(
      signInBadRequest?.content?.['application/json']?.schema?.oneOf?.map((schema) => schema.$ref),
      ['#/components/schemas/Error', '#/components/schemas/ApiMessageError']
    )
    assert.deepEqual(
      signInBadRequest?.content?.['application/json']?.examples?.invalidCredentials?.value,
      { errors: [{ message: 'Invalid credentials' }] }
    )
    assert.deepEqual(
      signInBadRequest?.content?.['application/json']?.examples?.malformedJson?.value,
      { status: 400, message: 'Malformed JSON request body' }
    )

    const tokenIssuers = [
      { path: '/api/v1/sessions/sign-in', status: '200', rateLimit: 'AuthRateLimitLimit' },
      { path: '/api/v1/sessions/sign-up', status: '201', rateLimit: 'AuthRateLimitLimit' },
      { path: '/api/v1/sessions/refresh', status: '200', rateLimit: 'GuestRateLimitLimit' },
      { path: '/api/v1/tenants', status: '201', rateLimit: 'RateLimitLimit' },
      { path: '/api/v1/tenants/switch', status: '200', rateLimit: 'RateLimitLimit' },
    ]
    for (const issuer of tokenIssuers) {
      const response = operationAt(specification, issuer.path, 'post')?.responses?.[issuer.status]
      assert.equal(
        response?.headers?.['Cache-Control']?.$ref,
        '#/components/headers/PrivateCacheControl'
      )
      assert.equal(response?.headers?.Pragma?.$ref, '#/components/headers/PrivatePragma')
      assert.equal(
        response?.headers?.['X-Robots-Tag']?.$ref,
        '#/components/headers/PrivateRobotsTag'
      )
      assert.equal(
        response?.headers?.['Referrer-Policy']?.$ref,
        '#/components/headers/PrivateReferrerPolicy'
      )
      assert.equal(
        response?.headers?.['X-RateLimit-Limit']?.$ref,
        `#/components/headers/${issuer.rateLimit}`
      )
    }

    const rotatingRequests = [
      {
        path: '/api/v1/sessions/refresh',
        schema: 'RefreshTokenRequest',
        rateLimitResponse: 'PrivateGuestRateLimitError',
      },
      {
        path: '/api/v1/tenants',
        schema: 'CreateTenantRequest',
        rateLimitResponse: 'PrivateRateLimitError',
      },
      {
        path: '/api/v1/tenants/switch',
        schema: 'SwitchTenantRequest',
        rateLimitResponse: 'PrivateRateLimitError',
      },
    ]
    for (const rotatingRequest of rotatingRequests) {
      const operation = operationAt(specification, rotatingRequest.path, 'post')
      assert.equal(
        operation?.requestBody?.content?.['application/json']?.schema?.$ref,
        `#/components/schemas/${rotatingRequest.schema}`
      )
      assert.equal(
        operation?.responses?.['401']?.$ref,
        '#/components/responses/PrivateSessionMutationUnauthorizedError'
      )
      assert.equal(
        operation?.responses?.['422']?.$ref,
        '#/components/responses/PrivateValidationError'
      )
      assert.equal(
        operation?.responses?.['429']?.$ref,
        `#/components/responses/${rotatingRequest.rateLimitResponse}`
      )
    }

    const logout = operationAt(specification, '/api/v1/sessions/logout', 'post')
    assert.equal(
      logout?.responses?.['204']?.headers?.['X-RateLimit-Limit']?.$ref,
      '#/components/headers/GuestRateLimitLimit'
    )
    assert.equal(
      logout?.responses?.['429']?.$ref,
      '#/components/responses/PrivateGuestRateLimitError'
    )

    for (const tenantPath of ['/api/v1/tenants', '/api/v1/tenants/switch']) {
      assert.equal(
        operationAt(specification, tenantPath, 'post')?.responses?.['403']?.$ref,
        '#/components/responses/PrivateForbiddenError'
      )
    }

    for (const authPath of ['/api/v1/sessions/sign-in', '/api/v1/sessions/sign-up']) {
      assert.equal(
        operationAt(specification, authPath, 'post')?.responses?.['429']?.$ref,
        '#/components/responses/PrivateAuthRateLimitError'
      )
    }

    for (const tokenEnvelope of [
      { path: '/api/v1/tenants', status: '201' },
      { path: '/api/v1/tenants/switch', status: '200' },
    ]) {
      const schema = operationAt(specification, tokenEnvelope.path, 'post')?.responses?.[
        tokenEnvelope.status
      ]?.content?.['application/json']?.schema
      assert.sameMembers(schema?.required ?? [], ['tenant', 'auth'])
    }

    const deleteSchema = operationAt(specification, '/api/v1/me', 'delete')?.requestBody?.content?.[
      'application/json'
    ]?.schema
    assert.equal(deleteSchema?.properties?.confirmation?.const, 'EXCLUIR MINHA CONTA')

    const catalogSearch = operationAt(
      specification,
      '/api/v1/catalog/cities/{citySlug}/establishments',
      'get'
    )
    const catalogParameters = catalogSearch?.parameters?.map((parameter) => parameter.name) ?? []
    assert.include(catalogParameters, 'category')
    assert.notInclude(catalogParameters, 'category_slug')

    const cityParameters =
      operationAt(specification, '/api/v1/catalog/cities', 'get')?.parameters?.map(
        (parameter) => parameter.name
      ) ?? []
    assert.notInclude(cityParameters, 'region_slug')

    const verifyEmailResponses =
      operationAt(specification, '/api/v1/verify-email', 'get')?.responses ?? {}
    const verifyBadRequest = verifyEmailResponses['400']
    const verifyNotFound = verifyEmailResponses['404']
    assert.include(verifyBadRequest?.description ?? '', 'expired')
    assert.include(verifyBadRequest?.description ?? '', 'already verified')
    assert.equal(
      verifyBadRequest?.content?.['application/json']?.examples?.expired?.value?.status,
      400
    )
    assert.equal(
      verifyBadRequest?.content?.['application/json']?.examples?.alreadyVerified?.value?.status,
      400
    )
    assert.include(verifyNotFound?.description ?? '', 'supplied verification token')
    assert.equal(verifyNotFound?.content?.['application/json']?.example?.status, 404)
  })
})
