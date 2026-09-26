import { test } from '@japa/runner'

import ConciergeProviderFactory from '#modules/concierge/services/concierge_provider_factory'
import ConciergeService from '#modules/concierge/services/concierge_service'
import GroundingService from '#modules/concierge/services/grounding_service'

const service = () => new ConciergeService(new GroundingService(), new ConciergeProviderFactory())

/**
 * The contracted scope states this module is not a professional, legal,
 * medical, financial or emergency service. That limit is enforced here, before
 * any provider is called, so it holds regardless of which model is configured.
 */
test.group('Concierge subject boundary (ADR-0029)', () => {
  const refused = [
    'preciso de um advogado para um processo trabalhista',
    'estou com sintomas de dengue, qual remédio tomo?',
    'qual o melhor investimento para meu dinheiro?',
    'como consigo um empréstimo rápido?',
    'é uma emergência, preciso de ambulância',
    'quero chamar a polícia',
  ]

  for (const question of refused) {
    test(`refuses out of scope: "${question.slice(0, 34)}..."`, ({ assert }) => {
      assert.isTrue(service().isOutOfScope(question))
    })
  }

  const allowed = [
    'quero um roteiro de tarde em Londrina',
    'onde tomar um bom café no centro?',
    'tem algum bar aberto agora?',
    'me sugere um lugar para levar a família',
    'quais experiências tem em Bandeirantes?',
  ]

  for (const question of allowed) {
    test(`allows discovery: "${question.slice(0, 34)}..."`, ({ assert }) => {
      assert.isFalse(service().isOutOfScope(question))
    })
  }

  test('refuses before calling any provider, so a refusal costs nothing', async ({ assert }) => {
    const reply = await service().answer('preciso de um médico urgente', [])

    assert.equal(reply.outcome, 'refused')
    assert.isNull(reply.model, 'no model may be consulted for a refused subject')
    assert.isEmpty(reply.items)
    assert.include(reply.text ?? '', 'Experimente+')
  })

  test('degrades to the catalogue when there is nothing to ground on', async ({ assert }) => {
    const reply = await service().answer('quero um café', [])

    assert.equal(reply.outcome, 'degraded')
    assert.isNull(reply.text, 'a degraded reply carries the catalogue, not prose')
    assert.isNull(reply.model)
  })
})
