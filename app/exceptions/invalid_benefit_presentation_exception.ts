import BadRequestException from '#exceptions/bad_request_exception'

export const INVALID_BENEFIT_PRESENTATION_MESSAGE =
  'Esta apresentação é inválida ou expirou. Peça ao cliente para gerar uma nova apresentação e tente novamente.'

export default class InvalidBenefitPresentationException extends BadRequestException {
  constructor() {
    super(INVALID_BENEFIT_PRESENTATION_MESSAGE)
  }
}
