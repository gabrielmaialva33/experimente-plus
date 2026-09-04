import app from '@adonisjs/core/services/app'
import { ExceptionHandler, type HttpContext } from '@adonisjs/core/http'
import type { StatusPageRange, StatusPageRenderer } from '@adonisjs/core/types/http'

import { setPrivateResponseHeaders } from '#shared/utils/private_response_headers'

const MALFORMED_JSON_MESSAGE = 'Malformed JSON request body'
const UNAUTHORIZED_ACCESS_MESSAGE = 'Unauthorized access'

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
    '500..599': (error, { inertia }) => inertia.render('errors/server_error', { error }),
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

    if (isApiRequest && isMalformedJsonError(error)) {
      return ctx.response.status(400).json({
        status: 400,
        message: MALFORMED_JSON_MESSAGE,
      })
    }

    /**
     * Handle validation errors from VineJS
     */
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'E_VALIDATION_ERROR'
    ) {
      const validationError = error as any
      const acceptsJson = ctx.request.accepts(['html', 'json']) === 'json'

      if (isApiRequest || acceptsJson) {
        return ctx.response.status(422).json({
          errors: validationError.messages || [],
        })
      }

      return super.handle(error, ctx)
    }

    /**
     * Handle rate limiting errors
     */
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'E_TOO_MANY_REQUESTS'
    ) {
      const rateLimitError = error as any

      // Set rate limit headers from the response object
      if (rateLimitError.response) {
        ctx.response.header('x-ratelimit-limit', rateLimitError.response.limit)
        ctx.response.header('x-ratelimit-remaining', rateLimitError.response.remaining)
        ctx.response.header('retry-after', rateLimitError.response.availableIn)
      }

      return ctx.response.status(429).json({
        errors: [
          {
            code: 'E_TOO_MANY_REQUESTS',
            message: rateLimitError.message || 'Too many requests',
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
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'E_UNAUTHORIZED_ACCESS'
    ) {
      if (isApiRequest) {
        return ctx.response.status(401).json({
          errors: [{ message: UNAUTHORIZED_ACCESS_MESSAGE }],
        })
      }

      const acceptsJson = ctx.request.accepts(['html', 'json']) === 'json'

      if (!acceptsJson) {
        const authError = error as any
        ctx.session.flash('error', authError.message || 'Faça login para continuar.')
        return ctx.response.redirect().toPath('/login')
      }
    }

    return super.handle(error, ctx)
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
