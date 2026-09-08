import BaseException from '#exceptions/base_exception'

export class PurchaseConflictException extends BaseException {
  static status = 409
}
export class PaymentUnavailableException extends BaseException {
  static status = 503
}

/** Operator intervention is required; this is not transient provider unavailability. */
export class PaymentConfigurationException extends PaymentUnavailableException {
  static status = 500
}
export class InvalidPaymentWebhookException extends BaseException {
  static status = 400
}
