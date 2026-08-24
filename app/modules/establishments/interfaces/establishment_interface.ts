export const ESTABLISHMENT_LIFECYCLE_STATUSES = ['active', 'suspended', 'archived'] as const
export const ESTABLISHMENT_BUSINESS_STATUSES = [
  'open',
  'temporarily_closed',
  'permanently_closed',
] as const
export const ESTABLISHMENT_REVISION_STATUSES = [
  'draft',
  'pending_review',
  'changes_requested',
  'approved',
  'rejected',
] as const
export const ESTABLISHMENT_EDITABLE_REVISION_STATUSES = ['draft', 'changes_requested'] as const
export const ESTABLISHMENT_AVAILABILITY_TYPES = [
  'regular_hours',
  'appointment_only',
  'always_open',
] as const
export const ESTABLISHMENT_COORDINATE_SOURCES = ['manual', 'geocoded', 'imported'] as const
export const ESTABLISHMENT_SPECIAL_DAY_STATUSES = ['closed', 'custom_hours'] as const
export const ESTABLISHMENT_EXCEPTION_KINDS = ['closed', 'special_hours'] as const
export const ESTABLISHMENT_ATTRIBUTE_DATA_TYPES = [
  'text',
  'long_text',
  'boolean',
  'integer',
  'decimal',
  'single_select',
  'multi_select',
  'url',
] as const
export const ESTABLISHMENT_COMPLETENESS_RULES_VERSION = 2

namespace IEstablishment {
  export type LifecycleStatus = (typeof ESTABLISHMENT_LIFECYCLE_STATUSES)[number]
  export type BusinessStatus = (typeof ESTABLISHMENT_BUSINESS_STATUSES)[number]
  export type RevisionStatus = (typeof ESTABLISHMENT_REVISION_STATUSES)[number]
  export type EditableRevisionStatus = (typeof ESTABLISHMENT_EDITABLE_REVISION_STATUSES)[number]
  export type AvailabilityType = (typeof ESTABLISHMENT_AVAILABILITY_TYPES)[number]
  export type CoordinateSource = (typeof ESTABLISHMENT_COORDINATE_SOURCES)[number]
  export type SpecialDayStatus = (typeof ESTABLISHMENT_SPECIAL_DAY_STATUSES)[number]
  export type ExceptionKind = (typeof ESTABLISHMENT_EXCEPTION_KINDS)[number]
  export type AttributeDataType = (typeof ESTABLISHMENT_ATTRIBUTE_DATA_TYPES)[number]
  export type AttributeScalarValue = string | number | boolean | null

  export interface RevisionIdentityPayload {
    public_name: string
    city_id?: number | null
    slug?: string
    short_description?: string | null
    description?: string | null
    public_email?: string | null
    public_phone?: string | null
    whatsapp?: string | null
    website?: string | null
    instagram?: string | null
    booking_url?: string | null
    availability_type?: AvailabilityType | null
  }

  export interface RevisionIdentityUpdatePayload {
    public_name?: string
    city_id?: number | null
    slug?: string | null
    short_description?: string | null
    description?: string | null
    public_email?: string | null
    public_phone?: string | null
    whatsapp?: string | null
    website?: string | null
    instagram?: string | null
    booking_url?: string | null
    availability_type?: AvailabilityType | null
  }

  export interface CreatePayload extends RevisionIdentityPayload {}

  export interface RevisionPayload extends RevisionIdentityUpdatePayload {}

  export interface AddressPayload {
    postal_code?: string | null
    street?: string | null
    number?: string | null
    without_number?: boolean
    complement?: string | null
    district?: string | null
    reference?: string | null
    latitude?: number | null
    longitude?: number | null
    coordinate_source?: CoordinateSource | null
  }

  export interface CategoryPayload {
    category_id: number
    is_primary?: boolean
    sort_order?: number
  }

  export interface AttributeValuePayload {
    attribute_definition_id: number
    value?: unknown
    option_ids?: number[]
  }

  export interface HourIntervalPayload {
    opens_at: string
    closes_at: string
    spans_next_day?: boolean
    sort_order?: number
  }

  export interface WeeklyHourPayload extends HourIntervalPayload {
    weekday: number
  }

  export interface SpecialDayPayload {
    date: string
    status: SpecialDayStatus
    note?: string | null
    intervals?: HourIntervalPayload[]
  }

  export interface OpeningHourPayload {
    weekday: number
    opens_at: string
    closes_at: string
    crosses_midnight?: boolean
    sort_order?: number
  }

  export interface ScheduleExceptionPayload {
    starts_on: string
    ends_on: string
    kind: ExceptionKind
    opens_at?: string | null
    closes_at?: string | null
    crosses_midnight?: boolean
    reason?: string | null
    sort_order?: number
  }

  export interface SchedulePayload {
    availability_type: AvailabilityType
    weekly_hours: OpeningHourPayload[]
    exceptions: ScheduleExceptionPayload[]
  }

  export interface EffectiveAttributeDefinition {
    id: number
    tenant_id: number
    category_id: number
    key: string
    name: string
    description: string | null
    data_type: AttributeDataType
    unit: string | null
    is_required: boolean
    is_filterable: boolean
    is_public: boolean
    applies_to_descendants: boolean
    sort_order: number
    validation_rules: Record<string, unknown> | null
    source_category_id: number
    inherited_from_category_id: number | null
    required_for_primary: boolean
    options: Array<{
      id: number
      label: string
      value: string
      sort_order: number
      is_active: boolean
    }>
  }

  export interface CompletenessIssue {
    code: string
    field: string
    message: string
    severity: 'blocking' | 'warning'
    section?: string
    blocking?: boolean
    metadata?: Record<string, unknown>
  }

  export interface CompletenessSection {
    key: string
    complete: boolean
    completed_items: number
    total_items: number
    score: number
    issues: CompletenessIssue[]
  }

  export interface CompletenessReport {
    rules_version: number
    establishment_id: number
    revision_id: number
    profile_complete: boolean
    submission_ready: boolean
    score: number
    sections: CompletenessSection[]
    blockers: CompletenessIssue[]
  }

  export interface CompletenessResult {
    eligible: boolean
    score: number
    blocking_issues: CompletenessIssue[]
    warnings: CompletenessIssue[]
    checked_at: string
    rules_version: number
  }
}

export default IEstablishment
