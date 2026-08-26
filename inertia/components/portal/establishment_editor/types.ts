import type { InertiaFormProps } from '@inertiajs/react'

export interface IdentityFormData {
  public_name: string
  city_id: number | null
  short_description: string
  description: string
  public_email: string
  public_phone: string
  whatsapp: string
  website: string
  instagram: string
  booking_url: string
  availability_type: string
}

export interface AddressFormData {
  postal_code: string
  street: string
  number: string
  without_number: boolean
  complement: string
  district: string
  state_code: string
  latitude: number | null
  longitude: number | null
  coordinate_source: string
}

export interface CategorySelection {
  category_id: number
  is_primary: boolean
  sort_order: number
}

export interface CategoriesFormData {
  categories: CategorySelection[]
}

export interface HourInput {
  weekday: number
  opens_at: string
  closes_at: string
  spans_next_day: boolean
  sort_order: number
}

export interface HoursFormData {
  hours: HourInput[]
}

export interface FeedbackTarget {
  id: number
  label: string
  organization_id?: number
}

export interface FeedbackTargets {
  organizations: FeedbackTarget[]
  establishments: FeedbackTarget[]
}

export interface MediaAction {
  id: number
  kind: 'cover' | 'delete'
}

export interface EditorFormState {
  dirty: boolean
  processing: boolean
}

export type EditorFormStateChange = (state: EditorFormState) => void

export type IdentityForm = InertiaFormProps<IdentityFormData>
export type AddressForm = InertiaFormProps<AddressFormData>
export type CategoriesForm = InertiaFormProps<CategoriesFormData>
export type HoursForm = InertiaFormProps<HoursFormData>
