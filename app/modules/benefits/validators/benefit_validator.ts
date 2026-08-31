import vine from '@vinejs/vine'

import { BENEFIT_TYPES } from '#modules/benefits/interfaces/benefit_interface'

const isoDate = () => vine.string().trim().minLength(10).maxLength(64)
const optionalNullableDate = () => isoDate().nullable().optional()
const optionalNullableText = (maximum: number) =>
  vine.string().trim().maxLength(maximum).nullable().optional()

export const createBenefitEditionValidator = vine.compile(
  vine.object({
    city_id: vine.number().min(1),
    name: vine.string().trim().minLength(2).maxLength(160),
    slug: vine.string().trim().minLength(2).maxLength(180).optional(),
    description: optionalNullableText(8000),
    price_cents: vine.number().min(0).optional(),
    currency: vine.string().trim().fixedLength(3).optional(),
    sales_starts_at: optionalNullableDate(),
    sales_ends_at: optionalNullableDate(),
    usage_starts_at: isoDate(),
    usage_ends_at: isoDate(),
  })
)

export const updateBenefitEditionValidator = vine.compile(
  vine.object({
    city_id: vine.number().min(1).optional(),
    name: vine.string().trim().minLength(2).maxLength(160).optional(),
    slug: vine.string().trim().minLength(2).maxLength(180).optional(),
    description: optionalNullableText(8000),
    price_cents: vine.number().min(0).optional(),
    currency: vine.string().trim().fixedLength(3).optional(),
    sales_starts_at: optionalNullableDate(),
    sales_ends_at: optionalNullableDate(),
    usage_starts_at: isoDate().optional(),
    usage_ends_at: isoDate().optional(),
  })
)

const offerFields = {
  title: vine.string().trim().minLength(2).maxLength(180),
  description: vine.string().trim().minLength(4).maxLength(12000),
  benefit_type: vine.enum(BENEFIT_TYPES),
  discount_percentage: vine.number().min(1).max(100).nullable().optional(),
  discount_amount_cents: vine.number().min(1).nullable().optional(),
  terms: optionalNullableText(12000),
  available_weekdays_mask: vine.number().min(1).max(127).optional(),
  daily_start_time: vine.string().trim().fixedLength(5).nullable().optional(),
  daily_end_time: vine.string().trim().fixedLength(5).nullable().optional(),
  starts_at: optionalNullableDate(),
  ends_at: optionalNullableDate(),
  reservation_required: vine.boolean().optional(),
  on_premise_only: vine.boolean().optional(),
  minimum_party_size: vine.number().min(1).max(100).optional(),
  max_redemptions_per_access: vine.number().min(1).max(100).optional(),
}

export const createBenefitOfferValidator = vine.compile(
  vine.object({
    edition_id: vine.number().min(1),
    ...offerFields,
  })
)

export const updateBenefitOfferValidator = vine.compile(
  vine.object({
    title: offerFields.title.optional(),
    description: offerFields.description.optional(),
    benefit_type: offerFields.benefit_type.optional(),
    discount_percentage: offerFields.discount_percentage,
    discount_amount_cents: offerFields.discount_amount_cents,
    terms: offerFields.terms,
    available_weekdays_mask: offerFields.available_weekdays_mask,
    daily_start_time: offerFields.daily_start_time,
    daily_end_time: offerFields.daily_end_time,
    starts_at: offerFields.starts_at,
    ends_at: offerFields.ends_at,
    reservation_required: offerFields.reservation_required,
    on_premise_only: offerFields.on_premise_only,
    minimum_party_size: offerFields.minimum_party_size,
    max_redemptions_per_access: offerFields.max_redemptions_per_access,
  })
)
