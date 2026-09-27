import { test } from '@japa/runner'

import type EstablishmentRevision from '#modules/establishments/models/establishment_revision'
import { moderationSnapshot } from '#modules/establishments/services/revision_moderation_snapshot'

function revisionWith(instagram: string | null): EstablishmentRevision {
  return {
    public_name: 'Café Aurora',
    city: { name: 'Londrina' },
    short_description: 'Café e confeitaria',
    description: null,
    availability_type: 'regular_hours',
    public_phone: null,
    whatsapp: null,
    public_email: 'contato@aurora.test',
    website: null,
    instagram,
    booking_url: null,
    address: null,
    hours: [],
    categories: [],
    attribute_values: [],
    media: [],
  } as unknown as EstablishmentRevision
}

test.group('Revision moderation snapshot', () => {
  test('reads an Instagram handle the way the service stores it', ({ assert }) => {
    // The published page kept `@cafeaurora`; saving the step again stores `cafeaurora`.
    const published = moderationSnapshot(revisionWith('@cafeaurora'))
    const submitted = moderationSnapshot(revisionWith('cafeaurora'))

    assert.equal(published['contacts.instagram'], '@cafeaurora')
    assert.deepEqual(submitted, published)
    assert.equal(
      moderationSnapshot(revisionWith(' @Cafe.Aurora '))['contacts.instagram'],
      '@cafe.aurora'
    )
    assert.isNull(moderationSnapshot(revisionWith(' @ '))['contacts.instagram'])
    assert.isNull(moderationSnapshot(revisionWith(null))['contacts.instagram'])
  })

  test('still marks a different handle as a change', ({ assert }) => {
    assert.notEqual(
      moderationSnapshot(revisionWith('@cafeaurora'))['contacts.instagram'],
      moderationSnapshot(revisionWith('cafeaurora.centro'))['contacts.instagram']
    )
  })
})
