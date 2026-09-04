import { test } from '@japa/runner'

import { evaluateEstablishmentCompleteness } from '#modules/establishments/services/establishment_completeness_evaluator'
import { feedbackTargetsFromOverview } from '#modules/portal/services/portal_overview_projection'

test.group('Portal overview pure projections', () => {
  test('keeps extracted completeness evaluation equivalent for a complete revision', ({
    assert,
  }) => {
    const context = {
      revision: {
        rules_version: 2,
        public_name: 'Aurora Centro',
        short_description: 'Café e confeitaria',
        description: null,
        city_id: 3,
        address: {
          street: 'Rua das Flores',
          district: 'Centro',
          number: '10',
          without_number: false,
          latitude: -23.1,
          longitude: -50.6,
        },
        categories: [{ is_primary: true, category_id: 7, category: { is_active: true } }],
        attribute_values: [
          {
            attribute_definition_id: 70,
            value_text: null,
            value_boolean: false,
            value_integer: null,
            value_decimal: null,
            value_url: null,
            selected_options: [],
          },
        ],
        availability_type: 'regular_hours',
        hours: [{}],
        public_email: 'contato@aurora.test',
        public_phone: null,
        whatsapp: null,
        website: null,
        instagram: null,
        booking_url: null,
        media: [{ id: 90, moderation_status: 'approved', is_cover: true }],
      },
      organization_active: true,
      city_active: true,
      effective_attributes: [
        {
          definition: { id: 70, key: 'acessivel', name: 'Acessível', is_required: true },
          source_category_id: 7,
          inherited: false,
        },
      ],
      allows_always_open: false,
      checked_at: '2026-09-04T00:00:00.000Z',
    } as unknown as Parameters<typeof evaluateEstablishmentCompleteness>[0]

    assert.deepEqual(evaluateEstablishmentCompleteness(context), {
      eligible: true,
      score: 100,
      blocking_issues: [],
      warnings: [],
      checked_at: '2026-09-04T00:00:00.000Z',
      rules_version: 2,
    })
  })

  test('derives feedback targets from the loaded overview without another read', ({ assert }) => {
    const targets = feedbackTargetsFromOverview({
      organizations: [
        {
          id: 10,
          trade_name: 'Rede Aurora',
          establishments: [
            { id: 21, public_name: 'Aurora Centro' },
            { id: 22, public_name: 'Unidade 22' },
          ],
        },
      ],
    })

    assert.deepEqual(targets, {
      organizations: [{ id: 10, label: 'Rede Aurora' }],
      establishments: [
        { id: 21, organization_id: 10, label: 'Aurora Centro' },
        { id: 22, organization_id: 10, label: 'Unidade 22' },
      ],
    })
  })
})
