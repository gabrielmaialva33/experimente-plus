import BaseException from '#exceptions/base_exception'

export class PurchaseConflictException extends BaseException {
  static status = 409
}
export class PaymentUnavailableException extends BaseException {
  static status = 503
}
