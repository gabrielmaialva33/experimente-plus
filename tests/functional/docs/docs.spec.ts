import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import router from '@adonisjs/core/services/router'
import { test } from '@japa/runner'
import { parse } from 'yaml'

import EstablishmentEvent from '#modules/partner_content/models/establishment_event'
import EstablishmentExperience from '#modules/partner_content/models/establishment_experience'
import EstablishmentShowcaseItem from '#modules/partner_content/models/establishment_showcase_item'
import PartnerContentPolicy from '#modules/partner_content/models/partner_content_policy'
import ContentReport from '#modules/reviews/models/content_report'
import EstablishmentReview from '#modules/reviews/models/establishment_review'
import EstablishmentReviewReply from '#modules/reviews/models/establishment_review_reply'
import ReviewPolicy from '#modules/reviews/models/review_policy'

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace'] as const
type HttpMethod = (typeof HTTP_METHODS)[number]

type OpenApiSchema = {
  $ref?: string
  additionalProperties?: boolean
  const?: unknown
  default?: unknown
  deprecated?: boolean
  description?: string
  discriminator?: {
    propertyName?: string
    mapping?: Record<string, string>
  }
  allOf?: OpenApiSchema[]
  enum?: unknown[]
  format?: string
  items?: OpenApiSchema
  maxLength?: number
  maxItems?: number
  maximum?: number
  minLength?: number
  minItems?: number
  minimum?: number
  oneOf?: OpenApiSchema[]
  pattern?: string
  properties?: Record<string, OpenApiSchema>
  required?: string[]
  type?: unknown
  uniqueItems?: boolean
}

type OpenApiHeader = {
  $ref?: string
  schema?: OpenApiSchema
}

type OpenApiParameter = {
  $ref?: string
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
  security?: Record<string, string[]>[]
  description?: string
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
    method: 'get',
    runtimePath: '/api/v1/catalog/benefit-editions',
    openApiPath: '/api/v1/catalog/benefit-editions',
  },
  { method: 'get', runtimePath: '/api/v1/me/purchases', openApiPath: '/api/v1/me/purchases' },
  { method: 'post', runtimePath: '/api/v1/me/purchases', openApiPath: '/api/v1/me/purchases' },
  {
    method: 'get',
    runtimePath: '/api/v1/me/purchases/:id',
    openApiPath: '/api/v1/me/purchases/{id}',
  },
  {
    method: 'post',
    runtimePath: '/api/v1/me/purchases/:id/cancel',
    openApiPath: '/api/v1/me/purchases/{id}/cancel',
  },
  {
    method: 'post',
    runtimePath: '/api/v1/me/purchases/:id/refunds',
    openApiPath: '/api/v1/me/purchases/{id}/refunds',
  },
  { method: 'get', runtimePath: '/api/v1/admin/purchases', openApiPath: '/api/v1/admin/purchases' },
  {
    method: 'get',
    runtimePath: '/api/v1/admin/purchases/:id',
    openApiPath: '/api/v1/admin/purchases/{id}',
  },
  {
    method: 'post',
    runtimePath: '/api/v1/admin/purchases/:id/refunds/:refundId/decision',
    openApiPath: '/api/v1/admin/purchases/{id}/refunds/{refundId}/decision',
  },
  {
    method: 'post',
    runtimePath: '/api/v1/admin/purchases/:id/reconcile',
    openApiPath: '/api/v1/admin/purchases/{id}/reconcile',
  },
  {
    method: 'post',
    runtimePath: '/api/v1/admin/purchases/settlements',
    openApiPath: '/api/v1/admin/purchases/settlements',
  },
  {
    method: 'get',
    runtimePath: '/api/v1/admin/purchases/reconciliation',
    openApiPath: '/api/v1/admin/purchases/reconciliation',
  },
  {
    method: 'post',
    runtimePath: '/api/v1/payments/webhooks/:provider',
    openApiPath: '/api/v1/payments/webhooks/{provider}',
  },
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
  test('public storefront documents the server payment method contract and public-only projection', async ({
    assert,
  }) => {
    const specification = await readOpenApi()
    const operation = operationAt(specification, '/api/v1/catalog/benefit-editions', 'get')
    assert.deepEqual(operation?.security, [])
    assert.equal(
      operation?.responses?.['200']?.content?.['application/json']?.schema?.$ref,
      '#/components/schemas/PurchaseCatalog'
    )
    const schemas = specification.components!.schemas!
    const edition = schemas.PurchasableEdition
    assert.isFalse(edition.additionalProperties)
    assert.sameMembers(edition.required!, [
      'id',
      'edition_id',
      'offer_id',
      'product_type',
      'establishment',
      'name',
      'description',
      'city',
      'status',
      'sales_starts_at',
      'sales_ends_at',
      'usage_starts_at',
      'usage_ends_at',
      'payment_methods',
      'amount_cents',
      'currency',
      'terms_version',
      'snapshot',
      'purchasable',
    ])
    assert.sameMembers(Object.keys(edition.properties!), edition.required!)
    assert.equal(edition.properties?.payment_methods.minItems, 1)
    assert.isTrue(edition.properties?.payment_methods.uniqueItems)
    assert.equal(
      edition.properties?.payment_methods.items?.$ref,
      '#/components/schemas/PaymentMethod'
    )
    assert.equal(
      schemas.PurchaseRequest.properties?.method.$ref,
      '#/components/schemas/PaymentMethod'
    )
    assert.deepEqual(schemas.PaymentMethod.enum, ['pix', 'card'])
    assert.sameMembers(schemas.PurchaseCatalog.required!, ['products', 'editions', 'offers'])
    assert.deepEqual(schemas.PurchaseCatalog.properties?.products.items?.oneOf, [
      { $ref: '#/components/schemas/PurchasableEdition' },
      { $ref: '#/components/schemas/PurchasableOffer' },
    ])
    for (const name of [
      'PurchasableEdition',
      'PurchasableOffer',
      'PurchaseSnapshot',
      'PurchaseRequest',
    ]) {
      assert.include(schemas[name].required!, 'terms_version')
      assert.equal(schemas[name].properties?.terms_version.pattern, '^[a-f0-9]{64}$')
    }
    assert.equal(schemas.PurchasableOffer.properties?.product_type.const, 'offer')
    assert.equal(schemas.PurchasableOffer.properties?.offer_id.type, 'integer')
    assert.equal(schemas.PurchaseRequest.properties?.offer_id.minimum, 1)
    assert.equal(edition.properties?.status.const, 'published')
    assert.equal(edition.properties?.purchasable.const, true)
  })
  test('reviews document the columns the models actually have, and only those', async ({
    assert,
  }) => {
    // The reviews contract was written before the tables settled and drifted from
    // them: it promised `title`, `photos` as URLs and `visit_verified`, none of
    // which exist, while hiding `photos_count`, `edited_at` and the author. The
    // mobile client generates its types from this file, so the drift reached the
    // app as fields that are always undefined. Deriving the expectation from the
    // models is what keeps a later column from repeating it.
    const specification = await readOpenApi()
    const schemas = specification.components!.schemas!

    const serialisable = (model: {
      $columnsDefinitions: Map<string, { serializeAs: string | null }>
    }) =>
      [...model.$columnsDefinitions.entries()]
        .filter(([, definition]) => definition.serializeAs !== null)
        .map(([, definition]) => definition.serializeAs!)

    const documented = (name: string, relations: string[] = []) =>
      Object.keys(schemas[name].properties!).filter((property) => !relations.includes(property))

    assert.sameMembers(
      documented('EstablishmentReview', ['author', 'reply']),
      serialisable(EstablishmentReview)
    )
    assert.sameMembers(
      documented('EstablishmentReviewReply'),
      serialisable(EstablishmentReviewReply)
    )
    assert.sameMembers(documented('ContentReport'), serialisable(ContentReport))
    assert.sameMembers(documented('ReviewPolicy'), serialisable(ReviewPolicy))

    // A report may name its author only to moderation. The hashes exist to
    // recognise repetition from the same origin, never to reveal who wrote it,
    // so they must stay out of the model's serialisation and out of this file.
    for (const hidden of ['reporter_ip_hash', 'reporter_token_hash']) {
      assert.equal(ContentReport.$columnsDefinitions.get(hidden)?.serializeAs, null)
      assert.notProperty(schemas.ContentReport.properties!, hidden)
    }

    // The public listing shows a name; it must not become a route to the email.
    assert.sameMembers(Object.keys(schemas.ReviewAuthor.properties!), [
      'id',
      'full_name',
      'username',
    ])
    assert.equal(
      schemas.EstablishmentReview.properties?.author.$ref,
      '#/components/schemas/ReviewAuthor'
    )

    // Every documented query parameter has to be one the validator accepts, or
    // the document promises a filter that is silently dropped.
    const listing = operationAt(
      specification,
      '/api/v1/catalog/establishments/{establishmentId}/reviews',
      'get'
    )
    assert.sameMembers(
      (listing?.parameters ?? [])
        .map((parameter) => ('name' in parameter ? parameter.name : undefined))
        .filter((name): name is string => name !== undefined),
      ['establishmentId', 'rating']
    )
  })

  test('partner content documents the columns its tables actually have', async ({ assert }) => {
    // Same guard as the reviews contract, for the same reason: the mobile and
    // web clients generate their types from this file, so a column the document
    // invents is a field that is always undefined on the other side.
    const specification = await readOpenApi()
    const schemas = specification.components!.schemas!

    const serialisable = (model: {
      $columnsDefinitions: Map<string, { serializeAs: string | null }>
    }) =>
      [...model.$columnsDefinitions.values()]
        .filter((definition) => definition.serializeAs !== null)
        .map((definition) => definition.serializeAs!)

    const pairs = [
      ['EstablishmentExperience', EstablishmentExperience],
      ['EstablishmentEvent', EstablishmentEvent],
      ['EstablishmentShowcaseItem', EstablishmentShowcaseItem],
      ['PartnerContentPolicy', PartnerContentPolicy],
    ] as const

    for (const [name, model] of pairs) {
      assert.sameMembers(Object.keys(schemas[name].properties!), serialisable(model))
    }

    // The public list must not be documented as the row.
    //
    // The three schemas above describe the tables, and the tables carry
    // `tenant_id`, `created_by`, `archived_by` and the lifecycle. The public
    // route answers from `published_snapshot` and its response is cached as
    // `public, max-age=300`, so pointing that route at a row schema publishes
    // those columns as the contract even while the code withholds them — and a
    // client written against the document would then be right to expect them.
    assert.sameMembers(Object.keys(schemas.PartnerContentPublicItem.properties!), [
      'id',
      'kind',
      'title',
      'description',
      'starts_at',
      'ends_at',
      'informational_price_cents',
      'published_at',
      'media',
    ])

    const publicList = JSON.stringify(
      specification.paths!['/api/v1/catalog/establishments/{establishmentId}/{kind}']
    )
    assert.include(publicList, 'PartnerContentListResponse')
    assert.notInclude(JSON.stringify(schemas.PartnerContentListResponse), 'EstablishmentExperience')

    // The lifecycle is one enum shared by the three kinds, and it has to agree
    // with the check constraint the tables carry.
    assert.deepEqual(schemas.PartnerContentStatus.enum, [
      'draft',
      'pending_review',
      'published',
      'archived',
    ])

    // A showcase item shows a price and there is no route that charges it.
    const purchasePaths = Object.keys(specification.paths ?? {}).filter((path) =>
      /purchase|checkout/i.test(path)
    )
    for (const path of purchasePaths) {
      const body = JSON.stringify(specification.paths![path])
      assert.notInclude(body, 'ShowcaseItem')
    }
  })

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

  test('documents readiness responses as stateless and non-cacheable', async ({ assert }) => {
    const specification = await readOpenApi()
    const health = operationAt(specification, '/api/v1/health', 'get')
    const cacheHeader = '#/components/headers/ReadinessCacheControl'

    assert.include(health?.description ?? '', 'without creating a session')
    assert.equal(
      specification.components?.headers?.ReadinessCacheControl?.schema?.const,
      'no-store'
    )
    for (const status of ['200', '429', '503']) {
      assert.equal(health?.responses?.[status]?.headers?.['Cache-Control']?.$ref, cacheHeader)
    }
  })

  test('locks the administrative roles and permissions contracts', async ({ assert }) => {
    const specification = await readOpenApi()
    const schemas = specification.components?.schemas ?? {}
    const privateHeaders = {
      'Cache-Control': '#/components/headers/PrivateCacheControl',
      'Pragma': '#/components/headers/PrivatePragma',
      'X-Robots-Tag': '#/components/headers/PrivateRobotsTag',
      'Referrer-Policy': '#/components/headers/PrivateReferrerPolicy',
    }
    const operations = [
      { path: '/api/v1/admin/roles', method: 'get', success: '200' },
      { path: '/api/v1/admin/roles/attach', method: 'put', success: '200' },
      { path: '/api/v1/admin/permissions', method: 'get', success: '200' },
      { path: '/api/v1/admin/permissions', method: 'post', success: '201' },
      { path: '/api/v1/admin/roles/permissions/sync', method: 'put', success: '200' },
      { path: '/api/v1/admin/roles/permissions/attach', method: 'put', success: '200' },
      { path: '/api/v1/admin/roles/permissions/detach', method: 'put', success: '200' },
      { path: '/api/v1/admin/users/permissions/sync', method: 'put', success: '200' },
      { path: '/api/v1/admin/users/{id}/permissions', method: 'get', success: '200' },
      { path: '/api/v1/admin/users/{id}/permissions/check', method: 'post', success: '200' },
    ] as const

    for (const expected of operations) {
      const operation = operationAt(specification, expected.path, expected.method)
      assert.exists(operation)
      assert.equal(
        operation?.responses?.['403']?.$ref,
        '#/components/responses/PrivateForbiddenError'
      )
      assert.equal(
        operation?.responses?.['422']?.$ref,
        '#/components/responses/PrivateValidationError'
      )
      assert.equal(
        operation?.responses?.['429']?.$ref,
        '#/components/responses/PrivateAdminRateLimitError'
      )

      const success = operation?.responses?.[expected.success]
      for (const [header, reference] of Object.entries(privateHeaders)) {
        assert.equal(success?.headers?.[header]?.$ref, reference)
      }
      assert.equal(
        success?.headers?.['X-RateLimit-Limit']?.$ref,
        '#/components/headers/AdminRateLimitLimit'
      )
      assert.equal(
        success?.headers?.['X-RateLimit-Remaining']?.$ref,
        '#/components/headers/RateLimitRemaining'
      )
    }

    const roleList = operationAt(specification, '/api/v1/admin/roles', 'get')
    assert.isUndefined(roleList?.requestBody)
    assert.equal(
      roleList?.responses?.['200']?.content?.['application/json']?.schema?.$ref,
      '#/components/schemas/PaginatedRolesResponse'
    )
    assert.include(
      roleList?.parameters?.map((parameter) => parameter.$ref) ?? [],
      '#/components/parameters/administrativePerPageParam'
    )
    assert.equal(
      specification.components?.schemas?.AdministrativePaginationMeta?.properties?.per_page
        ?.maximum,
      100
    )

    const roleAttach = operationAt(specification, '/api/v1/admin/roles/attach', 'put')
    assert.include(roleAttach?.description ?? '', 'Root may attach any canonical role')
    const roleAttachSchema = roleAttach?.requestBody?.content?.['application/json']?.schema
    assert.deepEqual(Object.keys(roleAttach?.requestBody?.content ?? {}), ['application/json'])
    assert.isUndefined(roleAttachSchema?.additionalProperties)
    assert.include(roleAttachSchema?.description ?? '', 'accepted and discarded')
    assert.equal(roleAttachSchema?.properties?.user_id?.minimum, 1)
    assert.equal(roleAttachSchema?.properties?.user_id?.maximum, 2_147_483_647)
    const roleIds = roleAttachSchema?.properties?.role_ids
    assert.equal(roleIds?.minItems, 1)
    assert.equal(roleIds?.maxItems, 5)
    assert.isTrue(roleIds?.uniqueItems)
    assert.equal(roleIds?.items?.minimum, 1)
    assert.equal(roleIds?.items?.maximum, 2_147_483_647)
    assert.equal(
      roleAttach?.responses?.['404']?.$ref,
      '#/components/responses/PrivateNotFoundError'
    )

    const permissionList = operationAt(specification, '/api/v1/admin/permissions', 'get')
    assert.isUndefined(permissionList?.requestBody)
    assert.equal(
      permissionList?.responses?.['200']?.content?.['application/json']?.schema?.$ref,
      '#/components/schemas/PaginatedPermissionsResponse'
    )
    assert.include(
      permissionList?.parameters?.map((parameter) => parameter.$ref) ?? [],
      '#/components/parameters/perPageParam'
    )

    const permissionCreate = operationAt(specification, '/api/v1/admin/permissions', 'post')
    const permissionCreateSchema =
      permissionCreate?.requestBody?.content?.['application/json']?.schema
    assert.deepEqual(Object.keys(permissionCreate?.requestBody?.content ?? {}), [
      'application/json',
    ])
    assert.isUndefined(permissionCreateSchema?.additionalProperties)
    assert.include(permissionCreateSchema?.description ?? '', 'accepted and discarded')
    assert.isTrue(permissionCreateSchema?.properties?.name?.deprecated)
    assert.include(permissionCreateSchema?.properties?.name?.description ?? '', 'discarded')
    assert.include(permissionCreate?.description ?? '', 'always derived')
    assert.include(permissionCreate?.description ?? '', 'canonical 422')
    assert.equal(
      permissionCreate?.responses?.['201']?.content?.['application/json']?.schema?.$ref,
      '#/components/schemas/Permission'
    )
    assert.equal(
      schemas.Permission?.properties?.name?.pattern,
      '^[a-z_]+\\.[a-z_]+(?:\\.(?:own|team|department))?$'
    )
    assert.isFalse(schemas.Permission?.additionalProperties)
    assert.equal(
      schemas.PaginatedPermissionsResponse?.properties?.data?.items?.$ref,
      '#/components/schemas/Permission'
    )

    for (const path of [
      '/api/v1/admin/roles/permissions/sync',
      '/api/v1/admin/roles/permissions/attach',
      '/api/v1/admin/roles/permissions/detach',
    ]) {
      const operation = operationAt(specification, path, 'put')
      const schema = operation?.requestBody?.content?.['application/json']?.schema
      assert.deepEqual(Object.keys(operation?.requestBody?.content ?? {}), ['application/json'])
      assert.isUndefined(schema?.additionalProperties)
      assert.include(schema?.description ?? '', 'accepted and discarded')
      assert.equal(schema?.properties?.role_id?.minimum, 1)
      assert.equal(schema?.properties?.role_id?.maximum, 2_147_483_647)
      assert.equal(schema?.properties?.permission_ids?.maxItems, 256)
      assert.isTrue(schema?.properties?.permission_ids?.uniqueItems)
      assert.equal(schema?.properties?.permission_ids?.items?.minimum, 1)
      assert.equal(schema?.properties?.permission_ids?.items?.maximum, 2_147_483_647)
      assert.equal(
        operation?.responses?.['404']?.$ref,
        '#/components/responses/PrivateNotFoundError'
      )
      assert.isFalse(
        operation?.responses?.['200']?.content?.['application/json']?.schema?.additionalProperties
      )
    }

    const userPermissionSync = operationAt(
      specification,
      '/api/v1/admin/users/permissions/sync',
      'put'
    )
    const userPermissionSchema =
      userPermissionSync?.requestBody?.content?.['application/json']?.schema
    assert.deepEqual(Object.keys(userPermissionSync?.requestBody?.content ?? {}), [
      'application/json',
    ])
    assert.isUndefined(userPermissionSchema?.additionalProperties)
    assert.isUndefined(userPermissionSchema?.properties?.permissions?.items?.additionalProperties)
    assert.equal(userPermissionSchema?.properties?.permissions?.maxItems, 256)
    assert.isTrue(userPermissionSchema?.properties?.permissions?.uniqueItems)
    assert.equal(
      userPermissionSchema?.properties?.permissions?.items?.properties?.permission_id?.maximum,
      2_147_483_647
    )
    assert.equal(
      userPermissionSync?.responses?.['400']?.content?.['application/json']?.schema?.$ref,
      '#/components/schemas/ApiMessageError'
    )
    assert.equal(
      userPermissionSync?.responses?.['404']?.$ref,
      '#/components/responses/PrivateNotFoundError'
    )

    const getUserPermissions = operationAt(
      specification,
      '/api/v1/admin/users/{id}/permissions',
      'get'
    )
    const getUserPathId = getUserPermissions?.parameters?.find(
      (parameter) => parameter.name === 'id'
    )
    assert.equal(getUserPathId?.schema?.minimum, 1)
    assert.equal(getUserPathId?.schema?.maximum, 2_147_483_647)
    assert.sameMembers(
      getUserPermissions?.responses?.['200']?.content?.['application/json']?.schema?.required ?? [],
      ['permissions']
    )

    const checkUserPermissions = operationAt(
      specification,
      '/api/v1/admin/users/{id}/permissions/check',
      'post'
    )
    const checkSchema = checkUserPermissions?.requestBody?.content?.['application/json']?.schema
    assert.deepEqual(Object.keys(checkUserPermissions?.requestBody?.content ?? {}), [
      'application/json',
    ])
    assert.isUndefined(checkSchema?.additionalProperties)
    assert.equal(checkSchema?.properties?.permissions?.minItems, 1)
    assert.equal(checkSchema?.properties?.permissions?.maxItems, 100)
    assert.isTrue(checkSchema?.properties?.permissions?.uniqueItems)
    assert.sameMembers(
      checkUserPermissions?.responses?.['200']?.content?.['application/json']?.schema?.required ??
        [],
      ['has_permission']
    )
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

  /**
   * The Explorer's own layer — ADR-0030.
   *
   * Checked in both directions, and that is the point. The mobile surface test
   * above compares a fixed list, so a whole module could be added to the router
   * with no documentation and every assertion here would still pass — which is
   * exactly how this module arrived. Here the router is the list.
   */
  test('documents every Explorer route, and only private ones', async ({ assert }) => {
    const specification = await readOpenApi()
    const explorerPath = /^\/api\/v1\/me\/(favorites|follows|saved|interests|itineraries)/

    const runtime = Object.values(router.toJSON())
      .flatMap((routes) => routes)
      .filter((route) => explorerPath.test(route.pattern))
      .flatMap((route) =>
        route.methods
          .filter((method) => method !== 'HEAD')
          .map((method) => `${method.toLowerCase()} ${route.pattern.replace(/:(\w+)/g, '{$1}')}`)
      )

    const documented = Object.entries(specification.paths ?? {})
      .filter(([pathName]) => explorerPath.test(pathName))
      .flatMap(([pathName, operations]) =>
        Object.keys(operations as object).map((method) => `${method} ${pathName}`)
      )

    assert.isAbove(runtime.length, 0)
    assert.sameMembers(documented, runtime)

    // Which places someone favourites or follows is a private preference.
    // A documented Explorer operation without authentication would be the
    // contract saying otherwise.
    for (const operation of documented) {
      const [method, pathName] = operation.split(' ')
      const security = operationAt(specification, pathName, method as HttpMethod)?.security
      assert.deepEqual(security, [{ bearerAuth: [] }], `${operation} must require a session`)
    }

    const card = specification.components!.schemas!.ExplorerEstablishmentCard
    assert.sameMembers(Object.keys(card.properties!), [
      'id',
      'slug',
      'name',
      'city_slug',
      'city_name',
      'cover_url',
      'category',
    ])
    for (const schemaName of Object.keys(specification.components!.schemas!)) {
      if (!schemaName.startsWith('Explorer')) continue
      const serialised = JSON.stringify(specification.components!.schemas![schemaName])
      assert.notMatch(serialised, /"(user_id|email|full_name)"/, `${schemaName} names a person`)
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
    const sessionUserFields = [
      'id',
      'full_name',
      'email',
      'username',
      'email_verified',
      'email_verified_at',
      'created_at',
      'updated_at',
      'roles',
      'auth',
    ]
    assert.sameMembers(schemas.SignInResponse?.required ?? [], sessionUserFields)
    assert.sameMembers(schemas.SignUpResponse?.required ?? [], [
      ...sessionUserFields,
      'email_verification_sent',
    ])
    assert.isFalse(schemas.SignInResponse?.additionalProperties)
    assert.isFalse(schemas.SignUpResponse?.additionalProperties)
    assert.deepEqual(schemas.SignInResponse?.properties?.username?.type, ['string', 'null'])
    assert.deepEqual(schemas.SignInResponse?.properties?.email_verified_at?.type, [
      'string',
      'null',
    ])
    assert.deepEqual(schemas.Role?.properties?.description?.type, ['string', 'null'])
    assert.sameMembers(schemas.User?.required ?? [], [
      'id',
      'full_name',
      'email',
      'username',
      'email_verified',
      'email_verified_at',
      'created_at',
      'updated_at',
    ])
    assert.isFalse(schemas.User?.additionalProperties)
    assert.deepEqual(schemas.User?.properties?.username?.type, ['string', 'null'])
    assert.deepEqual(schemas.User?.properties?.email_verified_at?.type, ['string', 'null'])
    assert.deepEqual(schemas.User?.properties?.updated_at?.type, ['string', 'null'])
    assert.deepEqual(
      schemas.PaginatedUsersResponse?.properties?.data?.items?.allOf?.[1]?.required,
      ['roles']
    )
    assert.isUndefined(schemas.Role?.properties?.slug?.enum)
    assert.include(schemas.Role?.properties?.slug?.description ?? '', 'compatibility records')
    assert.isUndefined(schemas.AssignedRole?.properties?.slug?.enum)

    assert.equal(schemas.PasswordResetToken?.minLength, 64)
    assert.equal(schemas.PasswordResetToken?.maxLength, 64)
    assert.equal(schemas.PasswordResetToken?.pattern, '^[A-Za-z0-9_-]{64}$')
    assert.equal(
      schemas.PasswordResetRequest?.properties?.token?.$ref,
      '#/components/schemas/PasswordResetToken'
    )

    assert.equal(schemas.EmailVerificationToken?.minLength, 43)
    assert.equal(schemas.EmailVerificationToken?.maxLength, 43)
    assert.equal(schemas.EmailVerificationToken?.pattern, '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$')
    assert.include(schemas.EmailVerificationToken?.description ?? '', 'query string')
    assert.sameMembers(schemas.EmailVerificationResponse?.required ?? [], [
      'message',
      'email_verified',
      'email_verified_at',
    ])
    assert.isFalse(schemas.EmailVerificationResponse?.additionalProperties)
    assert.equal(
      schemas.EmailVerificationResponse?.properties?.message?.const,
      'Email verified successfully'
    )
    assert.equal(schemas.EmailVerificationResponse?.properties?.email_verified?.const, true)
    assert.sameMembers(schemas.MessageResponse?.required ?? [], ['message'])
    assert.isFalse(schemas.MessageResponse?.additionalProperties)

    assert.equal(schemas.EffectivePermissionProjection?.discriminator?.propertyName, 'source')
    assert.deepEqual(schemas.EffectivePermissionProjection?.discriminator?.mapping, {
      role: '#/components/schemas/RolePermissionProjection',
      direct: '#/components/schemas/DirectPermissionProjection',
    })

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
      { errors: [{ message: 'Invalid user credentials' }] }
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

    for (const authPath of [
      '/api/v1/sessions/sign-in',
      '/api/v1/sessions/sign-up',
      '/api/v1/sessions/forgot-password',
      '/api/v1/sessions/reset-password',
    ]) {
      const content = operationAt(specification, authPath, 'post')?.requestBody?.content ?? {}
      assert.deepEqual(Object.keys(content), ['application/json'])
    }
    const forgotPassword = operationAt(specification, '/api/v1/sessions/forgot-password', 'post')
    assert.equal(
      forgotPassword?.requestBody?.content?.['application/json']?.schema?.properties?.email
        ?.maxLength,
      254
    )
    assert.equal(
      forgotPassword?.responses?.['400']?.$ref,
      '#/components/responses/PrivateMalformedJsonError'
    )

    assert.equal(
      operationAt(specification, '/api/v1/sessions/sign-in', 'post')?.responses?.['200']?.content?.[
        'application/json'
      ]?.schema?.$ref,
      '#/components/schemas/SignInResponse'
    )
    assert.equal(
      operationAt(specification, '/api/v1/sessions/sign-up', 'post')?.responses?.['201']?.content?.[
        'application/json'
      ]?.schema?.$ref,
      '#/components/schemas/SignUpResponse'
    )

    for (const operation of [
      operationAt(specification, '/api/v1/sessions/sign-up', 'post'),
      operationAt(specification, '/api/v1/users', 'post'),
    ]) {
      const requestSchema = operation?.requestBody?.content?.['application/json']?.schema
      assert.equal(requestSchema?.properties?.full_name?.maxLength, 255)
      assert.equal(requestSchema?.properties?.email?.maxLength, 254)
    }

    assert.equal(
      operationAt(specification, '/api/v1/me/permissions', 'get')?.responses?.['200']?.content?.[
        'application/json'
      ]?.schema?.$ref,
      '#/components/schemas/MyPermissionsResponse'
    )
    assert.equal(
      operationAt(specification, '/api/v1/me/roles', 'get')?.responses?.['200']?.content?.[
        'application/json'
      ]?.schema?.$ref,
      '#/components/schemas/MyRolesResponse'
    )

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

    const verifyEmail = operationAt(specification, '/api/v1/verify-email', 'get')
    const verifyEmailResponses = verifyEmail?.responses ?? {}
    assert.equal(
      verifyEmail?.parameters?.find((parameter) => parameter.name === 'token')?.schema?.$ref,
      '#/components/schemas/EmailVerificationToken'
    )
    assert.equal(
      verifyEmailResponses['200']?.content?.['application/json']?.schema?.$ref,
      '#/components/schemas/EmailVerificationResponse'
    )
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
    assert.equal(
      verifyEmailResponses['422']?.content?.['application/json']?.schema?.$ref,
      '#/components/schemas/Error'
    )
    assert.equal(
      verifyEmailResponses['429']?.$ref,
      '#/components/responses/PrivateEmailVerificationRateLimitError'
    )

    for (const status of ['200', '400', '404', '422']) {
      const response = verifyEmailResponses[status]
      assert.equal(
        response?.headers?.['Cache-Control']?.$ref,
        '#/components/headers/PrivateCacheControl'
      )
      assert.equal(response?.headers?.['Pragma']?.$ref, '#/components/headers/PrivatePragma')
      assert.equal(
        response?.headers?.['X-Robots-Tag']?.$ref,
        '#/components/headers/PrivateRobotsTag'
      )
      assert.equal(
        response?.headers?.['Referrer-Policy']?.$ref,
        '#/components/headers/PrivateReferrerPolicy'
      )
    }
    assert.equal(
      verifyEmailResponses['200']?.headers?.['X-RateLimit-Limit']?.$ref,
      '#/components/headers/EmailVerificationRateLimitLimit'
    )

    const resendResponses =
      operationAt(specification, '/api/v1/resend-verification-email', 'post')?.responses ?? {}
    for (const status of ['200', '400', '503']) {
      const response = resendResponses[status]
      assert.equal(
        response?.content?.['application/json']?.schema?.$ref,
        '#/components/schemas/MessageResponse'
      )
      assert.equal(
        response?.headers?.['Cache-Control']?.$ref,
        '#/components/headers/PrivateCacheControl'
      )
      assert.equal(
        response?.headers?.['X-RateLimit-Limit']?.$ref,
        '#/components/headers/EmailVerificationResendRateLimitLimit'
      )
    }
    assert.equal(resendResponses['401']?.$ref, '#/components/responses/UnauthorizedError')
    assert.equal(
      resendResponses['429']?.$ref,
      '#/components/responses/PrivateEmailVerificationResendRateLimitError'
    )
  })
})
