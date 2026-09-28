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
import { relationParent } from '#database/factories/support/relations'
import { ESTABLISHMENT_COMPLETENESS_RULES_VERSION } from '#modules/establishments/interfaces/establishment_interface'
import Establishment from '#modules/establishments/models/establishment'
import EstablishmentRevision from '#modules/establishments/models/establishment_revision'
import EstablishmentRevisionAddress from '#modules/establishments/models/establishment_revision_address'
import EstablishmentRevisionAttributeValue from '#modules/establishments/models/establishment_revision_attribute_value'
import EstablishmentRevisionAttributeValueOption from '#modules/establishments/models/establishment_revision_attribute_value_option'
import EstablishmentRevisionCategory from '#modules/establishments/models/establishment_revision_category'
import EstablishmentRevisionEvent from '#modules/establishments/models/establishment_revision_event'
import EstablishmentRevisionHour from '#modules/establishments/models/establishment_revision_hour'
import EstablishmentRevisionReviewIssue from '#modules/establishments/models/establishment_revision_review_issue'
import EstablishmentRevisionSpecialDay from '#modules/establishments/models/establishment_revision_special_day'
import EstablishmentRevisionSpecialHour from '#modules/establishments/models/establishment_revision_special_hour'

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

/**
 * One interval of a special day, late morning to early afternoon by default.
 * Created through `EstablishmentRevisionSpecialDayFactory.with('intervals')`
 * it takes the day's tenant and revision, as the composite key requires;
 * intervals of one day must differ, so apply `evening` (or merge the times)
 * for a second one.
 */
export const EstablishmentRevisionSpecialHourFactory = factory
  .define(EstablishmentRevisionSpecialHour, () => ({
    tenant_id: 1,
    special_day_id: 1,
    revision_id: 1,
    opens_at: '10:00',
    closes_at: '14:00',
    spans_next_day: false,
    sort_order: 0,
  }))
  .state('evening', (hour) => {
    hour.opens_at = '18:00'
    hour.closes_at = '23:00'
    hour.sort_order = 1
  })
  .state('overnight', (hour) => {
    hour.opens_at = '20:00'
    hour.closes_at = '02:00'
    hour.spans_next_day = true
  })
  .before('create', (builder, hour) => {
    const day = relationParent(builder)
    if (day instanceof EstablishmentRevisionSpecialDay) {
      hour.tenant_id = day.tenant_id
      hour.revision_id = day.revision_id
    }
  })
  .build()

/** A closed day a month ahead; `customHours` plus `with('intervals')` opens it in a special schedule. */
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
  .relation('intervals', () => EstablishmentRevisionSpecialHourFactory)
  .build()

/**
 * A choice of a select attribute. Created through
 * `EstablishmentRevisionAttributeValueFactory.with('selected_options')` it
 * takes the value's tenant and definition; merge the `attribute_option_id`,
 * which must be an option of that same definition.
 */
export const EstablishmentRevisionAttributeValueOptionFactory = factory
  .define(EstablishmentRevisionAttributeValueOption, () => ({
    tenant_id: 1,
    attribute_value_id: 1,
    attribute_definition_id: 1,
    attribute_option_id: 1,
  }))
  .before('create', (builder, selection) => {
    const value = relationParent(builder)
    if (value instanceof EstablishmentRevisionAttributeValue) {
      selection.tenant_id = value.tenant_id
      selection.attribute_definition_id = value.attribute_definition_id
    }
  })
  .build()

type AttributeScalar =
  'value_text' | 'value_boolean' | 'value_integer' | 'value_decimal' | 'value_url'

/** Every scalar column empty but the given one, as the single-scalar check requires. */
function scalar(values: Partial<Pick<EstablishmentRevisionAttributeValue, AttributeScalar>>) {
  return {
    value_text: null,
    value_boolean: null,
    value_integer: null,
    value_decimal: null,
    value_url: null,
    ...values,
  }
}

/**
 * The value of one category attribute in a revision: a boolean `true` by
 * default, which fits `CategoryAttributeDefinitionFactory`'s default. The
 * table holds at most one scalar, so each state keeps exactly the column its
 * data type uses; `selection` keeps none, because a select attribute stores
 * its choices as `selected_options`.
 */
export const EstablishmentRevisionAttributeValueFactory = factory
  .define(EstablishmentRevisionAttributeValue, () => ({
    tenant_id: 1,
    revision_id: 1,
    attribute_definition_id: 1,
    ...scalar({ value_boolean: true }),
  }))
  .state('text', (value) => {
    value.merge(scalar({ value_text: 'Aceitamos pets de pequeno porte na área externa.' }))
  })
  .state('integer', (value, { faker }) => {
    value.merge(scalar({ value_integer: faker.number.int({ min: 20, max: 120 }) }))
  })
  .state('decimal', (value, { faker }) => {
    value.merge(
      scalar({ value_decimal: faker.number.float({ min: 1, max: 15, fractionDigits: 1 }) })
    )
  })
  .state('url', (value) => {
    value.merge(scalar({ value_url: 'https://cardapio.example.test/' }))
  })
  .state('selection', (value) => {
    value.merge(scalar({}))
  })
  .relation('selected_options', () => EstablishmentRevisionAttributeValueOptionFactory)
  .build()

/**
 * An entry of a revision's append-only history, recorded as a person acted
 * on it: `created` (no status to draft) by default, and one state per
 * transition the services write. The table never updates or deletes these
 * rows, so they are created, never saved again. `actor_id` is the person who
 * acted; the reason is mandatory where the moderator returns or rejects.
 */
export const EstablishmentRevisionEventFactory = factory
  .define(EstablishmentRevisionEvent, () => ({
    tenant_id: 1,
    establishment_id: 1,
    revision_id: 1,
    event_type: 'created' as const,
    from_status: null,
    to_status: 'draft' as const,
    actor_id: 1,
    reason: null,
    metadata: { rules_version: ESTABLISHMENT_COMPLETENESS_RULES_VERSION },
  }))
  .state('submitted', (event) => {
    event.event_type = 'submitted'
    event.from_status = 'draft'
    event.to_status = 'pending_review'
    event.metadata = {
      score: 100,
      rules_version: ESTABLISHMENT_COMPLETENESS_RULES_VERSION,
      blocking_issue_codes: [],
      warning_codes: [],
    }
  })
  .state('changesRequested', (event) => {
    event.event_type = 'changes_requested'
    event.from_status = 'pending_review'
    event.to_status = 'changes_requested'
    event.reason = 'Inclua uma foto de capa e o horário de domingo.'
    event.metadata = { issue_codes: ['cover_image_missing'], blocking_issue_count: 1 }
  })
  .state('resubmitted', (event) => {
    event.event_type = 'resubmitted'
    event.from_status = 'changes_requested'
    event.to_status = 'pending_review'
  })
  .state('rejected', (event) => {
    event.event_type = 'rejected'
    event.from_status = 'pending_review'
    event.to_status = 'rejected'
    event.reason = 'O cadastro descreve um estabelecimento fora da área de atuação.'
  })
  .state('approved', (event) => {
    event.event_type = 'approved'
    event.from_status = 'pending_review'
    event.to_status = 'approved'
    event.metadata = { rules_version: ESTABLISHMENT_COMPLETENESS_RULES_VERSION, score: 100 }
  })
  .state('published', (event) => {
    event.event_type = 'published'
    event.from_status = 'approved'
    event.to_status = 'approved'
    event.metadata = { published_revision_id: event.revision_id }
  })
  .build()

/**
 * An open, blocking issue a moderator attached to a revision under review.
 * Only one issue per code and field stays open on a revision, so merge a
 * different `code`/`field` (or apply `warning`) for a second one; `resolved`
 * closes it, by its author unless `resolved_by` is merged.
 */
export const EstablishmentRevisionReviewIssueFactory = factory
  .define(EstablishmentRevisionReviewIssue, () => ({
    tenant_id: 1,
    establishment_id: 1,
    revision_id: 1,
    code: 'cover_image_missing',
    field: 'media.cover',
    message: 'Inclua uma foto de capa nítida da fachada ou do ambiente.',
    severity: 'blocking' as const,
    created_by: 1,
    resolved_by: null,
    resolved_at: null,
  }))
  .state('warning', (issue) => {
    issue.code = 'sunday_hours_unconfirmed'
    issue.field = 'hours'
    issue.message = 'Confirme se a unidade abre aos domingos.'
    issue.severity = 'warning'
  })
  .state('resolved', (issue) => {
    issue.resolved_by ??= issue.created_by
    issue.resolved_at = DateTime.utc()
  })
  .build()
