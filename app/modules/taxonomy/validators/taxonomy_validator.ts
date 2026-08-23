import vine from '@vinejs/vine'

import { CATEGORY_ATTRIBUTE_TYPES } from '#modules/taxonomy/interfaces/taxonomy_interface'

const familyFields = {
  name: vine.string().trim().minLength(2).maxLength(120),
  slug: vine.string().trim().minLength(2).maxLength(140).optional(),
  description: vine.string().trim().maxLength(2000).nullable().optional(),
  icon: vine.string().trim().maxLength(80).nullable().optional(),
  sort_order: vine.number().min(0).optional(),
  is_active: vine.boolean().optional(),
}

export const createCategoryFamilyValidator = vine.compile(vine.object(familyFields))

export const updateCategoryFamilyValidator = vine.compile(
  vine.object({
    name: familyFields.name.optional(),
    slug: familyFields.slug,
    description: familyFields.description,
    icon: familyFields.icon,
    sort_order: familyFields.sort_order,
    is_active: familyFields.is_active,
  })
)

const categoryFields = {
  family_id: vine.number().min(1),
  parent_id: vine.number().min(1).nullable().optional(),
  name: vine.string().trim().minLength(2).maxLength(120),
  slug: vine.string().trim().minLength(2).maxLength(140).optional(),
  description: vine.string().trim().maxLength(2000).nullable().optional(),
  icon: vine.string().trim().maxLength(80).nullable().optional(),
  sort_order: vine.number().min(0).optional(),
  is_active: vine.boolean().optional(),
}

export const createCategoryValidator = vine.compile(vine.object(categoryFields))

export const updateCategoryValidator = vine.compile(
  vine.object({
    family_id: categoryFields.family_id.optional(),
    parent_id: categoryFields.parent_id,
    name: categoryFields.name.optional(),
    slug: categoryFields.slug,
    description: categoryFields.description,
    icon: categoryFields.icon,
    sort_order: categoryFields.sort_order,
    is_active: categoryFields.is_active,
  })
)

export const listCategoryFamiliesValidator = vine.compile(
  vine.object({
    include_inactive: vine.boolean().optional(),
  })
)

export const listCategoriesValidator = vine.compile(
  vine.object({
    include_inactive: vine.boolean().optional(),
    family_id: vine.number().min(1).optional(),
    parent_id: vine.number().min(1).nullable().optional(),
  })
)

export const createAttributeDefinitionValidator = vine.compile(
  vine.object({
    category_id: vine.number().min(1),
    key: vine.string().trim().minLength(2).maxLength(80),
    name: vine.string().trim().minLength(2).maxLength(120),
    description: vine.string().trim().maxLength(2000).nullable().optional(),
    data_type: vine.enum(CATEGORY_ATTRIBUTE_TYPES),
    unit: vine.string().trim().maxLength(32).nullable().optional(),
    is_required: vine.boolean().optional(),
    is_filterable: vine.boolean().optional(),
    is_public: vine.boolean().optional(),
    applies_to_descendants: vine.boolean().optional(),
    sort_order: vine.number().min(0).optional(),
    is_active: vine.boolean().optional(),
  })
)

export const updateAttributeDefinitionValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(2).maxLength(120).optional(),
    description: vine.string().trim().maxLength(2000).nullable().optional(),
    unit: vine.string().trim().maxLength(32).nullable().optional(),
    is_required: vine.boolean().optional(),
    is_filterable: vine.boolean().optional(),
    is_public: vine.boolean().optional(),
    applies_to_descendants: vine.boolean().optional(),
    sort_order: vine.number().min(0).optional(),
    is_active: vine.boolean().optional(),
  })
)

export const listAttributeDefinitionsValidator = vine.compile(
  vine.object({
    include_inactive: vine.boolean().optional(),
    category_id: vine.number().min(1).optional(),
  })
)

export const createAttributeOptionValidator = vine.compile(
  vine.object({
    attribute_definition_id: vine.number().min(1),
    label: vine.string().trim().minLength(1).maxLength(120),
    value: vine.string().trim().minLength(1).maxLength(80).optional(),
    sort_order: vine.number().min(0).optional(),
    is_active: vine.boolean().optional(),
  })
)

export const updateAttributeOptionValidator = vine.compile(
  vine.object({
    label: vine.string().trim().minLength(1).maxLength(120).optional(),
    value: vine.string().trim().minLength(1).maxLength(80).optional(),
    sort_order: vine.number().min(0).optional(),
    is_active: vine.boolean().optional(),
  })
)

export const listAttributeOptionsValidator = vine.compile(
  vine.object({
    attribute_definition_id: vine.number().min(1),
    include_inactive: vine.boolean().optional(),
  })
)
