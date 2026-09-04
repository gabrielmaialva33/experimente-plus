import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import router from '@adonisjs/core/services/router'
import { test } from '@japa/runner'
import { parse } from 'yaml'

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace'] as const
type HttpMethod = (typeof HTTP_METHODS)[number]

type OpenApiSchema = {
  const?: unknown
  properties?: Record<string, OpenApiSchema>
  required?: string[]
  type?: unknown
}

type OpenApiParameter = {
  name?: string
}

type OpenApiOperation = {
  operationId?: string
  parameters?: OpenApiParameter[]
  requestBody?: {
    content?: Record<string, { schema?: OpenApiSchema }>
  }
  responses?: Record<
    string,
    {
      description?: string
      content?: Record<
        string,
        {
          schema?: OpenApiSchema
          example?: Record<string, unknown>
          examples?: Record<string, { value?: Record<string, unknown> }>
        }
      >
    }
  >
}

type OpenApiPathItem = Partial<Record<HttpMethod, OpenApiOperation>>

type OpenApiDocument = {
  openapi?: string
  paths?: Record<string, OpenApiPathItem>
  components?: {
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
    assert.include(schemas.AuthResponse?.required ?? [], 'auth')
    assert.deepEqual(schemas.AuthResponse?.properties?.username?.type, ['string', 'null'])

    const refreshSchema = operationAt(specification, '/api/v1/sessions/refresh', 'post')
      ?.responses?.['200']?.content?.['application/json']?.schema
    assert.include(refreshSchema?.required ?? [], 'auth')

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
