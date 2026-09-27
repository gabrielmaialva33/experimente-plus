import { test } from '@japa/runner'

import BadRequestException from '#exceptions/bad_request_exception'
import ForbiddenException from '#exceptions/forbidden_exception'
import InvalidBenefitPresentationException, {
  INVALID_BENEFIT_PRESENTATION_MESSAGE,
} from '#exceptions/invalid_benefit_presentation_exception'
import NotFoundException from '#exceptions/not_found_exception'
import {
  benefitValidationRefusalMessage,
  FORBIDDEN_BENEFIT_VALIDATION_MESSAGE,
  UNAVAILABLE_BENEFIT_PRESENTATION_MESSAGE,
} from '#modules/benefits/utils/benefit_validation_refusal'

test.group('Benefit validation refusal', () => {
  test('explains an expired or invalid presentation as before', ({ assert }) => {
    assert.equal(
      benefitValidationRefusalMessage(new InvalidBenefitPresentationException()),
      INVALID_BENEFIT_PRESENTATION_MESSAGE
    )
  })

  test('turns a rule refusal into Portuguese without the API wording', ({ assert }) => {
    for (const rule of [
      'Benefit offer redemption limit has been reached',
      'Benefit offer is outside its daily usage window',
      'Benefit access is financially blocked',
    ]) {
      const message = benefitValidationRefusalMessage(new BadRequestException(rule))
      assert.equal(message, UNAVAILABLE_BENEFIT_PRESENTATION_MESSAGE)
      assert.notInclude(message!, rule)
    }
  })

  test('tells a partner without the validation role that the account cannot validate', ({
    assert,
  }) => {
    assert.equal(
      benefitValidationRefusalMessage(
        new ForbiddenException('This organization role cannot validate redemptions')
      ),
      FORBIDDEN_BENEFIT_VALIDATION_MESSAGE
    )
  })

  test('lets every other error keep propagating', ({ assert }) => {
    assert.isNull(benefitValidationRefusalMessage(new NotFoundException('Benefit not found')))
    assert.isNull(benefitValidationRefusalMessage(new Error('database unavailable')))
  })
})
