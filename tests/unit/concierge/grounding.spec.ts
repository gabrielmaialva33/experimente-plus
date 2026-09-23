import { test } from '@japa/runner'

import IConcierge from '#modules/concierge/interfaces/concierge_interface'
import GroundingService from '#modules/concierge/services/grounding_service'

const place = (id: number, name: string): IConcierge.GroundingItem => ({
  ref: IConcierge.refOf('establishment', id),
  kind: 'establishment',
  name,
  city_slug: 'londrina',
  establishment_slug: `estabelecimento-${id}`,
  establishment_name: name,
  district: 'Centro',
  category: 'Gastronomia',
  starts_at: null,
  ends_at: null,
})

const happening = (id: number, name: string): IConcierge.GroundingItem => ({
  ref: IConcierge.refOf('event', id),
  kind: 'event',
  name,
  city_slug: 'londrina',
  establishment_slug: 'atelie-do-cafe',
  establishment_name: 'Ateliê do Café',
  district: 'Centro',
  category: 'Gastronomia',
  starts_at: '2026-09-25T21:00:00.000Z',
  ends_at: '2026-09-26T01:00:00.000Z',
})

const offered = [place(1, 'Ateliê do Café'), place(2, 'Casa de Petiscos')]
const service = () => new GroundingService()

test.group('Concierge grounding (ADR-0029)', () => {
  test('discards a citation for an item the model was never given', ({ assert }) => {
    const answer = service().validate(
      {
        intro: 'Boa tarde em Londrina.',
        steps: [
          { ref: 'establishment:1', why: 'café' },
          { ref: 'establishment:99', why: 'passeio' },
        ],
      },
      offered
    )

    assert.deepEqual(
      answer.steps.map((step) => step.item.ref),
      ['establishment:1']
    )
    assert.deepEqual(answer.discarded, ['establishment:99'])
    assert.isFalse(answer.empty)
  })

  test('reports emptiness when every citation was invented', ({ assert }) => {
    const answer = service().validate(
      {
        intro: 'Sugestão.',
        steps: [
          { ref: 'establishment:41', why: 'a' },
          { ref: 'establishment:42', why: 'b' },
        ],
      },
      offered
    )

    assert.isEmpty(answer.steps)
    assert.deepEqual(answer.discarded, ['establishment:41', 'establishment:42'])
    assert.isTrue(answer.empty, 'caller must degrade to the catalogue list')
  })

  test('does not accept one species in place of another with the same number', ({ assert }) => {
    // The reference stopped being a bare number for exactly this case. The three
    // species number their rows independently, so an answer citing event 7 used
    // to validate against establishment 7 and reach the consumer looking
    // verified while pointing at the wrong thing.
    const answer = service().validate(
      {
        intro: 'Programação da noite.',
        steps: [{ ref: IConcierge.refOf('event', 7), why: 'show' }],
      },
      [place(7, 'Casa de Petiscos')]
    )

    assert.isEmpty(answer.steps, 'establishment 7 is not event 7')
    assert.deepEqual(answer.discarded, ['event:7'])
    assert.isTrue(answer.empty)
  })

  test('forgives the spelling of a reference but never its species or number', ({ assert }) => {
    const answer = service().validate(
      {
        intro: '',
        steps: [
          { ref: '  Event:7 ', why: 'show' },
          { ref: 'EVENT:8', why: 'outro' },
        ],
      },
      [happening(7, 'Noite de jazz')]
    )

    assert.deepEqual(
      answer.steps.map((step) => step.item.name),
      ['Noite de jazz']
    )
    assert.deepEqual(answer.discarded, ['EVENT:8'])
  })

  test('removes prose that names a catalogue item deliberately withheld', ({ assert }) => {
    const answer = service().validate(
      {
        intro: 'Comece no Centro. Depois siga para a Padaria Primavera, em Bandeirantes.',
        steps: [{ ref: 'establishment:1', why: 'Ótimo café.' }],
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
        steps: [{ ref: 'establishment:2', why: 'bar' }],
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
          { ref: 'establishment:1', why: 'café' },
          { ref: 'establishment:1', why: 'de novo' },
        ],
      },
      offered
    )

    assert.lengthOf(answer.steps, 1)
    assert.isEmpty(answer.discarded)
  })

  test('parses the answer out of a fenced block, as models tend to emit', ({ assert }) => {
    const parsed = service().parse(
      '```json\n{"intro":"oi","steps":[{"ref":"establishment:2","why":"bar"}]}\n```'
    )

    assert.equal(parsed?.intro, 'oi')
    assert.deepEqual(parsed?.steps, [{ ref: 'establishment:2', why: 'bar' }])
  })

  test('returns null for content that is not an answer at all', ({ assert }) => {
    assert.isNull(service().parse('Here is a thinking process: first I consider...'))
  })

  test('ignores malformed steps instead of failing the whole answer', ({ assert }) => {
    const parsed = service().parse(
      '{"intro":"oi","steps":[{"ref":2},{"ref":"establishment:2","why":"bar"},null]}'
    )

    assert.deepEqual(parsed?.steps, [{ ref: 'establishment:2', why: 'bar' }])
  })
})
