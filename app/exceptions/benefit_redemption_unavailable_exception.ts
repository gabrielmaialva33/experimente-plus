import BadRequestException from '#exceptions/bad_request_exception'

/**
 * Why an authentic presentation cannot be used right now:
 * - `already_used`: the access reached the offer's redemption limit;
 * - `paused`: the offer, its edition or the establishment is not taking uses;
 * - `blocked`: the holder's access is inactive or financially held;
 * - `outside_window`: the day, the time or the usage period does not allow it.
 */
export type BenefitRedemptionUnavailableReason =
  'already_used' | 'paused' | 'blocked' | 'outside_window'

/**
 * A domain refusal of a verified presentation. The status and the English
 * message are the API contract and stay as they were; the reason lets the
 * partner page explain the refusal without matching message text.
 */
export default class BenefitRedemptionUnavailableException extends BadRequestException {
  readonly reason: BenefitRedemptionUnavailableReason

  constructor(reason: BenefitRedemptionUnavailableReason, message: string) {
    super(message)
    this.reason = reason
  }
}
