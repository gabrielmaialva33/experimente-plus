import BadRequestException from '#exceptions/bad_request_exception'

/**
 * A signed-in account with no active operation reached a route that needs one.
 * The API answers with this message; a browser gets the `errors/no_operation`
 * page instead (see the exception handler).
 */
export default class ActiveTenantRequiredException extends BadRequestException {
  constructor(message = 'An active tenant is required for this operation') {
    super(message)
  }
}
