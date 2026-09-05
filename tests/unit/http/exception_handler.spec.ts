import type { HttpContext } from '@adonisjs/core/http'
import { errors as driveErrors } from '@adonisjs/drive'
import type { Assert } from '@japa/assert'
import { test } from '@japa/runner'

import HttpExceptionHandler from '#exceptions/handler'

const REQUEST_ID = '9cc96391-53b4-43a3-9e2b-b9df673ce11b'
const PUBLIC_MESSAGE = 'Algo deu errado ao processar sua solicitação. Tente novamente em instantes.'

class ProductionExceptionHandler extends HttpExceptionHandler {
  protected override debug = false

  renderNotFoundForTest(ctx: HttpContext) {
    return this.statusPages['404'](
      {
        message: 'Cannot GET:/private-route?token=secret',
        status: 404,
      },
      ctx
    )
  }
}

type CapturedResponse = {
  body?: unknown
  headers: Map<string, unknown>
  inertia?: {
    component: string
    props: Record<string, unknown>
  }
  logs: Array<{ bindings: unknown; message: string }>
  status?: number
}

type ResponseFormat = 'application/vnd.api+json' | 'html' | 'json'

function createContext(options: {
  format: ResponseFormat
  inertiaError?: Error
  omitInertia?: boolean
  url: string
}): {
  captured: CapturedResponse
  ctx: HttpContext
} {
  const captured: CapturedResponse = { headers: new Map(), logs: [] }
  const response = {
    header(name: string, value: unknown) {
      captured.headers.set(name.toLowerCase(), value)
      return this
    },
    getStatus() {
      return captured.status ?? 200
    },
    getHeaders() {
      return Object.fromEntries(captured.headers)
    },
    json(body: unknown) {
      captured.body = body
      return body
    },
    removeHeader(name: string) {
      captured.headers.delete(name.toLowerCase())
      return this
    },
    send(body: unknown) {
      captured.body = body
      return body
    },
    status(status: number) {
      captured.status = status
      return this
    },
    type(contentType: string) {
      captured.headers.set('content-type', contentType)
      return this
    },
  }
  const ctxData = {
    logger: {
      error(bindings: unknown, message: string) {
        captured.logs.push({ bindings, message })
      },
    },
    request: {
      accepts: () => options.format,
      id: () => REQUEST_ID,
      url: () => options.url,
    },
    response,
  } as Record<string, unknown>

  if (!options.omitInertia) {
    ctxData.inertia = {
      async render(component: string, props: Record<string, unknown>) {
        captured.inertia = { component, props }
        if (options.inertiaError) {
          captured.headers.set('x-internal-query', 'select secret from private_table')
          throw options.inertiaError
        }
        return { component, props }
      },
    }
  }

  return { captured, ctx: ctxData as unknown as HttpContext }
}

type SimulatedDatabaseError = Error & {
  code: string
  column: string
  detail: string
  query: string
  table: string
}

function createDatabaseError(): SimulatedDatabaseError {
  const sql = 'select "attribute_slugs" from "catalog_establishments"'
  const error = Object.assign(new Error(`column "attribute_slugs" does not exist: ${sql}`), {
    code: '42703',
    column: 'attribute_slugs',
    detail: 'Failed while querying the public catalog projection',
    name: 'DatabaseError',
    query: sql,
    table: 'catalog_establishments',
  })
  error.stack = `DatabaseError: ${error.message}\n    at PostgreSQLClient.query (/srv/app/database.js:81:17)`
  return error
}

function assertNoInternalDetails(assert: Assert, response: CapturedResponse): void {
  const serialized = JSON.stringify({
    body: response.body,
    headers: Object.fromEntries(response.headers),
    inertia: response.inertia,
    status: response.status,
  }).toLowerCase()

  for (const internalDetail of [
    'select',
    'attribute_slugs',
    'catalog_establishments',
    'databaseerror',
    'postgresqlclient',
    '42703',
    '/srv/app',
    'private_table',
    'private_uploads',
    'secret',
    'x-internal-query',
  ]) {
    assert.notInclude(serialized, internalDetail)
  }
}

test.group('Production exception handler', () => {
  test('renders a private 404 without serializing the route error', async ({ assert }) => {
    const handler = new ProductionExceptionHandler()
    const { captured, ctx } = createContext({ format: 'html', url: '/private-route' })

    await handler.renderNotFoundForTest(ctx)

    assert.equal(captured.inertia?.component, 'errors/not_found')
    assert.deepEqual(captured.inertia?.props, {})
    assert.equal(captured.headers.get('cache-control'), 'private, no-store')
    assert.equal(captured.headers.get('x-robots-tag'), 'noindex, nofollow')
    assert.equal(captured.headers.get('strict-transport-security'), 'max-age=15552000')
    assert.equal(captured.headers.get('x-frame-options'), 'DENY')
    assert.equal(captured.headers.get('x-content-type-options'), 'nosniff')
    assert.notInclude(JSON.stringify(captured), 'private-route')
    assert.notInclude(JSON.stringify(captured), 'token=secret')
  })

  test('sanitizes database failures returned as JSON', async ({ assert }) => {
    const handler = new ProductionExceptionHandler()
    const { captured, ctx } = createContext({ format: 'json', url: '/api/v1/catalog/cities' })

    await handler.handle(createDatabaseError(), ctx)

    assert.equal(captured.status, 500)
    assert.equal(captured.headers.get('x-request-id'), REQUEST_ID)
    assert.equal(captured.headers.get('cache-control'), 'private, no-store')
    assert.equal(captured.headers.get('strict-transport-security'), 'max-age=15552000')
    assert.equal(captured.headers.get('x-frame-options'), 'DENY')
    assert.equal(captured.headers.get('x-content-type-options'), 'nosniff')
    assert.deepEqual(captured.body, {
      errors: [
        {
          code: 'E_INTERNAL_SERVER_ERROR',
          message: PUBLIC_MESSAGE,
          status: 500,
        },
      ],
    })
    assertNoInternalDetails(assert, captured)
  })

  test('passes only the public error projection to Inertia', async ({ assert }) => {
    const handler = new ProductionExceptionHandler()
    const { captured, ctx } = createContext({ format: 'html', url: '/londrina/comer' })

    await handler.handle(createDatabaseError(), ctx)

    assert.equal(captured.status, 500)
    assert.equal(captured.headers.get('x-request-id'), REQUEST_ID)
    assert.equal(captured.inertia?.component, 'errors/server_error')
    assert.deepEqual(captured.inertia?.props, {
      error: {
        code: 'E_INTERNAL_SERVER_ERROR',
        message: PUBLIC_MESSAGE,
        status: 500,
      },
    })
    assertNoInternalDetails(assert, captured)
  })

  test('falls back to static safe HTML when the Inertia error page also fails', async ({
    assert,
  }) => {
    const handler = new ProductionExceptionHandler()
    const renderError = createDatabaseError()
    const { captured, ctx } = createContext({
      format: 'html',
      inertiaError: renderError,
      url: '/londrina/comer',
    })

    await handler.handle(createDatabaseError(), ctx)

    assert.equal(captured.status, 500)
    assert.equal(captured.headers.get('x-request-id'), REQUEST_ID)
    assert.equal(captured.headers.get('content-type'), 'html')
    assert.include(String(captured.body), PUBLIC_MESSAGE)
    assert.include(String(captured.body), 'E_INTERNAL_SERVER_ERROR')
    assert.deepEqual(captured.logs, [
      {
        bindings: {
          err: renderError,
          event: 'server_error_page_render_failed',
          requestId: REQUEST_ID,
        },
        message: 'Failed to render the sanitized server error page',
      },
    ])
    assertNoInternalDetails(assert, captured)
  })

  test('falls back safely when Inertia was not initialized', async ({ assert }) => {
    const handler = new ProductionExceptionHandler()
    const { captured, ctx } = createContext({
      format: 'html',
      omitInertia: true,
      url: '/londrina/comer',
    })

    await handler.handle(createDatabaseError(), ctx)

    assert.equal(captured.status, 500)
    assert.equal(captured.headers.get('x-request-id'), REQUEST_ID)
    assert.include(String(captured.body), 'E_INTERNAL_SERVER_ERROR')
    assert.lengthOf(captured.logs, 1)
    assertNoInternalDetails(assert, captured)
  })

  test('rebuilds a Drive ENOENT as a private and safe 404', async ({ assert }) => {
    const handler = new ProductionExceptionHandler()
    const { captured, ctx } = createContext({ format: 'html', url: '/uploads/missing.jpg' })
    const rootCause = Object.assign(new Error('select secret_file_path from private_uploads'), {
      code: 'ENOENT',
    })
    const missingFileError = new driveErrors.CannotServeFileException(rootCause)

    await handler.handle(missingFileError, ctx)

    assert.equal(captured.status, 404)
    assert.equal(captured.body, 'File not found')
    assert.equal(captured.headers.get('cache-control'), 'private, no-store')
    assert.equal(captured.headers.get('x-request-id'), REQUEST_ID)
    assertNoInternalDetails(assert, captured)
  })

  test('never invokes or reuses a self-handler whose original status is 5xx', async ({
    assert,
  }) => {
    const handler = new ProductionExceptionHandler()
    const { captured, ctx } = createContext({
      format: 'json',
      url: '/api/v1/catalog/cities',
    })
    const databaseError = createDatabaseError()
    let selfHandlerCalled = false
    const selfHandledError = Object.assign(databaseError, {
      handle: (_error: unknown, handlerContext: HttpContext) => {
        selfHandlerCalled = true
        return handlerContext.response.status(404).send({
          message: databaseError.message,
          query: databaseError.query,
          stack: databaseError.stack,
        })
      },
    })
    ctx.response.header('X-Internal-Query', 'select secret from private_table')

    await handler.handle(selfHandledError, ctx)

    assert.isFalse(selfHandlerCalled)
    assert.equal(captured.status, 500)
    assert.equal(captured.headers.get('x-request-id'), REQUEST_ID)
    assert.isUndefined(captured.headers.get('x-internal-query'))
    assert.deepEqual([...captured.headers.keys()].sort(), [
      'cache-control',
      'content-type',
      'pragma',
      'referrer-policy',
      'strict-transport-security',
      'x-content-type-options',
      'x-frame-options',
      'x-request-id',
      'x-robots-tag',
    ])
    assert.deepEqual(captured.body, {
      errors: [
        {
          code: 'E_INTERNAL_SERVER_ERROR',
          message: PUBLIC_MESSAGE,
          status: 500,
        },
      ],
    })
    assertNoInternalDetails(assert, captured)
  })

  test('does not let 4xx code labels downgrade an original 5xx', async ({ assert }) => {
    for (const code of ['E_VALIDATION_ERROR', 'E_TOO_MANY_REQUESTS', 'E_UNAUTHORIZED_ACCESS']) {
      const handler = new ProductionExceptionHandler()
      const { captured, ctx } = createContext({
        format: 'json',
        url: '/api/v1/catalog/cities',
      })
      const mislabeledServerError = Object.assign(createDatabaseError(), {
        code,
        messages: [{ message: 'select secret from private_table' }],
        status: 500,
      })

      await handler.handle(mislabeledServerError, ctx)

      assert.equal(captured.status, 500)
      assert.deepEqual(captured.body, {
        errors: [
          {
            code: 'E_INTERNAL_SERVER_ERROR',
            message: PUBLIC_MESSAGE,
            status: 500,
          },
        ],
      })
      assertNoInternalDetails(assert, captured)
    }
  })

  test('keeps Drive permission failures as private 500 responses', async ({ assert }) => {
    const handler = new ProductionExceptionHandler()
    const { captured, ctx } = createContext({ format: 'html', url: '/uploads/private.jpg' })
    const rootCause = Object.assign(new Error('select secret_file_path from private_uploads'), {
      code: 'EACCES',
    })
    const permissionError = new driveErrors.CannotServeFileException(rootCause)

    await handler.handle(permissionError, ctx)

    assert.equal(captured.status, 500)
    assert.notEqual(captured.body, 'File not found')
    assert.equal(captured.headers.get('cache-control'), 'private, no-store')
    assertNoInternalDetails(assert, captured)
  })

  test('preserves self-handlers whose original status is 4xx', async ({ assert }) => {
    const handler = new ProductionExceptionHandler()
    const { captured, ctx } = createContext({ format: 'html', url: '/domain-validation' })
    let selfHandlerCalled = false
    const clientError = Object.assign(new Error('Safe domain validation failure'), {
      status: 409,
      handle: (_error: unknown, handlerContext: HttpContext) => {
        selfHandlerCalled = true
        handlerContext.response.header('X-Domain-Error', 'conflict')
        return handlerContext.response.status(409).send('Safe domain validation failure')
      },
    })

    await handler.handle(clientError, ctx)

    assert.isTrue(selfHandlerCalled)
    assert.equal(captured.status, 409)
    assert.equal(captured.body, 'Safe domain validation failure')
    assert.equal(captured.headers.get('x-domain-error'), 'conflict')
  })

  test('preserves a valid 503 while keeping its representation private', async ({ assert }) => {
    const handler = new ProductionExceptionHandler()
    const { captured, ctx } = createContext({
      format: 'json',
      url: '/api/v1/catalog/cities',
    })
    const databaseError = Object.assign(createDatabaseError(), { status: 503 })

    await handler.handle(databaseError, ctx)

    assert.equal(captured.status, 503)
    assert.deepEqual(captured.body, {
      errors: [
        {
          code: 'E_INTERNAL_SERVER_ERROR',
          message: PUBLIC_MESSAGE,
          status: 503,
        },
      ],
    })
    assertNoInternalDetails(assert, captured)
  })

  test('uses a JSON:API error document and media type when explicitly negotiated', async ({
    assert,
  }) => {
    const handler = new ProductionExceptionHandler()
    const { captured, ctx } = createContext({
      format: 'application/vnd.api+json',
      url: '/api/v1/catalog/cities',
    })

    await handler.handle(createDatabaseError(), ctx)

    assert.equal(captured.status, 500)
    assert.equal(captured.headers.get('content-type'), 'application/vnd.api+json')
    assert.deepEqual(captured.body, {
      errors: [
        {
          code: 'E_INTERNAL_SERVER_ERROR',
          status: '500',
          title: PUBLIC_MESSAGE,
        },
      ],
    })
    assertNoInternalDetails(assert, captured)
  })
})
