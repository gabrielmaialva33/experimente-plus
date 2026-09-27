import factory from '@adonisjs/lucid/factories'
import { DateTime } from 'luxon'

import {
  asciiSlug,
  brazilianPhone,
  businessName,
  LONDRINA,
  pointNear,
  shortDescription,
  street,
} from '#database/factories/support/pt_br'
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

/**
 * A draft revision with a pt-BR identity and every public contact channel
 * filled with reserved `example.test` values. The states walk the review
 * lifecycle; `appointmentOnly` and `alwaysOpen` switch the availability mode
 * (the latter only publishes under a category that allows it).
 */
export const EstablishmentRevisionFactory = factory
  .define(EstablishmentRevision, ({ faker }) => {
    const publicName = businessName(faker)
    const unique = faker.string.alphanumeric(7).toLowerCase()

    return {
      tenant_id: 1,
      establishment_id: 1,
      version: 1,
      status: 'draft' as const,
      city_id: null,
      public_name: publicName,
      slug: `${asciiSlug(publicName)}-${unique}`,
      short_description: shortDescription(faker),
      description: `${publicName} é um estabelecimento fictício criado para cenários de teste. ${shortDescription(faker)}`,
      public_phone: brazilianPhone(faker),
      whatsapp: brazilianPhone(faker, 'mobile'),
      public_email: `contato.${unique}@example.test`,
      website: `https://${unique}.example.test`,
      instagram: unique,
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
  .state('changesRequested', (revision) => {
    const reviewedAt = DateTime.utc()
    revision.status = 'changes_requested'
    revision.submitted_at ??= reviewedAt
    revision.reviewed_by = revision.created_by
    revision.reviewed_at = reviewedAt
    revision.review_notes = 'Inclua uma foto de capa e o horário de domingo.'
  })
  .state('appointmentOnly', (revision) => {
    revision.availability_type = 'appointment_only'
    revision.booking_url = `https://${asciiSlug(revision.public_name ?? 'agenda')}.example.test/agendar`
  })
  .state('alwaysOpen', (revision) => {
    revision.availability_type = 'always_open'
  })
  .build()

/**
 * An address in the central area of Londrina by default; merge
 * `pointNear(faker, city)` coordinates for another city. Streets are generic
 * and the number random, which is fine for test databases only — published
 * demo content uses "Endereço demonstrativo" instead.
 */
export const EstablishmentRevisionAddressFactory = factory
  .define(EstablishmentRevisionAddress, ({ faker }) => {
    const { latitude, longitude } = pointNear(faker, LONDRINA, 3)
    return {
      tenant_id: 1,
      revision_id: 1,
      postal_code: `860${faker.string.numeric(5)}`,
      street: street(faker),
      number: String(faker.number.int({ min: 10, max: 2400 })),
      without_number: false,
      complement: null,
      district: faker.helpers.arrayElement(LONDRINA.districts),
      reference: null,
      latitude,
      longitude,
      coordinate_source: 'manual' as const,
      geocoded_at: null,
    }
  })
  .state('demonstrative', (address) => {
    address.street = 'Endereço demonstrativo'
    address.postal_code = null
  })
  .build()

export const EstablishmentRevisionCategoryFactory = factory
  .define(EstablishmentRevisionCategory, () => ({
    tenant_id: 1,
    revision_id: 1,
    category_id: 1,
    is_primary: true,
    sort_order: 0,
  }))
  .state('secondary', (category) => {
    category.is_primary = false
    category.sort_order = 1
  })
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
  .state('lunch', (hour) => {
    hour.opens_at = '11:30'
    hour.closes_at = '15:00'
  })
  .state('evening', (hour) => {
    hour.opens_at = '18:30'
    hour.closes_at = '23:00'
  })
  .state('morning', (hour) => {
    hour.opens_at = '07:00'
    hour.closes_at = '12:00'
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
