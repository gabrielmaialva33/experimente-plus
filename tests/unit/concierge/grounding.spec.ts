import { test } from '@japa/runner'

import type IConcierge from '#modules/concierge/interfaces/concierge_interface'
import GroundingService from '#modules/concierge/services/grounding_service'

const item = (id: number, name: string, city = 'Londrina'): IConcierge.GroundingItem => ({
  id,
  kind: 'establishment',
  name,
  city,
  district: 'Centro',
  category: 'Gastronomia',
  opens_at: '08:00',
  closes_at: '18:00',
})

const offered = [item(1, 'Ateliê do Café'), item(2, 'Casa de Petiscos')]
const service = () => new GroundingService()

test.group('Concierge grounding (ADR-0029)', () => {
  test('discards a citation for an item the model was never given', ({ assert }) => {
    const answer = service().validate(
      {
        intro: 'Boa tarde em Londrina.',
        steps: [
          { id: 1, why: 'café' },
          { id: 99, why: 'passeio' },
        ],
      },
      offered
    )

    assert.deepEqual(
      answer.steps.map((step) => step.item.id),
      [1]
    )
    assert.deepEqual(answer.discarded, [99])
    assert.isFalse(answer.empty)
  })

  test('reports emptiness when every citation was invented', ({ assert }) => {
    const answer = service().validate(
      {
        intro: 'Sugestão.',
        steps: [
          { id: 41, why: 'a' },
          { id: 42, why: 'b' },
        ],
      },
      offered
    )

    assert.isEmpty(answer.steps)
    assert.deepEqual(answer.discarded, [41, 42])
    assert.isTrue(answer.empty, 'caller must degrade to the catalogue list')
  })

  test('removes prose that names a catalogue item deliberately withheld', ({ assert }) => {
    const answer = service().validate(
      {
        intro: 'Comece no Centro. Depois siga para a Padaria Primavera, em Bandeirantes.',
        steps: [{ id: 1, why: 'Ótimo café.' }],
      },
      offered,
      ['Padaria Primavera']
    )

    assert.notInclude(answer.intro, 'Padaria Primavera')
    assert.include(answer.intro, 'Comece no Centro.')
  })

  test('keeps ordinary prose untouched, including capitalised words', ({ assert }) => {
    // An earlier heuristic flagged "Você" and "Depois" as invented places; the
    // check must not resurrect that behaviour.
    const answer = service().validate(
      {
        intro: 'Você pode começar cedo. Depois, aproveite a tarde.',
        steps: [{ id: 2, why: 'bar' }],
      },
      offered
    )

    assert.include(answer.intro, 'Você')
    assert.include(answer.intro, 'Depois')
    assert.lengthOf(answer.steps, 1)
  })

  test('collapses a repeated citation into a single step', ({ assert }) => {
    const answer = service().validate(
      {
        intro: '',
        steps: [
          { id: 1, why: 'café' },
          { id: 1, why: 'de novo' },
        ],
      },
      offered
    )

    assert.lengthOf(answer.steps, 1)
    assert.isEmpty(answer.discarded)
  })

  test('parses the answer out of a fenced block, as models tend to emit', ({ assert }) => {
    const parsed = service().parse('```json\n{"intro":"oi","steps":[{"id":2,"why":"bar"}]}\n```')

    assert.equal(parsed?.intro, 'oi')
    assert.deepEqual(parsed?.steps, [{ id: 2, why: 'bar' }])
  })

  test('returns null for content that is not an answer at all', ({ assert }) => {
    assert.isNull(service().parse('Here is a thinking process: first I consider...'))
  })

  test('ignores malformed steps instead of failing the whole answer', ({ assert }) => {
    const parsed = service().parse('{"intro":"oi","steps":[{"id":"x"},{"id":2,"why":"bar"},null]}')

    assert.deepEqual(parsed?.steps, [{ id: 2, why: 'bar' }])
  })
})
