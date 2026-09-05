import app from '@adonisjs/core/services/app'
import { ExceptionHandler, type HttpContext } from '@adonisjs/core/http'
import type { StatusPageRange, StatusPageRenderer } from '@adonisjs/core/types/http'
import { errors as driveErrors } from '@adonisjs/drive'

import { setPrivateResponseHeaders } from '#shared/utils/private_response_headers'

const MALFORMED_JSON_MESSAGE = 'Malformed JSON request body'
const UNAUTHORIZED_ACCESS_MESSAGE = 'Unauthorized access'
const INTERNAL_SERVER_ERROR_CODE = 'E_INTERNAL_SERVER_ERROR'
const FILE_NOT_FOUND_ERROR_CODE = 'E_FILE_NOT_FOUND'
const FILE_NOT_FOUND_ERROR_MESSAGE = 'File not found'
const JSON_API_MEDIA_TYPE = 'application/vnd.api+json'
const HSTS_MAX_AGE_SECONDS = 180 * 24 * 60 * 60
const INTERNAL_SERVER_ERROR_MESSAGE =
  'Algo deu errado ao processar sua solicitação. Tente novamente em instantes.'
const INTERNAL_SERVER_ERROR_HTML = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Erro interno</title>
  </head>
  <body>
    <main>
      <h1>Algo deu errado</h1>
      <p>${INTERNAL_SERVER_ERROR_MESSAGE}</p>
      <p>Código: ${INTERNAL_SERVER_ERROR_CODE}</p>
    </main>
  </body>
</html>`

type PublicServerError = {
  code: typeof INTERNAL_SERVER_ERROR_CODE
  message: typeof INTERNAL_SERVER_ERROR_MESSAGE
  status: number
}

export default class HttpExceptionHandler extends ExceptionHandler {
  /**
   * In debug mode, the exception handler will display verbose errors
   * with pretty printed stack traces.
   */
  protected debug = !app.inProduction

  /**
   * Status pages are used to display a custom HTML pages for certain error
   * codes. You might want to enable them in production only, but feel
   * free to enable them in development as well.
   */
  protected renderStatusPages = app.inProduction

  /**
   * Status pages is a collection of error code range and a callback
   * to return the HTML contents to send as a response.
   */
  protected statusPages: Record<StatusPageRange, StatusPageRenderer> = {
    '404': (error, { inertia }) => inertia.render('errors/not_found', { error }),
    '500..599': (error, { inertia }) =>
      inertia.render('errors/server_error', { error: createPublicServerError(error.status) }),
  }

  /**
   * The method is used for handling errors and returning
   * response to the client
   */
  async handle(error: unknown, ctx: HttpContext) {
    const isApiRequest = ctx.request.url().startsWith('/api/')
    if (isApiRequest) {
      setPrivateResponseHeaders(ctx.response)
    }

    const httpError = this.toHttpError(error)

    const debuggingEnabled = this.isDebuggingEnabled(ctx)

    /**
     * Adonis intentionally renders an exception's message in non-debug JSON
     * responses. Database drivers commonly put the SQL query and schema
     * identifiers in that message. Gate on the original status before any
     * code-specific handler can downgrade or render it. Never invoke or reuse
     * the response from a self-handler whose original status is 5xx. The only
     * downgrade is a Drive error whose root cause is proven to be ENOENT, and
     * that response is rebuilt from constants.
     */
    if (!debuggingEnabled && httpError.status >= 500) {
      if (isMissingLocalDriveFile(httpError)) {
        return this.renderPublicFileNotFound(ctx, isApiRequest)
      }

      return this.renderPublicServerError(httpError.status, ctx, isApiRequest)
    }

    if (isApiRequest && isMalformedJsonError(httpError)) {
      return ctx.response.status(400).json({
        status: 400,
        message: MALFORMED_JSON_MESSAGE,
      })
    }

    /**
     * Handle validation errors from VineJS
     */
    if ('code' in httpError && httpError.code === 'E_VALIDATION_ERROR') {
      const validationError = httpError as any
      const acceptsJson = ctx.request.accepts(['html', 'json']) === 'json'

      if (isApiRequest || acceptsJson) {
        return ctx.response.status(422).json({
          errors: validationError.messages || [],
        })
      }

      return super.handle(httpError, ctx)
    }

    /**
     * Handle rate limiting errors
     */
    if ('code' in httpError && httpError.code === 'E_TOO_MANY_REQUESTS') {
      const rateLimitError = httpError as any
      const message = rateLimitError.message || 'Too many requests'

      // Set rate limit headers from the response object
      if (rateLimitError.response) {
        ctx.response.header('x-ratelimit-limit', rateLimitError.response.limit)
        ctx.response.header('x-ratelimit-remaining', rateLimitError.response.remaining)
        ctx.response.header('retry-after', rateLimitError.response.availableIn)
      }

      if (!isApiRequest && ctx.request.accepts(['html', 'json']) !== 'json') {
        setPrivateResponseHeaders(ctx.response)
        ctx.session.flash('errors', { general: message })
        return ctx.response.redirect().back()
      }

      return ctx.response.status(429).json({
        errors: [
          {
            code: 'E_TOO_MANY_REQUESTS',
            message,
            status: 429,
          },
        ],
      })
    }

    /**
     * Handle authentication failures
     *
     * A browser navigating to a protected page should land on the login screen,
     * not on a bare 401. API clients keep the JSON body they parse.
     */
    if ('code' in httpError && httpError.code === 'E_UNAUTHORIZED_ACCESS') {
      if (isApiRequest) {
        return ctx.response.status(401).json({
          errors: [{ message: UNAUTHORIZED_ACCESS_MESSAGE }],
        })
      }

      const acceptsJson = ctx.request.accepts(['html', 'json']) === 'json'

      if (!acceptsJson) {
        const authError = httpError as any
        ctx.session.flash('error', authError.message || 'Faça login para continuar.')
        return ctx.response.redirect().toPath('/login')
      }
    }

    return super.handle(httpError, ctx)
  }

  private async renderPublicServerError(status: number, ctx: HttpContext, isApiRequest: boolean) {
    const publicStatus = Number.isInteger(status) && status >= 500 && status <= 599 ? status : 500
    const publicError = createPublicServerError(publicStatus)
    const requestId = ctx.request.id()

    this.preparePublicErrorResponse(ctx, requestId)

    const responseFormat = ctx.request.accepts(['html', JSON_API_MEDIA_TYPE, 'json'])
    if (responseFormat === JSON_API_MEDIA_TYPE) {
      ctx.response.header('Content-Type', JSON_API_MEDIA_TYPE)
      return ctx.response.status(publicStatus).send({
        errors: [
          {
            code: publicError.code,
            status: String(publicError.status),
            title: publicError.message,
          },
        ],
      })
    }

    if (isApiRequest || responseFormat === 'json') {
      ctx.response.header('Content-Type', 'application/json; charset=utf-8')
      return ctx.response.status(publicStatus).json({ errors: [publicError] })
    }

    try {
      const page = await ctx.inertia.render('errors/server_error', { error: publicError })
      return ctx.response.status(publicStatus).send(page)
    } catch (renderError) {
      this.reportSecondaryFailure(
        ctx,
        'server_error_page_render_failed',
        renderError,
        'Failed to render the sanitized server error page'
      )

      /**
       * Error pages must not depend on the same database-backed shared props
       * that may have caused the original failure. A static final response also
       * protects errors raised before the Inertia middleware was initialized.
       */
      this.preparePublicErrorResponse(ctx, requestId)
      return ctx.response.status(publicStatus).type('html').send(INTERNAL_SERVER_ERROR_HTML)
    }
  }

  private renderPublicFileNotFound(ctx: HttpContext, isApiRequest: boolean) {
    const requestId = ctx.request.id()
    this.preparePublicErrorResponse(ctx, requestId)

    const responseFormat = ctx.request.accepts(['html', JSON_API_MEDIA_TYPE, 'json'])
    if (responseFormat === JSON_API_MEDIA_TYPE) {
      ctx.response.header('Content-Type', JSON_API_MEDIA_TYPE)
      return ctx.response.status(404).send({
        errors: [
          {
            code: FILE_NOT_FOUND_ERROR_CODE,
            status: '404',
            title: FILE_NOT_FOUND_ERROR_MESSAGE,
          },
        ],
      })
    }

    if (isApiRequest || responseFormat === 'json') {
      ctx.response.header('Content-Type', 'application/json; charset=utf-8')
      return ctx.response.status(404).json({
        errors: [
          {
            code: FILE_NOT_FOUND_ERROR_CODE,
            message: FILE_NOT_FOUND_ERROR_MESSAGE,
            status: 404,
          },
        ],
      })
    }

    ctx.response.header('Content-Type', 'text/plain; charset=utf-8')
    return ctx.response.status(404).send(FILE_NOT_FOUND_ERROR_MESSAGE)
  }

  private preparePublicErrorResponse(ctx: HttpContext, requestId: string | undefined): void {
    for (const header of Object.keys(ctx.response.getHeaders())) {
      ctx.response.removeHeader(header)
    }

    setPrivateResponseHeaders(ctx.response)
    // The sanitization above removes any header that may contain downstream
    // diagnostics. Restore the same browser protections configured by Shield
    // explicitly so even failures raised before/inside middleware stay safe.
    ctx.response.header('Strict-Transport-Security', `max-age=${HSTS_MAX_AGE_SECONDS}`)
    ctx.response.header('X-Frame-Options', 'DENY')
    ctx.response.header('X-Content-Type-Options', 'nosniff')
    if (requestId) {
      ctx.response.header('X-Request-Id', requestId)
    }
  }

  private reportSecondaryFailure(
    ctx: HttpContext,
    event: 'server_error_page_render_failed',
    error: unknown,
    message: string
  ): void {
    try {
      ctx.logger.error({ err: error, event, requestId: ctx.request.id() }, message)
    } catch {
      // A logger failure must not escape the final dependency-free response.
    }
  }

  /**
   * The method is used to report error to the logging service or
   * the a third party error monitoring service.
   *
   * @note You should not attempt to send a response from this method.
   */
  async report(error: unknown, ctx: HttpContext) {
    return super.report(error, ctx)
  }
}

function createPublicServerError(status: number): PublicServerError {
  return {
    code: INTERNAL_SERVER_ERROR_CODE,
    message: INTERNAL_SERVER_ERROR_MESSAGE,
    status,
  }
}

function isMissingLocalDriveFile(error: unknown): boolean {
  if (!(error instanceof driveErrors.CannotServeFileException)) {
    return false
  }

  const seen = new Set<object>()
  let cause: unknown = error

  while (cause && typeof cause === 'object' && 'cause' in cause && cause.cause !== undefined) {
    if (seen.has(cause)) {
      return false
    }
    seen.add(cause)
    cause = cause.cause
  }

  return Boolean(cause && typeof cause === 'object' && 'code' in cause && cause.code === 'ENOENT')
}

function isMalformedJsonError(
  error: unknown
): error is SyntaxError & { body: string; status: 400 } {
  return Boolean(
    error instanceof SyntaxError &&
    'status' in error &&
    error.status === 400 &&
    'body' in error &&
    typeof error.body === 'string'
  )
}
