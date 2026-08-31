import factory from '@adonisjs/lucid/factories'
import { DateTime } from 'luxon'

import { ESTABLISHMENT_COMPLETENESS_RULES_VERSION } from '#modules/establishments/interfaces/establishment_interface'
import Establishment from '#modules/establishments/models/establishment'
import EstablishmentRevision from '#modules/establishments/models/establishment_revision'
import EstablishmentRevisionAddress from '#modules/establishments/models/establishment_revision_address'
import EstablishmentRevisionCategory from '#modules/establishments/models/establishment_revision_category'
import EstablishmentRevisionHour from '#modules/establishments/models/establishment_revision_hour'
import EstablishmentRevisionSpecialDay from '#modules/establishments/models/establishment_revision_special_day'

export const EstablishmentFactory = factory
  .define(Establishment, () => ({
    tenant_id: 1,
    organization_id: 1,
    lifecycle_status: 'active' as const,
    business_status: 'open' as const,
    published_revision_id: null,
    created_by: null,
    suspended_at: null,
    archived_at: null,
  }))
  .state('suspended', (establishment) => {
    establishment.lifecycle_status = 'suspended'
    establishment.suspended_at = DateTime.utc()
  })
  .state('archived', (establishment) => {
    establishment.lifecycle_status = 'archived'
    establishment.archived_at = DateTime.utc()
  })
  .state('temporarilyClosed', (establishment) => {
    establishment.business_status = 'temporarily_closed'
  })
  .state('permanentlyClosed', (establishment) => {
    establishment.business_status = 'permanently_closed'
  })
  .build()

export const EstablishmentRevisionFactory = factory
  .define(EstablishmentRevision, ({ faker }) => {
    const publicName = faker.company.name()
    const unique = faker.string.alphanumeric(7).toLowerCase()

    return {
      tenant_id: 1,
      establishment_id: 1,
      version: 1,
      status: 'draft' as const,
      city_id: null,
      public_name: publicName,
      slug: `${faker.helpers.slugify(publicName).toLowerCase()}-${unique}`,
      short_description: faker.company.catchPhrase(),
      description: faker.lorem.paragraphs(2),
      public_phone: `43${faker.string.numeric(8)}`,
      whatsapp: `439${faker.string.numeric(8)}`,
      public_email: faker.internet.email({ provider: 'example.test' }).toLowerCase(),
      website: `https://${unique}.example.test`,
      instagram: `@${unique}`,
      booking_url: null,
      availability_type: 'regular_hours' as const,
      based_on_revision_id: null,
      created_by: null,
      submitted_at: null,
      reviewed_by: null,
      reviewed_at: null,
      review_notes: null,
      rules_version: ESTABLISHMENT_COMPLETENESS_RULES_VERSION,
    }
  })
  .state('pendingReview', (revision) => {
    revision.status = 'pending_review'
    revision.submitted_at = DateTime.utc()
  })
  .state('approved', (revision) => {
    const reviewedAt = DateTime.utc()
    revision.status = 'approved'
    revision.submitted_at ??= reviewedAt
    revision.reviewed_by = revision.created_by
    revision.reviewed_at = reviewedAt
  })
  .state('rejected', (revision) => {
    const reviewedAt = DateTime.utc()
    revision.status = 'rejected'
    revision.submitted_at ??= reviewedAt
    revision.reviewed_by = revision.created_by
    revision.reviewed_at = reviewedAt
    revision.review_notes = 'Ajustes solicitados pelo cenário de teste.'
  })
  .build()

export const EstablishmentRevisionAddressFactory = factory
  .define(EstablishmentRevisionAddress, ({ faker }) => ({
    tenant_id: 1,
    revision_id: 1,
    postal_code: faker.string.numeric(8),
    street: faker.location.street(),
    number: faker.location.buildingNumber(),
    without_number: false,
    complement: null,
    district: faker.location.county(),
    reference: null,
    latitude: Number(faker.location.latitude({ min: -26.5, max: -22.5 })),
    longitude: Number(faker.location.longitude({ min: -54.5, max: -48.5 })),
    coordinate_source: 'manual' as const,
    geocoded_at: null,
  }))
  .build()

export const EstablishmentRevisionCategoryFactory = factory
  .define(EstablishmentRevisionCategory, () => ({
    tenant_id: 1,
    revision_id: 1,
    category_id: 1,
    is_primary: true,
    sort_order: 0,
  }))
  .build()

export const EstablishmentRevisionHourFactory = factory
  .define(EstablishmentRevisionHour, ({ faker }) => ({
    tenant_id: 1,
    revision_id: 1,
    weekday: faker.number.int({ min: 0, max: 6 }),
    opens_at: '09:00',
    closes_at: '18:00',
    spans_next_day: false,
    sort_order: 0,
  }))
  .state('overnight', (hour) => {
    hour.opens_at = '18:00'
    hour.closes_at = '02:00'
    hour.spans_next_day = true
  })
  .build()

export const EstablishmentRevisionSpecialDayFactory = factory
  .define(EstablishmentRevisionSpecialDay, () => ({
    tenant_id: 1,
    revision_id: 1,
    date: DateTime.utc().plus({ days: 30 }).toISODate()!,
    status: 'closed' as const,
    note: 'Fechado excepcionalmente.',
  }))
  .state('customHours', (specialDay) => {
    specialDay.status = 'custom_hours'
    specialDay.note = 'Funcionamento em horário especial.'
  })
  .build()
