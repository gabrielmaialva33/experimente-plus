import vine from '@vinejs/vine'

const regionFields = {
  name: vine.string().trim().minLength(2).maxLength(120),
  slug: vine.string().trim().minLength(2).maxLength(140).optional(),
  description: vine.string().trim().maxLength(2000).nullable().optional(),
  sort_order: vine.number().min(0).optional(),
  is_active: vine.boolean().optional(),
}

export const createRegionValidator = vine.compile(vine.object(regionFields))

export const updateRegionValidator = vine.compile(
  vine.object({
    name: regionFields.name.optional(),
    slug: regionFields.slug,
    description: regionFields.description,
    sort_order: regionFields.sort_order,
    is_active: regionFields.is_active,
  })
)

const cityFields = {
  region_id: vine.number().min(1),
  name: vine.string().trim().minLength(2).maxLength(120),
  slug: vine.string().trim().minLength(2).maxLength(140).optional(),
  state_code: vine.string().trim().fixedLength(2),
  country_code: vine.string().trim().fixedLength(2).optional(),
  ibge_code: vine
    .string()
    .trim()
    .regex(/^\d{7}$/)
    .nullable()
    .optional(),
  timezone: vine.string().trim().minLength(3).maxLength(64).optional(),
  latitude: vine.number().min(-90).max(90).nullable().optional(),
  longitude: vine.number().min(-180).max(180).nullable().optional(),
  sort_order: vine.number().min(0).optional(),
  is_active: vine.boolean().optional(),
}

export const createCityValidator = vine.compile(vine.object(cityFields))

export const updateCityValidator = vine.compile(
  vine.object({
    region_id: cityFields.region_id.optional(),
    name: cityFields.name.optional(),
    slug: cityFields.slug,
    state_code: cityFields.state_code.optional(),
    country_code: cityFields.country_code,
    ibge_code: cityFields.ibge_code,
    timezone: cityFields.timezone,
    latitude: cityFields.latitude,
    longitude: cityFields.longitude,
    sort_order: cityFields.sort_order,
    is_active: cityFields.is_active,
  })
)

export const listRegionsValidator = vine.compile(
  vine.object({
    include_inactive: vine.boolean().optional(),
  })
)

export const listCitiesValidator = vine.compile(
  vine.object({
    include_inactive: vine.boolean().optional(),
    region_id: vine.number().min(1).optional(),
  })
)
