import vine from '@vinejs/vine'

import {
  ESTABLISHMENT_AVAILABILITY_TYPES,
  ESTABLISHMENT_BUSINESS_STATUSES,
  ESTABLISHMENT_COORDINATE_SOURCES,
  ESTABLISHMENT_SPECIAL_DAY_STATUSES,
} from '#modules/establishments/interfaces/establishment_interface'

const nullableText = (maximum: number) =>
  vine.string().trim().maxLength(maximum).nullable().optional()

const revisionIdentityFields = {
  public_name: vine.string().trim().minLength(2).maxLength(160),
  city_id: vine.number().min(1).nullable().optional(),
  short_description: nullableText(280),
  description: nullableText(10_000),
  public_email: vine.string().email().trim().maxLength(254).nullable().optional(),
  public_phone: nullableText(32),
  whatsapp: nullableText(32),
  website: nullableText(2048),
  instagram: nullableText(80),
  booking_url: nullableText(2048),
  availability_type: vine.enum(ESTABLISHMENT_AVAILABILITY_TYPES).nullable().optional(),
}

export const createEstablishmentValidator = vine.compile(vine.object(revisionIdentityFields))

export const updateEstablishmentRevisionValidator = vine.compile(
  vine.object({
    public_name: revisionIdentityFields.public_name.optional(),
    city_id: revisionIdentityFields.city_id,
    short_description: revisionIdentityFields.short_description,
    description: revisionIdentityFields.description,
    public_email: revisionIdentityFields.public_email,
    public_phone: revisionIdentityFields.public_phone,
    whatsapp: revisionIdentityFields.whatsapp,
    website: revisionIdentityFields.website,
    instagram: revisionIdentityFields.instagram,
    booking_url: revisionIdentityFields.booking_url,
    availability_type: revisionIdentityFields.availability_type,
  })
)

export const replaceEstablishmentAddressValidator = vine.compile(
  vine.object({
    postal_code: nullableText(10),
    street: nullableText(160),
    number: nullableText(32),
    without_number: vine.boolean().optional(),
    complement: nullableText(160),
    district: nullableText(120),
    reference: nullableText(240),
    latitude: vine.number().min(-90).max(90).nullable().optional(),
    longitude: vine.number().min(-180).max(180).nullable().optional(),
    coordinate_source: vine.enum(ESTABLISHMENT_COORDINATE_SOURCES).nullable().optional(),
  })
)

export const replaceEstablishmentCategoriesValidator = vine.compile(
  vine.object({
    categories: vine
      .array(
        vine.object({
          category_id: vine.number().min(1),
          is_primary: vine.boolean().optional(),
          sort_order: vine.number().min(0).optional(),
        })
      )
      .maxLength(10),
  })
)

export const replaceEstablishmentAttributesValidator = vine.compile(
  vine.object({
    attributes: vine
      .array(
        vine.object({
          attribute_definition_id: vine.number().min(1),
          value: vine.any().optional(),
          option_ids: vine.array(vine.number().min(1)).maxLength(50).optional(),
        })
      )
      .maxLength(100),
  })
)

const hourIntervalFields = {
  opens_at: vine
    .string()
    .trim()
    .regex(/^\d{2}:\d{2}(?::\d{2})?$/),
  closes_at: vine
    .string()
    .trim()
    .regex(/^\d{2}:\d{2}(?::\d{2})?$/),
  spans_next_day: vine.boolean().optional(),
  sort_order: vine.number().min(0).optional(),
}

export const replaceEstablishmentHoursValidator = vine.compile(
  vine.object({
    hours: vine
      .array(
        vine.object({
          weekday: vine.number().min(0).max(6),
          ...hourIntervalFields,
        })
      )
      .maxLength(100),
  })
)

export const replaceEstablishmentSpecialDaysValidator = vine.compile(
  vine.object({
    special_days: vine
      .array(
        vine.object({
          date: vine
            .string()
            .trim()
            .regex(/^\d{4}-\d{2}-\d{2}$/),
          status: vine.enum(ESTABLISHMENT_SPECIAL_DAY_STATUSES),
          note: nullableText(240),
          intervals: vine.array(vine.object(hourIntervalFields)).maxLength(24).optional(),
        })
      )
      .maxLength(366),
  })
)

export const updateEstablishmentBusinessStatusValidator = vine.compile(
  vine.object({
    business_status: vine.enum(ESTABLISHMENT_BUSINESS_STATUSES),
  })
)
