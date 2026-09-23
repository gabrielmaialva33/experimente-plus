import BaseException from '#exceptions/base_exception'

/**
 * The same person reporting the same content twice.
 *
 * A conflict with an existing state, not a malformed request: the report is
 * already on record, and the reporter should be told that rather than that
 * something was wrong with what they sent.
 */
export class DuplicateReportException extends BaseException {
  static status = 409
}
