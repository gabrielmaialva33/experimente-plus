import BadRequestException from '#exceptions/bad_request_exception'
import ForbiddenException from '#exceptions/forbidden_exception'
import InvalidBenefitPresentationException, {
  INVALID_BENEFIT_PRESENTATION_MESSAGE,
} from '#exceptions/invalid_benefit_presentation_exception'

/**
 * The benefit's own rules refused the presentation: already used up, outside its
 * days or hours, a paused offer or edition. The same words as the app's Validar tab,
 * which never promises that a new code gets around a rule.
 */
export const UNAVAILABLE_BENEFIT_PRESENTATION_MESSAGE =
  'Não foi possível validar esta apresentação. Peça ao cliente para consultar a carteira e gerar um novo código, se o benefício estiver disponível.'

export const FORBIDDEN_BENEFIT_VALIDATION_MESSAGE = 'Sua conta não pode validar este benefício.'

/**
 * What the partner's validation page says when a presentation is refused, or null
 * when the error is not a refusal and must keep propagating. Without this, the web
 * page answered the API's JSON in English, such as a link opened a second time.
 */
export function benefitValidationRefusalMessage(error: unknown): string | null {
  if (error instanceof InvalidBenefitPresentationException) {
    return INVALID_BENEFIT_PRESENTATION_MESSAGE
  }
  if (error instanceof ForbiddenException) {
    return FORBIDDEN_BENEFIT_VALIDATION_MESSAGE
  }
  if (error instanceof BadRequestException) {
    return UNAVAILABLE_BENEFIT_PRESENTATION_MESSAGE
  }
  return null
}
