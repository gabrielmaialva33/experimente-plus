export const CATEGORY_ATTRIBUTE_TYPES = [
  'text',
  'long_text',
  'boolean',
  'integer',
  'decimal',
  'single_select',
  'multi_select',
  'url',
] as const

export type CategoryAttributeType = (typeof CATEGORY_ATTRIBUTE_TYPES)[number]

namespace ITaxonomy {
  export interface FamilyPayload {
    name: string
    slug?: string
    description?: string | null
    icon?: string | null
    sort_order?: number
    is_active?: boolean
  }

  export interface FamilyUpdatePayload {
    name?: string
    slug?: string
    description?: string | null
    icon?: string | null
    sort_order?: number
    is_active?: boolean
  }

  export interface CategoryPayload {
    family_id: number
    parent_id?: number | null
    name: string
    slug?: string
    description?: string | null
    icon?: string | null
    sort_order?: number
    is_active?: boolean
    allows_always_open?: boolean
  }

  export interface CategoryUpdatePayload {
    family_id?: number
    parent_id?: number | null
    name?: string
    slug?: string
    description?: string | null
    icon?: string | null
    sort_order?: number
    is_active?: boolean
    allows_always_open?: boolean
  }

  export interface AttributeDefinitionPayload {
    category_id: number
    key: string
    name: string
    description?: string | null
    data_type: CategoryAttributeType
    unit?: string | null
    is_required?: boolean
    is_filterable?: boolean
    is_public?: boolean
    applies_to_descendants?: boolean
    sort_order?: number
    is_active?: boolean
  }

  export interface AttributeDefinitionUpdatePayload {
    name?: string
    description?: string | null
    unit?: string | null
    is_required?: boolean
    is_filterable?: boolean
    is_public?: boolean
    applies_to_descendants?: boolean
    sort_order?: number
    is_active?: boolean
  }

  export interface AttributeOptionPayload {
    attribute_definition_id: number
    label: string
    value?: string
    sort_order?: number
    is_active?: boolean
  }

  export interface AttributeOptionUpdatePayload {
    label?: string
    value?: string
    sort_order?: number
    is_active?: boolean
  }
}

export default ITaxonomy
