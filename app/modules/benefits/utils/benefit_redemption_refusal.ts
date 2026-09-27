import { errors } from '@vinejs/vine'

import BenefitRedemptionUnavailableException, {
  type BenefitRedemptionUnavailableReason,
} from '#exceptions/benefit_redemption_unavailable_exception'
import ForbiddenException from '#exceptions/forbidden_exception'
import InvalidBenefitPresentationException, {
  INVALID_BENEFIT_PRESENTATION_MESSAGE,
} from '#exceptions/invalid_benefit_presentation_exception'
import NotFoundException from '#exceptions/not_found_exception'

/**
 * Why the partner page refuses a presentation. `invalid` covers an expired,
 * tampered or malformed code; `foreign` a benefit this account does not answer
 * for (another organization, another operation, or one no longer available);
 * `not_allowed` a member whose role reads but does not validate.
 */
export type BenefitRedemptionRefusalReason =
  'invalid' | 'foreign' | 'not_allowed' | BenefitRedemptionUnavailableReason

export interface BenefitRedemptionRefusal {
  reason: BenefitRedemptionRefusalReason
  title: string
  message: string
}

/**
 * Partner-facing copy. It never repeats the token, and it does not reveal more
 * about the holder than the preview would: a financial hold reads as blocked.
 */
export const BENEFIT_REDEMPTION_REFUSALS: Record<
  BenefitRedemptionRefusalReason,
  Omit<BenefitRedemptionRefusal, 'reason'>
> = {
  invalid: {
    title: 'QR code expirado ou inválido',
    message: INVALID_BENEFIT_PRESENTATION_MESSAGE,
  },
  foreign: {
    title: 'Benefício de outro estabelecimento',
    message:
      'Este benefício é de um estabelecimento que sua conta não administra, ou não está mais disponível, e por isso não pode ser validado aqui. Confira com o cliente em qual lugar ele vale.',
  },
  not_allowed: {
    title: 'Sua conta não pode validar',
    message:
      'Seu papel nesta organização permite consultar utilizações, mas não confirmá-las. Peça a um administrador da organização para validar.',
  },
  already_used: {
    title: 'Benefício já utilizado',
    message:
      'Este cliente já usou este benefício o máximo de vezes permitido. Peça para ele conferir a carteira no app.',
  },
  paused: {
    title: 'Benefício pausado',
    message:
      'A oferta, a edição ou o estabelecimento não está recebendo utilizações agora. Confira a oferta no portal antes de tentar de novo.',
  },
  blocked: {
    title: 'Benefício bloqueado',
    message:
      'O acesso deste cliente está bloqueado no momento e o benefício não pode ser usado. Peça para ele conferir a carteira no app.',
  },
  outside_window: {
    title: 'Fora do período de uso',
    message: 'Este benefício não vale neste dia ou horário. Confira as regras com o cliente.',
  },
}

export function benefitRedemptionRefusal(
  reason: BenefitRedemptionRefusalReason
): BenefitRedemptionRefusal {
  return { reason, ...BENEFIT_REDEMPTION_REFUSALS[reason] }
}

/**
 * Maps what preview and confirmation throw for a presentation to the refusal
 * the partner sees, with the HTTP status the refusal keeps. Anything else is
 * not a refusal of the presentation and stays an error.
 */
export function classifyBenefitRedemptionFailure(
  error: unknown
): { status: number; refusal: BenefitRedemptionRefusal } | null {
  if (error instanceof InvalidBenefitPresentationException) {
    return { status: 400, refusal: benefitRedemptionRefusal('invalid') }
  }
  if (error instanceof errors.E_VALIDATION_ERROR) {
    return { status: 422, refusal: benefitRedemptionRefusal('invalid') }
  }
  if (error instanceof BenefitRedemptionUnavailableException) {
    return { status: 400, refusal: benefitRedemptionRefusal(error.reason) }
  }
  if (error instanceof ForbiddenException) {
    return { status: 403, refusal: benefitRedemptionRefusal('not_allowed') }
  }
  if (error instanceof NotFoundException) {
    return { status: 404, refusal: benefitRedemptionRefusal('foreign') }
  }
  return null
}
