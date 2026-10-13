import { test } from '@japa/runner'

import IConcierge from '#modules/concierge/interfaces/concierge_interface'
import ConciergeProviderFactory from '#modules/concierge/services/concierge_provider_factory'
import ConciergeService from '#modules/concierge/services/concierge_service'
import GroundingService from '#modules/concierge/services/grounding_service'

const DEMO_NAME = 'Ateliê do Café — demonstração'

const demoPlace: IConcierge.GroundingItem = {
  ref: IConcierge.refOf('establishment', 1),
  kind: 'establishment',
  name: DEMO_NAME,
  city_slug: 'londrina',
  establishment_slug: 'atelier-do-cafe-demo',
  establishment_name: DEMO_NAME,
  district: 'Centro',
  category: 'Gastronomia demonstrativa',
  starts_at: null,
  ends_at: null,
}

/** Keeps the prompt it was sent and cites the first item it was offered. */
class CapturingFactory extends ConciergeProviderFactory {
  requests: IConcierge.ProviderRequest[] = []

  make(): IConcierge.Provider {
    return {
      name: 'capturing',
      complete: async (request) => {
        this.requests.push(request)
        const ref = /^- (\w+:\d+) /m.exec(request.user)?.[1]
        return {
          model: request.model,
          content: JSON.stringify({ intro: 'Sugestão', steps: [{ ref, why: 'Bom café' }] }),
        }
      },
    }
  }

  models() {
    return ['capturing-model']
  }
}

test.group('Concierge prompt', () => {
  test('tells the model the demonstration suffix is not a trait of the place', async ({
    assert,
  }) => {
    const factory = new CapturingFactory()
    const reply = await new ConciergeService(new GroundingService(), factory).answer(
      'onde tomar um café?',
      [demoPlace]
    )

    assert.lengthOf(factory.requests, 1)
    const [request] = factory.requests
    assert.include(request.system, 'O sufixo " — demonstração" nos nomes')
    assert.include(request.system, 'não são característica do lugar')
    assert.include(request.system, 'nunca os mencione')

    // The safety framing stays in the same prompt.
    assert.include(request.system, 'Use EXCLUSIVAMENTE os itens da lista fornecida.')
    assert.include(request.system, 'Não faça reservas, compras nem confirmações.')

    // The name is explained, never stripped: grounding matches the catalogue.
    assert.include(request.user, `establishment:1 (lugar): ${DEMO_NAME}`)
    assert.equal(reply.outcome, 'grounded')
    assert.deepEqual(
      reply.items.map((item) => item.name),
      [DEMO_NAME]
    )
  })
})
